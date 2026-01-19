import { grantMonthlyCredits } from '@/credits/grant/cron';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron endpoint for granting monthly credits
 *
 * POST /api/cron/monthly-credits
 * Authorization: Bearer {CRON_SECRET}
 * Query params:
 *   - dryRun=true: Log eligible users without creating grants
 */
export async function POST(req: NextRequest) {
  // Auth Check
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';
    const result = await grantMonthlyCredits(dryRun);

    return NextResponse.json({ success: true, dryRun, summary: result });
  } catch (error) {
    console.error('Grant monthly credits error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
