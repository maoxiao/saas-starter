# Credit System Architecture & Implementation

This document outlines the architecture and implementation details of the Credit System ("积分系统").
It is designed to be **auditable**, **idempotent**, and **concurrently safe**.

---

## 1. Core Data Model

The system uses a **Grant + Ledger** (积分包 + 流水) dual-table model, widely adopted by billing systems like Stripe and AWS.

### 1.1 `credit_grant` (The "Wallet")
Each time a user receives credits (Subscription, Top-up, Bonus), a separate "Grant" record is created.
- **Why**: Allows different expiration dates and priorities for different batches of credits.
- **Key Fields**:
    - `balance`: Current remaining credits in this specific grant.
    - `type`: 'subscription', 'topup', 'lifetime', 'promo', etc.
    - `priority`: Deduction order (Lower = used first).
    - `expiresAt`: When this specific batch expires (or null if permanent).
    - `effectiveAt`: When credits become usable (supports pre-sale scenarios).
    - `sourceRef`: Unique idempotency key (e.g., Stripe invoice ID).
    - `isActive`: Soft delete flag.

### 1.2 `credit_log` (The "Ledger")
Every change to a `credit_grant` is recorded as an immutable log entry.
- **Why**: Provides a perfect audit trail; the sum of all logs equals the current state.
- **Key Fields**:
    - `action`: 'granted', 'consumed', 'expired', 'refunded', 'held', 'released', 'revoked'.
    - `amountChange`: Positive (add) or Negative (deduct).
    - `eventId`: Idempotency key (e.g., job ID) to prevent double deduction.
    - `grantType`: Redundant copy of grant type for analytics stability.

---

## 2. Key Workflows

### 2.1 Granting Credits (Distribution)
**Source**: `src/credits/grant/grant.service.ts` -> `createGrant`

**Logic**:
1. Check if `sourceRef` already exists (idempotency check).
2. If exists, return existing grant ID without creating duplicate.
3. If not, create new grant + write `GRANTED` log in single transaction.
4. Handle DB unique constraint race condition as fallback.

> **Design Choice**: `sourceRef` uses UNIQUE constraint as ultimate safety net. Even if two Stripe webhooks fire simultaneously, only one grant is created.

### 2.2 Consuming Credits (Deduction)
**Source**: `src/credits/grant/deduction.service.ts` -> `deductCredits`

Uses a **Waterfall Algorithm** to deduct credits from multiple grants:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Check idempotency (eventId already CONSUMED?)            │
│ 2. Check if HELD exists -> auto-confirm if amount matches   │
│ 3. SELECT ... FOR UPDATE (lock grants)                      │
│ 4. Waterfall: priority ASC → expiresAt ASC → createdAt ASC  │
│ 5. Deduct from each grant until amount satisfied            │
│ 6. Write CONSUMED log per grant touched                     │
└─────────────────────────────────────────────────────────────┘
```

> **Design Choice - Priority Order**: 
> - Subscription (10) → Topup (20) → Promo (35) → Lifetime (50)
> - **Rationale**: Use expiring credits first; preserve permanent credits.

> **Design Choice - `FOR UPDATE` Lock**:
> - Prevents race conditions where parallel requests deplete the same balance.
> - Applies at transaction start to guarantee consistent read-then-write.

> **Design Choice - Auto-Confirm HELD**:
> - If `deductCredits` is called with an `eventId` that already has `HELD` logs, it auto-converts them to `CONSUMED`.
> - **Rationale**: Caller doesn't need to track whether they called `holdCredits` or `deductCredits` first—the system handles both paths gracefully.

### 2.3 Expiration (Cleanup)
**Source**: `src/credits/grant/cron.ts` & `grant.service.ts`

**Mechanism**: "Lazy Scan" via Cron Job (not real-time).

```
┌────────────────────────────────────────────────────────────────┐
│ 1. Query users with expired grants (using partial index)       │
│ 2. For each user, open ONE transaction                         │
│ 3. Lock all their expired grants with FOR UPDATE               │
│ 4. Set balance = 0 for each                                    │
│ 5. Batch insert all EXPIRED logs                               │
└────────────────────────────────────────────────────────────────┘
```

> **Design Choice - Lazy vs Real-Time**:
> - Credits don't expire at the exact second of `expiresAt`.
> - **Rationale**: Real-time expiration requires expensive triggers or schedulers. Lazy scan is simpler, cheaper, and "good enough" for 99.9% of use cases.

> **Design Choice - One Transaction Per User**:
> - All expired grants for a user are processed atomically.
> - **Rationale**: Reduces transaction commit overhead by 99% compared to per-grant transactions.

### 2.4 Hold & Release (Two-Phase Commit)
**Source**: `src/credits/grant/deduction.service.ts`

Used for long-running AI tasks where failure is possible.

| Function | Action | Balance Change | Log Action |
|----------|--------|----------------|------------|
| `holdCredits` | Pre-deduct | balance -= amount | `HELD` |
| `confirmHold` | Finalize | (none) | HELD→CONSUMED |
| `releaseCredits` | Refund | balance += amount | HELD→RELEASED |

> **Design Choice - In-Place Update vs New Log**:
> - `confirmHold` and `releaseCredits` UPDATE existing `HELD` logs rather than INSERT new ones.
> - **Rationale**: Prevents double-counting in analytics. A single eventId should only have one final state (CONSUMED/RELEASED), not both HELD + CONSUMED.

### 2.5 Refund (Post-Consumption Reversal)
**Source**: `src/credits/grant/deduction.service.ts` -> `refundCredits`

Used when an operation succeeds in consuming credits but fails afterward.

> **Design Choice - New Log (not Update)**:
> - Creates new `REFUNDED` logs instead of modifying `CONSUMED` logs.
> - **Rationale**: Preserves full audit trail. You can see: "Credits were consumed at T1, then refunded at T2."

---

## 3. Special Logic & Design Choices

### 3.1 Partial Index for Expiration
**File**: `src/db/schema.ts`
```typescript
index("credit_grant_expiration_idx")
  .on(table.expiresAt)
  .where(sql`is_active = true AND balance > 0`)
```
**Reasoning**: Only indexes "pending" work. Cron job performance stays O(pending), not O(total history).

### 3.2 Batch Log Insert in Expiration
**File**: `src/credits/grant/grant.service.ts` -> `processExpiredGrants`

**Implementation**: Collects all log entries in memory, then batch-inserts at transaction end.
**Reasoning**: Reduces N INSERT statements to 1, significantly improving DB throughput.

### 3.3 Redundant `grantType` in Logs
**File**: `src/db/schema.ts`
```typescript
grantType: text("grant_type")  // Redundant copy
```
**Reasoning**: Analytics queries (e.g., "subscription credits consumed this month") can run on `credit_log` alone without joining `credit_grant`, which may have archived/deleted rows.

### 3.4 Composite Unique Constraint
**File**: `src/db/schema.ts`
```typescript
unique("credit_log_event_grant_action_unique")
  .on(table.eventId, table.creditGrantId, table.action)
```
**Reasoning**: Allows these valid combinations for the same eventId:
- Grant1 HELD + Grant1 RELEASED ✓
- Grant1 CONSUMED + Grant2 CONSUMED ✓

But prevents:
- Grant1 CONSUMED + Grant1 CONSUMED ✗ (duplicate)

### 3.5 Monthly Grant Idempotency
**File**: `src/credits/grant/cron.ts` -> `getUsersWithGrantThisMonth`

**Logic**: Before granting monthly credits, batch-query users who already received grants this month.
**Reasoning**: Prevents double-granting if Stripe webhook already issued credits before cron ran.

### 3.6 Amount Mismatch Protection
**File**: `src/credits/grant/deduction.service.ts` (lines 78-89)

**Logic**: If `deductCredits(amount=100)` is called but `HELD` logs total 80, throw error.
**Reasoning**: Catches bugs where caller passes wrong amount during confirmation. Forces explicit handling.

---

## 4. Priority Reference Table

| Grant Type | Priority | Typical Expiration | Use Case |
|------------|----------|-------------------|----------|
| SUBSCRIPTION | 10 | Month end | Monthly plan credits |
| TOPUP | 20 | 1 year or never | One-time purchases |
| SIGNUP_BONUS | 30 | 30 days | New user welcome |
| PROMO | 35 | 30 days | Marketing campaigns |
| REFERRAL | 40 | 90 days | Invite rewards |
| COMPENSATION | 45 | Never | Customer support |
| MANUAL | 48 | Varies | Admin adjustments |
| LIFETIME | 50 | Never | Lifetime plan credits |
| LEGACY | 60 | Never | Migration from old system |

**Rule**: Lower priority number = deducted first.
**Philosophy**: Use expiring credits before permanent ones to maximize user value.

