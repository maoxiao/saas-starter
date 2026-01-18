# User & Payment Tracking Logic

## 1. User Attribution Tracking (Client-Side)

### Core Component
 **`src/components/tracking/attribution-tracker.tsx`**

This client-side component (React hook) manages the lifecycle of user sessions and attribution data. It uses `localStorage` to persist data across page reloads and browser sessions.

### Runtime Placement
**`src/app/[locale]/providers.tsx`** mounts `<AttributionTracker />` globally so attribution runs on every page.

### Storage Keys (localStorage)
| Key | Purpose | Expiry |
|:---|:---|:---|
| `pv_visitor_id` | Unique ID for every browser/device. Generated once and persists forever. | Never |
| `pv_first_touch` | The **very first source** that brought the user to the site. | Never (Immutable) |
| `pv_last_touch` | The **most recent source** (updated whenever new UTMs are seen). | Never (Overwritten) |
| `pv_session_entry` | The source that started the **current 30-minute session**. | 30 Minutes |
| `pv_registration_session` | A snapshot of attribution data capture at the exact moment of **Registration**. | Cleared after sync |
| `pv_linked_user_id` | Last authenticated userId linked to this visitor (prevents repeat sync). | Overwritten |

### Data Collection (Client)
1. **Visitor ID**
   * Generated once (`Date.now()` + random) and stored in `pv_visitor_id`.
2. **UTM Extraction**
   * Reads `utm_source`, `utm_medium`, `utm_campaign` from the current URL.
3. **External Referrer Parsing**
   * Only accepts referrers from a **different hostname**.
   * Search engines map to `medium=organic`, social sites to `medium=social`, otherwise `medium=referral` with the domain as `source`.
4. **Landing Page**
   * Captured as `pathname + search` for session entry / first touch / last touch.

### Logic & Rules
1.  **Session Definition (30-Minute Rule)**
    *   A session is defined by `pv_session_entry`.
    *   It expires **30 minutes after the session starts** (fixed window, not sliding).
    *   **Important:** Exploring new campaigns (clicking new UTM links) *within* an active 30-minute session **DOES NOT** start a new session. The session source remains the original source (Standard GA4 behavior).

2.  **Attribution Hierarchy**
    *   **First Touch**: Records the first time a user ever visits. If `utm_source` is present, it's captured. Otherwise, `referrer` or `Direct`.
    *   **Last Touch**: Updates every time `utm_source` / `medium` / `campaign` appears in the URL.
    *   **Registration Attribution**: When a user registers, we capture a specific snapshot. Currently, this prioritizes the **Session Entry** source (meaning if a user clicks an ad mid-session and registers 5 mins later, the registration is attributed to the *start* of that session, not necessarily the ad click).

3.  **Session Entry Fallbacks**
    *   If a session is expired or missing, a new `pv_session_entry` is created.
    *   If no UTMs but there is an external referrer, attribution is derived from the referrer.
    *   If no UTMs and no external referrer, `source=direct` and `medium=none`.

4.  **Session Attribution Getter**
    *   `getSessionAttribution()` returns the first valid source in this order:
        `pv_session_entry` (if not expired) → `pv_last_touch` → `pv_first_touch`.

### Registration Session Capture
* **File**: `src/components/auth/register-form.tsx`
* On successful signup (before email verification), `captureRegistrationSession()` snapshots the current session attribution into `pv_registration_session` with `capturedAt`.
* This ensures registration attribution is tied to the signup moment, not the later email-verification redirect.
* **Key Point**: `pv_registration_session` 永不过期，即使用户 30 分钟后才验证邮箱，也会使用注册时刻的归因数据。
* **清除时机**: `syncAttributionToServer()` 成功后调用 `clearRegistrationSession()` 清除。

### Auth Sync & User Linking
* On page load, `AttributionTracker` checks auth via `authClient.getSession()` with exponential backoff (up to 4 retries).
* If authenticated and not yet linked, it calls `syncAttributionToServer()` once and stores the `pv_linked_user_id`.
* If a different user logs in on the same browser, it resets all attribution keys, generates a new `pv_visitor_id`, and reloads to start fresh attribution.

### Data Syncing
*   **Trigger**: When a user logs in or registers.
*   **Endpoint**: `POST /api/attribution`
*   **Mechanism**: The frontend sends `visitorId` + all storage data. The backend links this `visitorId` to the authenticated `userId`.
*   **Payload Details**: Includes `firstTouch`, `lastTouch`, `currentSession` (derived from `pv_session_entry`), and `registrationSession` (if captured). The registration session is cleared after a successful sync.

### Server-Side Persistence
* **File**: `src/app/api/attribution/route.ts`
* Uses `visitorId` as the upsert key (unique per browser/device)。
* **Insert 前检查**: 先查询 `userId` 是否已存在于其他记录中（确定 `isNewUser`）。
* **Insert**:
  * Writes first-touch and last-touch fields.
  * 仅当 `userId` 存在且 `isNewUser = true` 时写入 `reg_*` 字段。
  * 老用户新设备：`isNewUser = false`，`reg_*` 全为 `null`。
* **Update on Conflict**:
  * Updates `last_touch_*` and timestamps only when new last-touch data is provided.
  * First-touch is never overwritten.
* **Late User Linking** (处理服务端 Auth 失败的容错):
  * If the visitor row exists without a `userId`, a follow-up update links the user.
  * 仅当 `isNewUser = true` 且 `regSource` 为空时写入 `reg_*`。

---

## 2. Payment Attribution Tracking

### Overview
Payment tracking links specific purchases (Transactions) back to the marketing source that drove them. This is achieved by passing attribution data into **Stripe Metadata**.

### Flow
1.  **Checkout Initialization**
    *   **Files**: `src/components/pricing/create-checkout-button.tsx`, `src/components/settings/credits/credit-checkout-button.tsx`
    *   When a user clicks "Buy" or "Subscribe", the frontend retrieves current attribution data via `getSessionAttribution()`.
    *   It prioritizes: `pv_session_entry` > `pv_last_touch` > `pv_first_touch`.
    *   This data is sent to the backend API that creates the Stripe Checkout Session as metadata:
        `sessionLandingPage`, `sessionReferrer`, `sessionSource`, `sessionMedium`, `sessionCampaign`.
    *   Affiliate metadata (Promotekit/Affonso) is appended if enabled.

2.  **Stripe Session Creation**
    *   **Files**: `src/actions/create-checkout-session.ts`, `src/actions/create-credit-checkout-session.ts`
    *   Server actions merge metadata with `userId`, `userName`, and optional Datafast cookies.
    *   **File**: `src/payment/provider/stripe.ts`
    *   **Methods**: `createCheckout` / `createCreditCheckout`
    *   **Action**: Metadata is injected into the Stripe Session, `payment_intent_data`, and `subscription_data`.
    *   `sessionLandingPage` and `sessionReferrer` are smart-truncated to fit Stripe's 500-char limit.

3.  **Payment Processing (Webhooks)**
    *   **File**: `src/app/api/webhooks/stripe/route.ts` & `src/payment/provider/stripe.ts`
    *   **Event**: `checkout.session.completed`
    *   **Action**: A `payment` record is created in the database. The `metadata` from the Stripe Session (containing attribution) is copied into the `payment` table columns:
        *   `session_source`, `session_medium`, `session_campaign`, etc.
    *   **Follow-up**: `invoice.paid` updates `paid=true` and payment amounts, but attribution remains the snapshot from checkout.

### Database Schema

#### `user_attribution` Table
Stores the user's lifetime attribution profile.
*   `first_touch_*`: Where they originally came from.
*   `last_touch_*`: Their most recent known source.
*   `reg_*`: The source responsible for their registration.

#### `payment` Table
Stores the specific source for *each* transaction.
*   `session_source` / `session_medium`: The source that was active *at the moment of checkout* (Conversion Source).

---

## 3. Key Scenarios

### Scenario A: Second Landing Registration
1. User visits Direct (Session 1 starts, Source=Direct).
2. 5 mins later, User clicks Twitter Ad (Session 1 still active).
3. User Registers immediately.
   *   **Result**: Registration Attribution = **Direct** (because Session 1 source is Direct).
   *   *Note: If you want this to validly attribute to Twitter, we need to change logic to prioritize Last Touch for registration.*

### Scenario B: Payment Conversion
1. User registered via Google Ads (First Touch = Google).
2. User returns 3 days later via Email Newsletter (Session 2, Source = Email).
3. User buys credits.
   *   **Result**: Payment Attribution = **Email** (The source of the specific conversion session).

---

## 4. Design Decisions & Intentional Behaviors

> **重要**: 以下行为是经过设计的，不是 Bug。未来维护时请勿误修改。

### 4.1 事件驱动归因模型 (Event-Driven Attribution)

数据库写入**仅在关键转化事件发生时触发**，而非每次页面访问：
- ✅ 用户注册
- ✅ 用户登录（关联 userId）
- ✅ 支付（快照当时的 session 归因）

**原因**: 减少数据库写入压力，避免高并发 bottleneck。localStorage 持续追踪，DB 只记录关键时刻。

### 4.2 `lastTouch` 字段含义

| 位置 | 含义 | 更新时机 |
|------|------|----------|
| `localStorage.pv_last_touch` | 最近一次带 UTM 的访问 | 每次 URL 含 UTM 时更新 |
| `userAttribution.last_touch_*` | **登录时的最后触点** | 每次 sync 时会覆盖（但同一用户只 sync 一次）|
| `payment.session_*` | **支付时的 session 归因** | 每次支付独立快照 |

**关键点**: 由于 `pv_linked_user_id` 机制，同一用户在同一设备只会 sync 一次。因此 `userAttribution.last_touch_*` 实际上只记录了**首次同步时的值**，后续 UTM 变化不会更新到数据库。

### 4.3 归因同步的时间窗口

`AttributionTracker` 在页面挂载后约 **7.8 秒内**尝试同步（4 次指数退避重试）：

```
300ms → 500ms → 1s → 2s → 4s
```

**设计原因**:
- 登录流程（密码/OAuth）通常导致页面刷新，会重新触发同步
- 避免无限轮询浪费资源

**边界情况**: 如果用户在 SPA 内无刷新登录（极少见），且登录时间超过 7.8 秒后，sync 可能不触发。当前设计认为这种情况可接受。

### 4.4 用户切换检测

当检测到 `pv_linked_user_id` 与当前登录用户不同时：
1. 生成新的 `pv_visitor_id`
2. 清除所有 localStorage 归因数据
3. 强制刷新页面

**原因**: 确保不同用户的归因数据完全隔离，避免污染。

### 4.5 服务端 Auth 失败的容错

如果客户端认为已登录，但服务端 session 获取失败（跨域、SameSite、ITP 等问题）：
1. 第一次 sync: 创建记录但 `userId = null`
2. 后续正确登录: UPDATE 关联 userId，为新用户写入 `reg_*`

**相关代码**: `route.ts` Line 147-183 处理此边界情况。

### 4.6 `reg_*` 字段写入条件

`reg_*` 字段**仅为新用户写入一次**，有两个写入时机：

**1. INSERT 时写入**（正常流程）：
- `userId` 存在（已认证）
- `isNewUser = true`（该 userId 在表中无任何记录）

**2. UPDATE 时写入**（服务端 Auth 失败的容错）：
- 当前 visitorId 记录的 `userId` 为空（之前 sync 时 Auth 失败）
- 当前 visitorId 记录的 `regSource` 为空
- `isNewUser = true`

**数据源优先级**: `registrationSession` > `currentSession`，确保使用注册时刻的归因，而非登录时刻的归因。

---

## 5. Edge Cases & Troubleshooting

### 5.1 为什么某个用户的 `reg_*` 是空的？

可能原因：
1. 老用户在新设备登录（`isNewUser = false`）
2. 注册时 `captureRegistrationSession()` 未执行（注册失败/中断）
3. 注册时 localStorage 被清除或隐私模式

### 5.2 为什么 `last_touch_*` 没有更新？

**这是正常行为**。DB 的 `last_touch_*` 仅在首次登录时写入。后续访问的 UTM 只更新 localStorage。

如需持续追踪"真正的最后触点"，应查询该用户最近一笔支付的 `session_*` 字段。

### 5.3 为什么同一用户有多条 `userAttribution` 记录？

每个 `visitorId`（浏览器/设备）是独立记录。同一用户在不同设备登录会有多条记录，但只有第一条会有 `reg_*` 数据。

### 5.4 OAuth 登录的归因是否正确？

OAuth 流程会离开站点再返回，但：
- `pv_session_entry` 使用 localStorage 持久化（带 30 分钟过期）
- OAuth 往返通常在几秒内完成，不会导致 session 过期
- 返回后页面刷新，触发新的 sync 流程

**已知限制**: OAuth 首次注册（新用户通过 Google 登录）不会调用 `captureRegistrationSession()`。此时 `reg_*` 使用 `currentSession`（OAuth 回调页面的 session 数据），通常仍是有效的入口页数据。

### 5.5 `reg_*` 字段在 INSERT 时的条件

后端 API（`route.ts`）在 INSERT 前会先检查 `isNewUser`：
```typescript
let isNewUser = false;
if (userId) {
  const existingForUser = await db
    .select({ id: userAttribution.id })
    .from(userAttribution)
    .where(eq(userAttribution.userId, userId))
    .limit(1);
  isNewUser = existingForUser.length === 0;
}

const regFields = (userId && isNewUser) ? {
  regPage: regSessionData?.landingPage || null,
  // ...
} : { regPage: null, /* ... */ };
```

**行为**：
- 新用户首次同步：`isNewUser = true` → INSERT 时写入 `reg_*`
- 老用户新设备：`isNewUser = false` → INSERT 时 `reg_*` 为 null
- 服务端 Auth 失败的新用户：INSERT 时 `userId = null` → `reg_*` 为 null，后续 UPDATE 时补充

### 5.6 `registrationSession` vs `currentSession` 优先级

后端处理 `reg_*` 时：
```typescript
const regSessionData = body.registrationSession || sessionData;
```

**优先级**：
1. `registrationSession` - Email 注册时捕获的快照（30分钟/换设备均不丢失）
2. `currentSession` - 当前 session 入口（可能已过期或变化）

**场景对比**：
| 场景 | 使用的数据源 |
|------|-------------|
| Email 注册 + 立即验证登录 | `registrationSession` ✅ |
| Email 注册 + 30分钟后验证登录 | `registrationSession` ✅ |
| Email 注册 + 换设备验证登录 | `currentSession`（新设备无 localStorage） |
| OAuth 首次登录 | `currentSession`（无 `registrationSession`）|

---

## 6. File Reference

| 文件 | 职责 |
|------|------|
| `src/components/tracking/attribution-tracker.tsx` | 客户端归因追踪核心 |
| `src/lib/attribution.ts` | 归因数据读取和同步工具 |
| `src/app/api/attribution/route.ts` | 服务端归因 API |
| `src/components/auth/register-form.tsx` | 注册时捕获归因快照 |
| `src/components/pricing/create-checkout-button.tsx` | 支付时附加归因 metadata |
| `src/payment/provider/stripe.ts` | Stripe webhook 处理和归因持久化 |
| `src/db/schema.ts` | 数据库 schema 定义 |
