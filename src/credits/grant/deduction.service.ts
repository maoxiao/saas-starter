/**
 * Deduction Service
 *
 * Implements waterfall (priority-based) credit deduction algorithm.
 * Includes transaction safety, row locking, and idempotency.
 */

import { randomUUID } from 'crypto';
import { getDb } from '@/db';
import { creditGrant, creditLog } from '@/db/schema';
import { and, asc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import {
  type DeductCreditsParams,
  LOG_ACTION,
  type RefundCreditsParams,
} from '@/credits/grant/types';

/**
 * Deduct credits using waterfall algorithm
 *
 * Deduction priority order:
 * 1. Lower priority number first (subscription before topup)
 * 2. Earlier expiration first (use expiring credits before permanent)
 * 3. Earlier creation first (FIFO within same priority/expiration)
 *
 * @param params Deduction parameters
 * @throws Error if insufficient credits or already processed (idempotency)
 */
export async function deductCredits(
  params: DeductCreditsParams
): Promise<void> {
  const { userId, amount, eventId, reason, metadata } = params;

  if (amount <= 0) {
    throw new Error('Deduction amount must be positive');
  }

  const db = await getDb();
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      // 1. Idempotency check - ensure we haven't CONSUMED this event already
      const existingConsumed = await tx
        .select({ id: creditLog.id })
        .from(creditLog)
        .where(
          and(
            eq(creditLog.userId, userId),
            eq(creditLog.eventId, eventId),
            eq(creditLog.action, LOG_ACTION.CONSUMED)
          )
        )
        .limit(1);

      if (existingConsumed.length > 0) {
        console.log(
          `deductCredits: Event ${eventId} already consumed, skipping`
        );
        return;
      }

      // 2. Check if this event was already HELD - if so, confirm it instead of double-charging
      const existingHeld = await tx
        .select({
          id: creditLog.id,
          amountChange: creditLog.amountChange,
        })
        .from(creditLog)
        .where(
          and(
            eq(creditLog.userId, userId),
            eq(creditLog.eventId, eventId),
            eq(creditLog.action, LOG_ACTION.HELD)
          )
        );

      if (existingHeld.length > 0) {
        // Verify the amount matches what was held
        const heldAmount = existingHeld.reduce(
          (sum, log) => sum + Math.abs(log.amountChange),
          0
        );
        if (heldAmount !== amount) {
          throw new Error(
            `Amount mismatch: held ${heldAmount} but deductCredits called with ${amount}. ` +
              `Use confirmHold() for same-amount confirmation or release and re-hold for different amounts.`
          );
        }

        // Credits were already held for this event - confirm them with updated metadata
        await tx
          .update(creditLog)
          .set({
            action: LOG_ACTION.CONSUMED,
            reason: reason || 'Hold auto-confirmed via deductCredits',
            metadata: metadata ? JSON.stringify(metadata) : undefined,
          })
          .where(
            and(
              eq(creditLog.userId, userId),
              eq(creditLog.eventId, eventId),
              eq(creditLog.action, LOG_ACTION.HELD)
            )
          );
        console.log(
          `deductCredits: Event ${eventId} had HELD credits (${heldAmount}), auto-confirmed`
        );
        return;
      }

      // 3. Get available grants with row lock (FOR UPDATE)
      // Ordered by: priority ASC, expiresAt ASC NULLS LAST, createdAt ASC
      const availableGrants = await tx
        .select()
        .from(creditGrant)
        .where(
          and(
            eq(creditGrant.userId, userId),
            eq(creditGrant.isActive, true),
            gt(creditGrant.balance, 0),
            lte(creditGrant.effectiveAt, now),
            or(isNull(creditGrant.expiresAt), gt(creditGrant.expiresAt, now))
          )
        )
        .orderBy(
          asc(creditGrant.priority),
          sql`${creditGrant.expiresAt} ASC NULLS LAST`,
          asc(creditGrant.createdAt)
        )
        .for('update');

      // 3. Calculate total available credits
      const totalAvailable = availableGrants.reduce(
        (sum, g) => sum + g.balance,
        0
      );
      if (totalAvailable < amount) {
        throw new Error(
          `Insufficient credits: need ${amount}, have ${totalAvailable}`
        );
      }

      // 4. Waterfall deduction
      let remaining = amount;
      for (const grant of availableGrants) {
        if (remaining <= 0) break;

        const deductFromThis = Math.min(grant.balance, remaining);
        const newBalance = grant.balance - deductFromThis;

        // Update grant balance
        await tx
          .update(creditGrant)
          .set({ balance: newBalance, updatedAt: now })
          .where(eq(creditGrant.id, grant.id));

        // Write consumption log for this grant
        await tx.insert(creditLog).values({
          id: randomUUID(),
          userId,
          creditGrantId: grant.id,
          grantType: grant.type,
          action: LOG_ACTION.CONSUMED,
          amountChange: -deductFromThis,
          eventId,
          reason,
          metadata: metadata ? JSON.stringify(metadata) : null,
          createdAt: now,
        });

        remaining -= deductFromThis;
      }
    });
  } catch (error) {
    // With composite unique (eventId + creditGrantId), a unique constraint violation
    // means the exact same grant was already processed for this event.
    // This is a true duplicate - re-throw as it indicates a bug or race condition.
    // The idempotency check at the start of the transaction handles normal retries.
    throw error;
  }

  console.log(
    `deductCredits: ${amount} credits deducted for user ${userId}, event: ${eventId}`
  );
}

/**
 * Hold (freeze) credits for pending operations like video generation
 * Returns credits on success, throws on failure
 */
export async function holdCredits(params: {
  userId: string;
  amount: number;
  eventId: string;
  reason?: string;
}): Promise<void> {
  const { userId, amount, eventId, reason } = params;

  if (amount <= 0) {
    throw new Error('Hold amount must be positive');
  }

  const db = await getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    // Check idempotency - also check CONSUMED to prevent double deduction
    // if deductCredits was incorrectly called before holdCredits for the same eventId
    const existingConsumedOrHeld = await tx
      .select({ id: creditLog.id, action: creditLog.action })
      .from(creditLog)
      .where(
        and(
          eq(creditLog.userId, userId),
          eq(creditLog.eventId, eventId),
          or(
            eq(creditLog.action, LOG_ACTION.HELD),
            eq(creditLog.action, LOG_ACTION.CONSUMED)
          )
        )
      )
      .limit(1);

    if (existingConsumedOrHeld.length > 0) {
      const action = existingConsumedOrHeld[0].action;
      console.log(`holdCredits: Event ${eventId} already ${action}, skipping`);
      return;
    }

    // Get available grants
    const availableGrants = await tx
      .select()
      .from(creditGrant)
      .where(
        and(
          eq(creditGrant.userId, userId),
          eq(creditGrant.isActive, true),
          gt(creditGrant.balance, 0),
          lte(creditGrant.effectiveAt, now),
          or(isNull(creditGrant.expiresAt), gt(creditGrant.expiresAt, now))
        )
      )
      .orderBy(
        asc(creditGrant.priority),
        sql`${creditGrant.expiresAt} ASC NULLS LAST`,
        asc(creditGrant.createdAt)
      )
      .for('update');

    const totalAvailable = availableGrants.reduce(
      (sum, g) => sum + g.balance,
      0
    );
    if (totalAvailable < amount) {
      throw new Error(
        `Insufficient credits for hold: need ${amount}, have ${totalAvailable}`
      );
    }

    // Deduct from grants (same as consumption, but log as HELD)
    let remaining = amount;
    for (const grant of availableGrants) {
      if (remaining <= 0) break;

      const deductFromThis = Math.min(grant.balance, remaining);
      const newBalance = grant.balance - deductFromThis;

      await tx
        .update(creditGrant)
        .set({ balance: newBalance, updatedAt: now })
        .where(eq(creditGrant.id, grant.id));

      await tx.insert(creditLog).values({
        id: randomUUID(),
        userId,
        creditGrantId: grant.id,
        grantType: grant.type,
        action: LOG_ACTION.HELD,
        amountChange: -deductFromThis,
        eventId,
        reason: reason || 'Credits held for pending operation',
        createdAt: now,
      });

      remaining -= deductFromThis;
    }
  });

  console.log(
    `holdCredits: ${amount} credits held for user ${userId}, event: ${eventId}`
  );
}

/**
 * Release held credits (on task failure)
 * Updates HELD logs to RELEASED and restores credits to balance
 */
export async function releaseCredits(params: {
  userId: string;
  eventId: string;
  reason?: string;
}): Promise<void> {
  const { userId, eventId, reason } = params;

  const db = await getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    // Find all HELD logs for this event
    const heldLogs = await tx
      .select()
      .from(creditLog)
      .where(
        and(
          eq(creditLog.userId, userId),
          eq(creditLog.eventId, eventId),
          eq(creditLog.action, LOG_ACTION.HELD)
        )
      );

    if (heldLogs.length === 0) {
      // Check if already released (HELD logs are gone)
      const existingRelease = await tx
        .select({ id: creditLog.id })
        .from(creditLog)
        .where(
          and(
            eq(creditLog.userId, userId),
            eq(creditLog.eventId, eventId),
            eq(creditLog.action, LOG_ACTION.RELEASED)
          )
        )
        .limit(1);

      if (existingRelease.length > 0) {
        console.log(
          `releaseCredits: Event ${eventId} already released, skipping`
        );
      } else {
        console.log(
          `releaseCredits: No held credits found for event ${eventId}`
        );
      }
      return;
    }

    // Restore credits to each grant
    for (const heldLog of heldLogs) {
      if (!heldLog.creditGrantId) continue;

      const refundAmount = Math.abs(heldLog.amountChange);

      // Update grant balance
      await tx
        .update(creditGrant)
        .set({
          balance: sql`${creditGrant.balance} + ${refundAmount}`,
          updatedAt: now,
        })
        .where(eq(creditGrant.id, heldLog.creditGrantId));
    }

    // Update all HELD logs to RELEASED (in-place, no new logs)
    await tx
      .update(creditLog)
      .set({
        action: LOG_ACTION.RELEASED,
        amountChange: sql`ABS(${creditLog.amountChange})`, // Convert negative to positive
        reason: reason || 'Credits released from hold',
      })
      .where(
        and(
          eq(creditLog.userId, userId),
          eq(creditLog.eventId, eventId),
          eq(creditLog.action, LOG_ACTION.HELD)
        )
      );
  });

  console.log(
    `releaseCredits: Credits released for user ${userId}, event: ${eventId}`
  );
}

/**
 * Check if user has enough credits available
 */
export async function hasEnoughCredits(
  userId: string,
  requiredAmount: number
): Promise<boolean> {
  const db = await getDb();
  const now = new Date();

  const grants = await db
    .select({ balance: creditGrant.balance })
    .from(creditGrant)
    .where(
      and(
        eq(creditGrant.userId, userId),
        eq(creditGrant.isActive, true),
        gt(creditGrant.balance, 0),
        lte(creditGrant.effectiveAt, now),
        or(isNull(creditGrant.expiresAt), gt(creditGrant.expiresAt, now))
      )
    );

  const totalAvailable = grants.reduce((sum, g) => sum + g.balance, 0);
  return totalAvailable >= requiredAmount;
}

/**
 * Confirm held credits (on task success)
 * Updates HELD logs to CONSUMED (not INSERT, to prevent double counting)
 */
export async function confirmHold(params: {
  userId: string;
  eventId: string;
  reason?: string;
}): Promise<void> {
  const { userId, eventId, reason } = params;

  const db = await getDb();

  await db.transaction(async (tx) => {
    // Find HELD logs for this event
    const heldLogs = await tx
      .select({ id: creditLog.id })
      .from(creditLog)
      .where(
        and(
          eq(creditLog.userId, userId),
          eq(creditLog.eventId, eventId),
          eq(creditLog.action, LOG_ACTION.HELD)
        )
      );

    if (heldLogs.length === 0) {
      console.log(`confirmHold: No held credits found for event ${eventId}`);
      return;
    }

    // Check if already confirmed (no HELD logs left, means they were converted)
    // Actually, we just check and update - if no HELD logs, nothing to do

    // Update all HELD logs to CONSUMED (in-place, no new logs)
    await tx
      .update(creditLog)
      .set({
        action: LOG_ACTION.CONSUMED,
        reason: reason || 'Hold confirmed - credits consumed',
      })
      .where(
        and(
          eq(creditLog.userId, userId),
          eq(creditLog.eventId, eventId),
          eq(creditLog.action, LOG_ACTION.HELD)
        )
      );
  });

  console.log(
    `confirmHold: Credits confirmed for user ${userId}, event: ${eventId}`
  );
}

/**
 * Refund consumed credits (reverse a CONSUMED transaction)
 *
 * Use this when an operation succeeds in deducting credits but fails afterward
 * (e.g., image generation fails after successful credit deduction).
 *
 * Creates new REFUNDED logs (does NOT mutate original CONSUMED logs) for audit trail.
 * Restores credits to the original grants they were deducted from.
 */
export async function refundCredits(
  params: RefundCreditsParams
): Promise<void> {
  const { userId, originalEventId, reason, metadata } = params;

  const db = await getDb();
  const now = new Date();

  await db.transaction(async (tx) => {
    // 1. Idempotency check - ensure we haven't already refunded this event
    const existingRefund = await tx
      .select({ id: creditLog.id })
      .from(creditLog)
      .where(
        and(
          eq(creditLog.userId, userId),
          eq(creditLog.eventId, originalEventId),
          eq(creditLog.action, LOG_ACTION.REFUNDED)
        )
      )
      .limit(1);

    if (existingRefund.length > 0) {
      console.log(
        `refundCredits: Event ${originalEventId} already refunded, skipping`
      );
      return;
    }

    // 2. Find all CONSUMED logs for this event
    const consumedLogs = await tx
      .select()
      .from(creditLog)
      .where(
        and(
          eq(creditLog.userId, userId),
          eq(creditLog.eventId, originalEventId),
          eq(creditLog.action, LOG_ACTION.CONSUMED)
        )
      );

    if (consumedLogs.length === 0) {
      throw new Error(`No consumed credits found for event ${originalEventId}`);
    }

    // 3. Restore credits to each original grant and create REFUNDED logs
    for (const consumedLog of consumedLogs) {
      const refundAmount = Math.abs(consumedLog.amountChange);

      // Restore credits to the grant (if it still exists)
      if (consumedLog.creditGrantId) {
        await tx
          .update(creditGrant)
          .set({
            balance: sql`${creditGrant.balance} + ${refundAmount}`,
            updatedAt: now,
          })
          .where(eq(creditGrant.id, consumedLog.creditGrantId));
      }

      // Create REFUNDED log with positive amountChange (credits returned)
      await tx.insert(creditLog).values({
        id: randomUUID(),
        userId,
        creditGrantId: consumedLog.creditGrantId,
        grantType: consumedLog.grantType,
        action: LOG_ACTION.REFUNDED,
        amountChange: refundAmount, // Positive: credits returned
        eventId: originalEventId,
        reason: reason || 'Credits refunded for failed operation',
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: now,
      });
    }
  });

  console.log(
    `refundCredits: Credits refunded for user ${userId}, event: ${originalEventId}`
  );
}
