/**
 * Attribution utilities for tracking user acquisition sources
 * 
 * This module provides client-side utilities to retrieve attribution data
 * stored in localStorage by the AttributionTracker component.
 * 
 * Data is only written to the database on key conversion events:
 * - User signup
 * - User login (to link attribution to userId)
 * - Payment (snapshot at conversion time)
 */

const VISITOR_ID_KEY = 'pv_visitor_id';
const FIRST_TOUCH_KEY = 'pv_first_touch';
const LAST_TOUCH_KEY = 'pv_last_touch';

export interface AttributionData {
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

export interface FirstTouchData extends AttributionData {
  landingPage?: string;
  referrer?: string;
}

export interface FullAttributionData {
  visitorId: string | null;
  firstTouch: FirstTouchData | null;
  lastTouch: AttributionData | null;
}

/**
 * Get all attribution data from localStorage
 * Call this on signup/login to send to the backend
 */
export function getAttributionData(): FullAttributionData {
  if (typeof window === 'undefined') {
    return {
      visitorId: null,
      firstTouch: null,
      lastTouch: null,
    };
  }

  try {
    const visitorId = localStorage.getItem(VISITOR_ID_KEY);
    const firstTouchStr = localStorage.getItem(FIRST_TOUCH_KEY);
    const lastTouchStr = localStorage.getItem(LAST_TOUCH_KEY);

    return {
      visitorId,
      firstTouch: firstTouchStr ? JSON.parse(firstTouchStr) : null,
      lastTouch: lastTouchStr ? JSON.parse(lastTouchStr) : null,
    };
  } catch (error) {
    console.error('Error reading attribution data:', error);
    return {
      visitorId: null,
      firstTouch: null,
      lastTouch: null,
    };
  }
}

/**
 * Send attribution data to the backend API
 * Call this on signup/login events to persist attribution to the database
 */
export async function syncAttributionToServer(): Promise<boolean> {
  const attribution = getAttributionData();

  if (!attribution.visitorId) {
    console.log('No visitor ID found, skipping attribution sync');
    return false;
  }

  // Get session entry data from attribution-tracker
  const { getSessionAttribution, getRegistrationSession, clearRegistrationSession } = 
    await import('@/components/tracking/attribution-tracker');
  const sessionAttribution = getSessionAttribution();

  // Get registration session (captured at registration time, if any)
  const registrationSession = getRegistrationSession();

  // Use session attribution for currentSession (captures actual entry page, not current page)
  const currentSession = {
    landingPage: sessionAttribution.sessionLandingPage,
    referrer: sessionAttribution.sessionReferrer,
    source: sessionAttribution.sessionSource,
    medium: sessionAttribution.sessionMedium,
    campaign: sessionAttribution.sessionCampaign,
  };

  try {
    const response = await fetch('/api/attribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        visitorId: attribution.visitorId,
        firstTouch: attribution.firstTouch,
        lastTouch: attribution.lastTouch,
        currentSession,
        // Registration session captured at registration time (priority over currentSession for reg* fields)
        registrationSession,
        landingPage: attribution.firstTouch?.landingPage,
        referrer: attribution.firstTouch?.referrer,
      }),
    });

    if (!response.ok) {
      console.error('Attribution sync failed:', response.status);
      return false;
    }

    // Clear registration session after successful sync
    clearRegistrationSession();

    console.log('Attribution synced successfully');
    return true;
  } catch (error) {
    console.error('Attribution sync error:', error);
    return false;
  }
}
