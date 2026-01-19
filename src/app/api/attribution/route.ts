import { randomUUID } from 'crypto';
import { getDb } from '@/db';
import { userAttribution } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

interface AttributionPayload {
  visitorId: string;
  firstTouch?: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    landingPage?: string;
    referrer?: string;
  };
  lastTouch?: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
  };
  // Current session data
  currentSession?: {
    landingPage?: string;
    referrer?: string;
    source?: string;
    medium?: string;
    campaign?: string;
  };
  // Registration session (captured at registration time, before email verification)
  registrationSession?: {
    landingPage?: string;
    referrer?: string;
    source?: string;
    medium?: string;
    campaign?: string;
  } | null;
  landingPage?: string;
  referrer?: string;
}

/**
 * POST /api/attribution
 *
 * Upserts attribution data for a visitor using onConflict to avoid race conditions.
 * - First-touch fields are only set once (via onConflict)
 * - Last-touch fields are updated on each call with new data
 * - Automatically links to authenticated user if session exists
 */
export async function POST(request: NextRequest) {
  try {
    const body: AttributionPayload = await request.json();

    if (!body.visitorId) {
      return NextResponse.json(
        { error: 'visitorId is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const now = new Date();

    // Check if user is authenticated (Next.js 16 requires await headers())
    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      userId = session?.user?.id || null;
    } catch {
      // Not authenticated, continue without userId
    }

    const sessionData = body.currentSession;
    // Registration session has priority (captured at actual registration time)
    const regSessionData = body.registrationSession || sessionData;

    // Check if this is a new user (no existing attribution) BEFORE insert
    // This is needed to correctly set reg* fields on first sync for new users
    let isNewUser = false;
    if (userId) {
      const existingForUser = await db
        .select({ id: userAttribution.id })
        .from(userAttribution)
        .where(eq(userAttribution.userId, userId))
        .limit(1);
      isNewUser = existingForUser.length === 0;
    }

    // Use upsert pattern to avoid race conditions
    // Try to insert first, on conflict update the record
    try {
      // For new authenticated users, include reg* in the INSERT
      // This fixes the bug where reg* was never written for users who register and sync in one flow
      const regFields =
        userId && isNewUser
          ? {
              regPage: regSessionData?.landingPage || null,
              regRef: regSessionData?.referrer || null,
              regSource: regSessionData?.source || null,
              regMedium: regSessionData?.medium || null,
              regCampaign: regSessionData?.campaign || null,
            }
          : {
              regPage: null,
              regRef: null,
              regSource: null,
              regMedium: null,
              regCampaign: null,
            };

      await db
        .insert(userAttribution)
        .values({
          id: randomUUID(),
          visitorId: body.visitorId,
          userId,

          // First Touch
          firstTouchSource: body.firstTouch?.source || null,
          firstTouchMedium: body.firstTouch?.medium || null,
          firstTouchCampaign: body.firstTouch?.campaign || null,
          landingPage: body.landingPage || body.firstTouch?.landingPage || null,
          referrer: body.referrer || body.firstTouch?.referrer || null,
          firstSeenAt: now,

          // Last Touch
          lastTouchSource:
            body.lastTouch?.source || body.firstTouch?.source || null,
          lastTouchMedium:
            body.lastTouch?.medium || body.firstTouch?.medium || null,
          lastTouchCampaign:
            body.lastTouch?.campaign || body.firstTouch?.campaign || null,
          lastSeenAt: now,

          // Registration attribution: set for new users on insert
          ...regFields,

          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userAttribution.visitorId,
          set: {
            updatedAt: now,
            lastSeenAt: now,
            // Update last-touch if provided
            ...(body.lastTouch && {
              lastTouchSource: body.lastTouch.source,
              lastTouchMedium: body.lastTouch.medium,
              lastTouchCampaign: body.lastTouch.campaign,
            }),
          },
        });

      // If we need to update userId or reg* fields for EXISTING records, do a separate update
      // (onConflict's set clause doesn't have access to the existing row values)
      // This handles cases where:
      // 1. User visited anonymously first (server-side auth failed), then logged in properly
      // 2. Session cookie issues (SameSite, Safari ITP, privacy plugins) caused userId=null on first sync
      if (userId) {
        // Now check the current visitorId's record
        const existing = await db
          .select({
            userId: userAttribution.userId,
            regSource: userAttribution.regSource,
          })
          .from(userAttribution)
          .where(eq(userAttribution.visitorId, body.visitorId))
          .limit(1);

        if (existing.length > 0 && !existing[0].userId) {
          // First time linking user to this visitorId (previous sync had no userId)
          const updateData: Record<string, unknown> = {
            userId,
            updatedAt: now,
          };

          // Only set reg* fields if:
          // 1. Not already set on this record
          // 2. This is a new user (no existing attribution elsewhere)
          if (!existing[0].regSource && isNewUser) {
            updateData.regPage = regSessionData?.landingPage || null;
            updateData.regRef = regSessionData?.referrer || null;
            updateData.regSource = regSessionData?.source || null;
            updateData.regMedium = regSessionData?.medium || null;
            updateData.regCampaign = regSessionData?.campaign || null;
          }

          await db
            .update(userAttribution)
            .set(updateData)
            .where(eq(userAttribution.visitorId, body.visitorId));
        }
      }
    } catch (insertError) {
      // If insert fails due to race condition, it's fine - record already exists
      // Log but don't fail
      console.log(
        'Attribution insert conflict handled:',
        (insertError as Error).message?.substring(0, 100)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Attribution API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
