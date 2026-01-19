import { getDb } from '@/db';
import { creditGrant, payment, user } from '@/db/schema';
import { findPlanByPriceId, getAllPricePlans } from '@/lib/price-plan';
import { PlanIntervals } from '@/payment/types';
import { addDays } from 'date-fns';
import { and, eq, gt, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { createGrant, processExpiredGrants } from '@/credits/grant/grant.service';
import { GRANT_PRIORITY, GRANT_TYPE } from '@/credits/grant/types';

/**
 * Batch query users who already have a grant of specified type in the given month
 * Used to prevent double granting when Webhook already issued credits
 * Performance: O(1) query instead of O(N) queries
 */
async function getUsersWithGrantThisMonth(
  userIds: string[],
  type: string,
  year: number,
  month: number
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const db = await getDb();
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 1);

  const existing = await db
    .select({ userId: creditGrant.userId })
    .from(creditGrant)
    .where(
      and(
        inArray(creditGrant.userId, userIds),
        eq(creditGrant.type, type),
        gte(creditGrant.createdAt, startOfMonth),
        lt(creditGrant.createdAt, endOfMonth)
      )
    );

  return new Set(existing.map((e) => e.userId));
}

interface GrantResult {
  freeUsersProcessed: number;
  lifetimeUsersProcessed: number;
  yearlyUsersProcessed: number;
  expiredGrantsProcessed: number;
}

/**
 * Grant monthly credits to all eligible users.
 * Idempotent: Safe to call multiple times per month.
 *
 * Industry-standard terminology: "grant" (used by Stripe Credit Grants API, AWS, etc.)
 *
 * @param dryRun If true, logs eligible users but doesn't create grants
 */
export async function grantMonthlyCredits(
  dryRun = false
): Promise<GrantResult> {
  console.log(`>>> grantMonthlyCredits (dryRun=${dryRun})`);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const db = await getDb();

  // 1. Expired Grants
  const expiredCount = await batchProcessExpiredGrants();

  // 2. Query Users with their latest active payment
  const latestPaymentSubquery = db
    .select({
      userId: payment.userId,
      priceId: payment.priceId,
      status: payment.status,
      paid: payment.paid,
      rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${payment.userId} ORDER BY ${payment.createdAt} DESC)`.as(
        'rn'
      ),
    })
    .from(payment)
    .where(
      or(
        and(eq(payment.status, 'active'), eq(payment.paid, true)),
        and(eq(payment.status, 'trialing'), eq(payment.paid, true)),
        and(eq(payment.status, 'completed'), eq(payment.paid, true))
      )
    )
    .as('lp');

  const users = await db
    .select({
      userId: user.id,
      priceId: latestPaymentSubquery.priceId,
      status: latestPaymentSubquery.status,
    })
    .from(user)
    .leftJoin(
      latestPaymentSubquery,
      and(
        eq(user.id, latestPaymentSubquery.userId),
        eq(latestPaymentSubquery.rn, 1)
      )
    )
    .where(or(isNull(user.banned), eq(user.banned, false)));

  const freeIds: string[] = [];
  const lifetimeUsers: { id: string; priceId: string }[] = [];
  const yearlyUsers: { id: string; priceId: string }[] = [];

  for (const u of users) {
    if (!u.priceId || !u.status) {
      freeIds.push(u.userId);
      continue;
    }
    const plan = findPlanByPriceId(u.priceId);
    if (!plan?.credits?.enable) continue;

    if (plan.isLifetime) {
      lifetimeUsers.push({ id: u.userId, priceId: u.priceId });
    } else if (
      plan.prices?.some(
        (p) => p.priceId === u.priceId && p.interval === PlanIntervals.YEAR
      )
    ) {
      yearlyUsers.push({ id: u.userId, priceId: u.priceId });
    }
    // Monthly subscriptions are handled by Stripe invoice.paid webhook
  }

  console.log(
    `grantMonthlyCredits: free=${freeIds.length}, lifetime=${lifetimeUsers.length}, yearly=${yearlyUsers.length}`
  );

  // 3. Free Credits
  let freeCount = 0;
  const freePlan = getAllPricePlans().find(
    (p) => p.isFree && !p.disabled && p.credits?.enable
  );
  if (freePlan?.credits) {
    // Pre-filter: exclude users who already got PROMO grant this month
    const alreadyGranted = await getUsersWithGrantThisMonth(
      freeIds,
      GRANT_TYPE.PROMO,
      year,
      month
    );
    const eligibleFreeIds = freeIds.filter((id) => !alreadyGranted.has(id));

    freeCount = await batchGrant(
      eligibleFreeIds,
      freePlan.credits.amount,
      GRANT_TYPE.PROMO,
      GRANT_PRIORITY.PROMO,
      'monthly_free',
      year,
      month,
      freePlan.credits.expireDays,
      dryRun
    );
  }

  // 4. Lifetime Credits
  let lifetimeCount = 0;
  const lifetimeByPrice = groupBy(lifetimeUsers, 'priceId');
  // Pre-filter: exclude users who already got LIFETIME grant this month
  const lifetimeIds = lifetimeUsers.map((u) => u.id);
  const lifetimeAlreadyGranted = await getUsersWithGrantThisMonth(
    lifetimeIds,
    GRANT_TYPE.LIFETIME,
    year,
    month
  );

  for (const [priceId, group] of Object.entries(lifetimeByPrice)) {
    const plan = findPlanByPriceId(priceId);
    if (plan?.credits) {
      const eligibleIds = group
        .map((g) => g.id)
        .filter((id) => !lifetimeAlreadyGranted.has(id));

      lifetimeCount += await batchGrant(
        eligibleIds,
        plan.credits.amount,
        GRANT_TYPE.LIFETIME,
        GRANT_PRIORITY.LIFETIME,
        'monthly_lifetime',
        year,
        month,
        plan.credits.expireDays,
        dryRun
      );
    }
  }

  // 5. Yearly Credits
  let yearlyCount = 0;
  const yearlyByPrice = groupBy(yearlyUsers, 'priceId');
  // Pre-filter: exclude users who already got SUBSCRIPTION grant this month
  const yearlyIds = yearlyUsers.map((u) => u.id);
  const yearlyAlreadyGranted = await getUsersWithGrantThisMonth(
    yearlyIds,
    GRANT_TYPE.SUBSCRIPTION,
    year,
    month
  );

  for (const [priceId, group] of Object.entries(yearlyByPrice)) {
    const plan = findPlanByPriceId(priceId);
    if (plan?.credits) {
      const eligibleIds = group
        .map((g) => g.id)
        .filter((id) => !yearlyAlreadyGranted.has(id));

      yearlyCount += await batchGrant(
        eligibleIds,
        plan.credits.amount,
        GRANT_TYPE.SUBSCRIPTION,
        GRANT_PRIORITY.SUBSCRIPTION,
        'monthly_yearly',
        year,
        month,
        plan.credits.expireDays,
        dryRun
      );
    }
  }

  console.log(
    `<<< grantMonthlyCredits done: free=${freeCount}, lifetime=${lifetimeCount}, yearly=${yearlyCount}, expired=${expiredCount}`
  );
  return {
    freeUsersProcessed: freeCount,
    lifetimeUsersProcessed: lifetimeCount,
    yearlyUsersProcessed: yearlyCount,
    expiredGrantsProcessed: expiredCount,
  };
}

async function batchGrant(
  userIds: string[],
  amount: number,
  type: string,
  priority: number,
  prefix: string,
  year: number,
  month: number,
  expireDays?: number,
  dryRun = false
): Promise<number> {
  let count = 0;
  for (const uid of userIds) {
    const sourceRef = `${prefix}_${uid}_${year}_${String(month).padStart(2, '0')}`;
    if (dryRun) {
      console.log(`[DRY RUN] Would grant ${amount} to ${uid} (${sourceRef})`);
      count++;
      continue;
    }
    try {
      await createGrant({
        userId: uid,
        type: type as any,
        amount,
        priority,
        expiresAt: expireDays ? addDays(new Date(), expireDays) : null,
        sourceRef,
      });
      count++;
    } catch (error: any) {
      // Check if this is an idempotency conflict (sourceRef unique constraint)
      // PostgreSQL unique violation error code is '23505'
      const isUniqueViolation =
        error?.code === '23505' ||
        error?.message?.includes('unique constraint') ||
        error?.message?.includes('duplicate key') ||
        error?.message?.includes('source_ref_unique');

      if (isUniqueViolation) {
        // Idempotency: grant already exists, skip silently (expected behavior)
        continue;
      }

      // Real error: log warning but continue processing other users
      console.error(
        `[batchGrant] Failed to grant ${amount} credits to user ${uid} (${sourceRef}):`,
        error?.message || error
      );
      // Note: count is NOT incremented, so the return value reflects actual successful grants
    }
  }
  return count;
}

async function batchProcessExpiredGrants(): Promise<number> {
  const db = await getDb();
  const now = new Date();

  // Only query users who have expired grants with balance
  const usersWithExpiredGrants = await db
    .selectDistinct({ userId: creditGrant.userId })
    .from(creditGrant)
    .where(
      and(
        eq(creditGrant.isActive, true),
        gt(creditGrant.balance, 0),
        sql`${creditGrant.expiresAt} <= ${now}` // Has expired grants
      )
    );

  let total = 0;
  for (const { userId } of usersWithExpiredGrants) {
    total += await processExpiredGrants(userId);
  }
  return total;
}

function groupBy(arr: { id: string; priceId: string }[], key: 'priceId') {
  return arr.reduce(
    (acc, cur) => {
      (acc[cur[key]] = acc[cur[key]] || []).push(cur);
      return acc;
    },
    {} as Record<string, typeof arr>
  );
}
