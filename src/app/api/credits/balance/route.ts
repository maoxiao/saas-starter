import { getBalance } from '@/credits/grant';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * GET /api/credits/balance
 *
 * Returns user's credit balance with breakdown by type:
 * - subscription: Monthly subscription credits (with expiration date)
 * - topup: One-time purchase credits (never expire)
 * - other: Bonus, referral, promo credits
 */
export async function GET() {
  try {
    // Get authenticated user (Next.js 15+ requires await headers())
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const balance = await getBalance(userId);

    return NextResponse.json({
      total: balance.total,
      breakdown: {
        subscription: {
          balance: balance.subscription.balance,
          expiresAt: balance.subscription.expiresAt?.toISOString() ?? null,
        },
        lifetime: {
          balance: balance.lifetime.balance,
          expiresAt: null,
        },
        topup: {
          balance: balance.topup.balance,
          expiringBalance: balance.topup.expiringBalance,
          expiresAt: balance.topup.expiresAt?.toISOString() ?? null,
          nonExpiringBalance: balance.topup.nonExpiringBalance,
        },
        other: {
          balance: balance.other.balance,
        },
      },
    });
  } catch (error) {
    console.error('GET /api/credits/balance error:', error);
    return NextResponse.json(
      { error: 'Failed to get balance' },
      { status: 500 }
    );
  }
}
