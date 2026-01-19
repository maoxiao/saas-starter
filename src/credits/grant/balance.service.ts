/**
 * Balance Service
 *
 * Provides balance queries with breakdown by credit type.
 */

import { getDb } from '@/db';
import { creditGrant, creditLog } from '@/db/schema';
import {
  and,
  asc,
  count as countFn,
  desc,
  eq,
  gt,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import {
  type BalanceBreakdown,
  GRANT_TYPE,
  LOG_ACTION,
  type SpentThisPeriod,
} from '@/credits/grant/types';

/**
 * Get user's total credit balance with breakdown by type
 */
export async function getBalance(userId: string): Promise<BalanceBreakdown> {
  const db = await getDb();
  const now = new Date();

  // Get all active grants
  const activeGrants = await db
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
    );

  // Calculate breakdown
  let subscriptionBalance = 0;
  let subscriptionExpiresAt: Date | null = null;
  let lifetimeBalance = 0;
  let topupBalance = 0;
  let topupExpiringBalance = 0;
  let topupNonExpiringBalance = 0;
  let topupExpiresAt: Date | null = null;
  let otherBalance = 0;

  for (const grant of activeGrants) {
    switch (grant.type) {
      case GRANT_TYPE.SUBSCRIPTION:
        subscriptionBalance += grant.balance;
        // Track earliest expiration for subscription credits
        if (grant.expiresAt) {
          if (
            !subscriptionExpiresAt ||
            grant.expiresAt < subscriptionExpiresAt
          ) {
            subscriptionExpiresAt = grant.expiresAt;
          }
        }
        break;
      case GRANT_TYPE.LIFETIME:
        lifetimeBalance += grant.balance;
        break;
      case GRANT_TYPE.TOPUP:
        topupBalance += grant.balance;
        // Separate expiring and non-expiring topup credits
        if (grant.expiresAt) {
          topupExpiringBalance += grant.balance;
          // Track earliest expiration for expiring topup credits
          if (!topupExpiresAt || grant.expiresAt < topupExpiresAt) {
            topupExpiresAt = grant.expiresAt;
          }
        } else {
          topupNonExpiringBalance += grant.balance;
        }
        break;
      default:
        otherBalance += grant.balance;
    }
  }

  return {
    total: subscriptionBalance + lifetimeBalance + topupBalance + otherBalance,
    subscription: {
      balance: subscriptionBalance,
      expiresAt: subscriptionExpiresAt,
    },
    lifetime: {
      balance: lifetimeBalance,
      expiresAt: null,
    },
    topup: {
      balance: topupBalance,
      expiringBalance: topupExpiringBalance,
      expiresAt: topupExpiresAt,
      nonExpiringBalance: topupNonExpiringBalance,
    },
    other: {
      balance: otherBalance,
    },
  };
}

/**
 * Get credits spent in the current billing period
 * @param userId User ID
 * @param periodStart Start of the billing period (defaults to start of current month)
 * @param periodEnd End of the billing period (defaults to end of current month)
 */
export async function getSpentThisPeriod(
  userId: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<SpentThisPeriod> {
  const db = await getDb();
  const now = new Date();

  // Default to current month
  const start = periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
  const end =
    periodEnd ||
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Get all CONSUMED and REFUNDED logs in the period
  // CONSUMED: negative amountChange (credits deducted)
  // REFUNDED: positive amountChange (credits returned)
  // Net spent = abs(CONSUMED) - REFUNDED
  // This ensures refunds reduce the spent count correctly
  const consumptionLogs = await db
    .select({
      grantId: creditLog.creditGrantId,
      grantType: creditLog.grantType, // Use redundant field for stability
      amountChange: creditLog.amountChange,
      action: creditLog.action,
    })
    .from(creditLog)
    .where(
      and(
        eq(creditLog.userId, userId),
        or(
          eq(creditLog.action, LOG_ACTION.CONSUMED),
          eq(creditLog.action, LOG_ACTION.REFUNDED)
        ),
        gte(creditLog.createdAt, start),
        lte(creditLog.createdAt, end)
      )
    );

  let subscriptionSpent = 0;
  let lifetimeSpent = 0;
  let topupSpent = 0;
  let otherSpent = 0;

  // Fallback for legacy logs without grantType field
  // Only query grants if there are logs that need lookup
  const logsNeedingLookup = consumptionLogs.filter(
    (l) => !l.grantType && l.grantId
  );
  const grantTypeMap = new Map<string, string>();

  if (logsNeedingLookup.length > 0) {
    const grantIds = [
      ...new Set(logsNeedingLookup.map((l) => l.grantId)),
    ] as string[];
    const grants = await db
      .select({ id: creditGrant.id, type: creditGrant.type })
      .from(creditGrant)
      .where(
        sql`${creditGrant.id} IN (${sql.join(
          grantIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    for (const g of grants) {
      grantTypeMap.set(g.id, g.type);
    }
  }

  // Calculate spent by type (always loops - fixes the original bug)
  for (const log of consumptionLogs) {
    const change = -log.amountChange; // Invert: negative becomes positive spent
    // Prefer log.grantType, fallback to lookup, then 'other' if grant deleted
    const grantType =
      log.grantType || (log.grantId ? grantTypeMap.get(log.grantId) : null);

    switch (grantType) {
      case GRANT_TYPE.SUBSCRIPTION:
        subscriptionSpent += change;
        break;
      case GRANT_TYPE.LIFETIME:
        lifetimeSpent += change;
        break;
      case GRANT_TYPE.TOPUP:
        topupSpent += change;
        break;
      default:
        otherSpent += change;
    }
  }

  return {
    subscriptionSpent,
    lifetimeSpent,
    topupSpent,
    totalSpent: subscriptionSpent + lifetimeSpent + topupSpent + otherSpent,
    periodStart: start,
    periodEnd: end,
  };
}

/**
 * Get simple total balance (for quick checks)
 */
export async function getTotalBalance(userId: string): Promise<number> {
  const balance = await getBalance(userId);
  return balance.total;
}

/**
 * Get credits expiring within a given number of days
 * Returns the sum of balances from grants that will expire within the window
 */
export async function getExpiringCredits(
  userId: string,
  days = 30
): Promise<{ amount: number; earliestExpiration: Date | null }> {
  const db = await getDb();
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Get grants expiring within the window
  const expiringGrants = await db
    .select({
      balance: creditGrant.balance,
      expiresAt: creditGrant.expiresAt,
    })
    .from(creditGrant)
    .where(
      and(
        eq(creditGrant.userId, userId),
        eq(creditGrant.isActive, true),
        gt(creditGrant.balance, 0),
        lte(creditGrant.effectiveAt, now),
        // Expires between now and futureDate
        gt(creditGrant.expiresAt, now),
        lte(creditGrant.expiresAt, futureDate)
      )
    );

  let totalAmount = 0;
  let earliestExpiration: Date | null = null;

  for (const grant of expiringGrants) {
    totalAmount += grant.balance;
    if (grant.expiresAt) {
      if (!earliestExpiration || grant.expiresAt < earliestExpiration) {
        earliestExpiration = grant.expiresAt;
      }
    }
  }

  return { amount: totalAmount, earliestExpiration };
}

/**
 * Transaction log entry for frontend display
 */
export interface TransactionLogEntry {
  id: string;
  userId: string;
  type: string; // action type (granted, consumed, expired, etc.)
  description: string | null;
  amount: number; // amountChange (positive or negative)
  balance: number | null; // grant balance at time of log (if available)
  paymentId: string | null;
  expirationDate: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get transaction logs with pagination and filtering
 */
export async function getTransactionLogs(
  userId: string,
  options: {
    pageIndex: number;
    pageSize: number;
    search?: string;
    sortField?: string;
    sortDesc?: boolean;
    filterType?: string;
  }
): Promise<{ items: TransactionLogEntry[]; total: number }> {
  const db = await getDb();
  const { pageIndex, pageSize, search, sortField, sortDesc, filterType } =
    options;

  // Build where conditions
  const whereConditions = [eq(creditLog.userId, userId)];

  // Search in reason field
  if (search) {
    whereConditions.push(ilike(creditLog.reason, `%${search}%`));
  }

  // Filter by action type
  if (filterType) {
    whereConditions.push(eq(creditLog.action, filterType));
  }

  const where = and(...whereConditions);
  const offset = pageIndex * pageSize;

  // Sort configuration
  const sortColumn =
    sortField === 'amount' ? creditLog.amountChange : creditLog.createdAt;
  const orderBy = sortDesc ? desc(sortColumn) : asc(sortColumn);

  const [logs, [{ count }]] = await Promise.all([
    db
      .select({
        id: creditLog.id,
        userId: creditLog.userId,
        action: creditLog.action,
        reason: creditLog.reason,
        amountChange: creditLog.amountChange,
        creditGrantId: creditLog.creditGrantId,
        createdAt: creditLog.createdAt,
      })
      .from(creditLog)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db.select({ count: countFn() }).from(creditLog).where(where),
  ]);

  // Map to frontend-compatible structure
  const items: TransactionLogEntry[] = logs.map((log) => ({
    id: log.id,
    userId: log.userId,
    type: log.action, // Map action to type for compatibility
    description: log.reason,
    amount: log.amountChange,
    balance: null, // Not stored in log
    paymentId: null, // Not stored in log (use metadata if needed)
    expirationDate: null,
    expiredAt: null,
    createdAt: log.createdAt,
    updatedAt: log.createdAt, // Log is immutable
  }));

  return { items, total: Number(count) };
}
