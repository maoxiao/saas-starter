/**
 * Grant Service
 *
 * Manages credit grants: creation, querying, and expiration.
 */

import { randomUUID } from 'crypto';
import { getDb } from '@/db';
import { creditGrant, creditLog } from '@/db/schema';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import {
  type CreateGrantParams,
  GRANT_PRIORITY,
  GRANT_TYPE,
  type GrantType,
  LOG_ACTION,
  type RevokeGrantParams,
} from '@/credits/grant/types';

/**
 * Create a new credit grant
 * @param params Grant creation parameters
 * @returns The created grant ID
 */
export async function createGrant(params: CreateGrantParams): Promise<string> {
  const {
    userId,
    type,
    amount,
    priority = getDefaultPriority(type),
    expiresAt = null,
    effectiveAt = new Date(),
    sourceRef,
  } = params;

  if (amount <= 0) {
    throw new Error('Grant amount must be positive');
  }

  const db = await getDb();
  const now = new Date();

  // Idempotency check: if sourceRef is provided, check if grant already exists
  if (sourceRef) {
    const existingGrant = await db
      .select({ id: creditGrant.id })
      .from(creditGrant)
      .where(eq(creditGrant.sourceRef, sourceRef))
      .limit(1);

    if (existingGrant.length > 0) {
      console.log(
        `createGrant: Grant with sourceRef ${sourceRef} already exists, skipping`
      );
      return existingGrant[0].id;
    }
  }

  const grantId = randomUUID();

  try {
    await db.transaction(async (tx) => {
      // Insert the grant
      await tx.insert(creditGrant).values({
        id: grantId,
        userId,
        type,
        amount,
        balance: amount,
        priority,
        expiresAt,
        effectiveAt,
        sourceRef,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Write audit log
      await tx.insert(creditLog).values({
        id: randomUUID(),
        userId,
        creditGrantId: grantId,
        grantType: type,
        action: LOG_ACTION.GRANTED,
        amountChange: amount,
        reason: `Grant created: ${type}`,
        createdAt: now,
      });
    });
  } catch (error) {
    // Handle unique constraint violation (race condition between check and insert)
    if (error instanceof Error && error.message.includes('unique')) {
      console.log(
        `createGrant: Duplicate sourceRef ${sourceRef} caught by DB constraint, skipping`
      );
      // Fetch and return the existing grant ID
      if (sourceRef) {
        const existing = await db
          .select({ id: creditGrant.id })
          .from(creditGrant)
          .where(eq(creditGrant.sourceRef, sourceRef))
          .limit(1);
        if (existing.length > 0) {
          return existing[0].id;
        }
      }
      throw error; // Re-throw if we can't find the existing grant
    }
    throw error;
  }

  console.log(`createGrant: ${amount} credits (${type}) for user ${userId}`);
  return grantId;
}

/**
 * Get all active grants for a user that can be used for deduction
 * (not expired, has balance, effective, and active)
 */
export async function getActiveGrants(userId: string) {
  const db = await getDb();
  const now = new Date();

  return db
    .select()
    .from(creditGrant)
    .where(
      and(
        eq(creditGrant.userId, userId),
        eq(creditGrant.isActive, true),
        gt(creditGrant.balance, 0),
        lte(creditGrant.effectiveAt, now), // Must be effective
        or(
          isNull(creditGrant.expiresAt),
          gt(creditGrant.expiresAt, now) // Not expired
        )
      )
    );
}

/**
 * Get all grants for a user (including expired/inactive for audit)
 */
export async function getAllGrants(userId: string) {
  const db = await getDb();
  return db.select().from(creditGrant).where(eq(creditGrant.userId, userId));
}

/**
 * Mark a grant as inactive (soft delete)
 */
export async function deactivateGrant(grantId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(creditGrant)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(creditGrant.id, grantId));
}

/**
 * Process expired grants for a user
 * Marks expired grants and logs the expiration
 */
export async function processExpiredGrants(userId: string): Promise<number> {
  const db = await getDb();
  const now = new Date();

  // Find grants that have expired but still have balance
  const expiredGrants = await db
    .select()
    .from(creditGrant)
    .where(
      and(
        eq(creditGrant.userId, userId),
        eq(creditGrant.isActive, true),
        gt(creditGrant.balance, 0),
        lte(creditGrant.expiresAt, now) // Expired
      )
    );

  // Early return if no expired grants
  if (expiredGrants.length === 0) {
    return 0;
  }

  let totalExpired = 0;

  // Single transaction for all grants (performance optimization)
  await db.transaction(async (tx) => {
    const logEntries: {
      id: string;
      userId: string;
      creditGrantId: string;
      grantType: string;
      action: string;
      amountChange: number;
      reason: string;
      createdAt: Date;
    }[] = [];

    for (const grant of expiredGrants) {
      // Re-fetch with row lock to get fresh balance (prevents race with concurrent deductions)
      const [freshGrant] = await tx
        .select({
          id: creditGrant.id,
          balance: creditGrant.balance,
          type: creditGrant.type,
        })
        .from(creditGrant)
        .where(eq(creditGrant.id, grant.id))
        .for('update');

      if (!freshGrant || freshGrant.balance <= 0) {
        // Already consumed or expired by another process
        continue;
      }

      const expiredAmount = freshGrant.balance;
      totalExpired += expiredAmount;

      // Zero out the balance
      await tx
        .update(creditGrant)
        .set({ balance: 0, updatedAt: now })
        .where(eq(creditGrant.id, freshGrant.id));

      // Collect log entry for batch insert
      logEntries.push({
        id: randomUUID(),
        userId,
        creditGrantId: freshGrant.id,
        grantType: freshGrant.type,
        action: LOG_ACTION.EXPIRED,
        amountChange: -expiredAmount,
        reason: `Grant expired`,
        createdAt: now,
      });
    }

    // Batch insert all log entries at once
    if (logEntries.length > 0) {
      await tx.insert(creditLog).values(logEntries);
    }
  });

  if (totalExpired > 0) {
    console.log(
      `processExpiredGrants: ${totalExpired} credits expired for user ${userId}`
    );
  }

  return totalExpired;
}

/**
 * Get default priority for a grant type
 */
function getDefaultPriority(type: GrantType): number {
  switch (type) {
    case GRANT_TYPE.SUBSCRIPTION:
      return GRANT_PRIORITY.SUBSCRIPTION;
    case GRANT_TYPE.LIFETIME:
      return GRANT_PRIORITY.LIFETIME;
    case GRANT_TYPE.TOPUP:
      return GRANT_PRIORITY.TOPUP;
    case GRANT_TYPE.SIGNUP_BONUS:
      return GRANT_PRIORITY.SIGNUP_BONUS;
    case GRANT_TYPE.PROMO:
      return GRANT_PRIORITY.PROMO;
    case GRANT_TYPE.REFERRAL:
      return GRANT_PRIORITY.REFERRAL;
    case GRANT_TYPE.COMPENSATION:
      return GRANT_PRIORITY.COMPENSATION;
    case GRANT_TYPE.MANUAL:
      return GRANT_PRIORITY.MANUAL;
    case GRANT_TYPE.LEGACY:
      return GRANT_PRIORITY.LEGACY;
    default:
      return 100;
  }
}

/**
 * Revoke a grant (for refunds)
 * Sets balance to 0 and marks as inactive
 * @param params Revoke parameters including grantId, reason, and metadata
 * @returns The amount that was revoked
 */
export async function revokeGrant(
  params: RevokeGrantParams
): Promise<{ revokedAmount: number }> {
  const { grantId, reason, metadata } = params;
  const db = await getDb();
  const now = new Date();

  return await db.transaction(async (tx) => {
    // Get grant with lock
    const [grant] = await tx
      .select()
      .from(creditGrant)
      .where(eq(creditGrant.id, grantId))
      .for('update');

    if (!grant) {
      throw new Error(`Grant ${grantId} not found`);
    }

    const revokedAmount = grant.balance;

    if (revokedAmount > 0) {
      // Zero out balance and deactivate
      await tx
        .update(creditGrant)
        .set({ balance: 0, isActive: false, updatedAt: now })
        .where(eq(creditGrant.id, grantId));

      // Write revocation log
      await tx.insert(creditLog).values({
        id: randomUUID(),
        userId: grant.userId,
        creditGrantId: grantId,
        grantType: grant.type,
        action: LOG_ACTION.REVOKED,
        amountChange: -revokedAmount,
        reason: reason || 'Grant revoked',
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: now,
      });

      console.log(
        `revokeGrant: ${revokedAmount} credits revoked for grant ${grantId}`
      );
    } else {
      // Just deactivate if no balance
      await tx
        .update(creditGrant)
        .set({ isActive: false, updatedAt: now })
        .where(eq(creditGrant.id, grantId));

      console.log(
        `revokeGrant: Grant ${grantId} deactivated (no balance to revoke)`
      );
    }

    return { revokedAmount };
  });
}
