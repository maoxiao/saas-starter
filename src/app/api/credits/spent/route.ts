import { getSpentThisPeriod } from '@/credits/grant';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * GET /api/credits/spent
 *
 * Returns credits spent in the current billing period, broken down by type.
 * Optionally accepts query params: periodStart, periodEnd (ISO date strings)
 */
export async function GET(request: Request) {
  try {
    // Get authenticated user (Next.js 15+ requires await headers())
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse optional query params for custom period
    const { searchParams } = new URL(request.url);
    const periodStartParam = searchParams.get('periodStart');
    const periodEndParam = searchParams.get('periodEnd');

    let periodStart: Date | undefined;
    let periodEnd: Date | undefined;

    if (periodStartParam) {
      periodStart = new Date(periodStartParam);
      if (isNaN(periodStart.getTime())) {
        return NextResponse.json(
          { error: 'Invalid periodStart date format' },
          { status: 400 }
        );
      }
    }

    if (periodEndParam) {
      periodEnd = new Date(periodEndParam);
      if (isNaN(periodEnd.getTime())) {
        return NextResponse.json(
          { error: 'Invalid periodEnd date format' },
          { status: 400 }
        );
      }
    }

    const spent = await getSpentThisPeriod(userId, periodStart, periodEnd);

    return NextResponse.json({
      subscriptionSpentThisPeriod: spent.subscriptionSpent,
      lifetimeSpentThisPeriod: spent.lifetimeSpent,
      topupSpentThisPeriod: spent.topupSpent,
      totalSpentThisPeriod: spent.totalSpent,
      periodStart: spent.periodStart.toISOString(),
      periodEnd: spent.periodEnd.toISOString(),
    });
  } catch (error) {
    console.error('GET /api/credits/spent error:', error);
    return NextResponse.json(
      { error: 'Failed to get spent credits' },
      { status: 500 }
    );
  }
}
