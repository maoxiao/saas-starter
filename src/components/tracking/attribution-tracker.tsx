'use client';

import { useEffect, useRef } from 'react';

const VISITOR_ID_KEY = 'pv_visitor_id';
const FIRST_TOUCH_KEY = 'pv_first_touch';
const LAST_TOUCH_KEY = 'pv_last_touch';
const SESSION_ENTRY_KEY = 'pv_session_entry'; // Session entry page (localStorage with expiration)
const SESSION_ENTRY_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes - survives OAuth redirect but expires for new sessions
const REGISTRATION_SESSION_KEY = 'pv_registration_session'; // Captured at registration time, never expires

interface AttributionData {
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

interface TouchDataWithPage extends AttributionData {
  landingPage?: string;
  referrer?: string;
}

interface SessionEntryData extends TouchDataWithPage {
  timestamp: number; // For expiration check
}

/**
 * Generate a unique visitor ID
 */
function generateVisitorId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get UTM parameters from current URL
 */
function getUtmParams(): AttributionData {
  if (typeof window === 'undefined') {
    return { source: null, medium: null, campaign: null };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
  };
}

/**
 * Check if attribution data has UTM values
 */
function hasUtmData(data: AttributionData): boolean {
  return !!(data.source || data.medium || data.campaign);
}

/**
 * Check if there's an external referrer (not from the same domain)
 */
function getExternalReferrer(): string | null {
  if (typeof window === 'undefined' || !document.referrer) {
    return null;
  }

  try {
    const referrerUrl = new URL(document.referrer);
    const currentHost = window.location.hostname;

    // Check if referrer is from a different domain
    if (referrerUrl.hostname !== currentHost) {
      return document.referrer;
    }
  } catch {
    // Invalid URL, treat as no referrer
  }

  return null;
}

/**
 * Parse referrer to extract source and medium
 * Following Google Analytics conventions for organic search engines
 */
function parseReferrerToAttribution(referrer: string): AttributionData {
  try {
    const url = new URL(referrer);
    const hostname = url.hostname.toLowerCase();

    // Common search engines - treat as organic
    const searchEngines: Record<string, string> = {
      google: 'google',
      bing: 'bing',
      yahoo: 'yahoo',
      duckduckgo: 'duckduckgo',
      baidu: 'baidu',
      yandex: 'yandex',
      ecosia: 'ecosia',
      ask: 'ask',
    };

    for (const [engine, source] of Object.entries(searchEngines)) {
      if (hostname.includes(engine)) {
        return { source, medium: 'organic', campaign: null };
      }
    }

    // Common social platforms
    const socialPlatforms: Record<string, string> = {
      facebook: 'facebook',
      twitter: 'twitter',
      'x.com': 'twitter',
      linkedin: 'linkedin',
      instagram: 'instagram',
      pinterest: 'pinterest',
      reddit: 'reddit',
      youtube: 'youtube',
      tiktok: 'tiktok',
    };

    for (const [platform, source] of Object.entries(socialPlatforms)) {
      if (hostname.includes(platform)) {
        return { source, medium: 'social', campaign: null };
      }
    }

    // Default: use domain as source, referral as medium
    return { source: hostname, medium: 'referral', campaign: null };
  } catch {
    return { source: null, medium: null, campaign: null };
  }
}

// Key for tracking which userId has been linked to this visitor
const ATTRIBUTION_LINKED_USER_KEY = 'pv_linked_user_id';

/**
 * AttributionTracker Component
 *
 * Tracks user attribution data in localStorage.
 * Data is read by checkout buttons when creating payment sessions.
 * Automatically syncs attribution when user logs in (after OAuth returns).
 *
 * Attribution Logic:
 * - First-touch: Records the FIRST visit ever (localStorage, never overwritten)
 * - Session-entry: Records the FIRST page of current session (localStorage with 30min expiry)
 * - Last-touch: Updated only when UTM params are present (localStorage)
 */
export function AttributionTracker() {
  const hasRunRef = useRef(false);
  const hasSyncedRef = useRef(false);

  // Monitor auth state to sync attribution after login completes
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    let retryCount = 0;
    const maxRetries = 4;
    const baseDelay = 500; // Start with 500ms, then 1s, 2s, 4s
    let timeoutId: NodeJS.Timeout | null = null;

    // Dynamic import to avoid SSR issues
    const checkAndSync = async (): Promise<boolean> => {
      // Don't sync multiple times in same page load
      if (hasSyncedRef.current) return true;

      try {
        // Check if user is authenticated
        const { authClient } = await import('@/lib/auth-client');
        const session = await authClient.getSession();

        const currentUserId = session?.data?.user?.id;
        if (!currentUserId) {
          // Not logged in yet - might need to retry
          return false;
        }

        // Check if this user has already been linked
        const linkedUserId = localStorage.getItem(ATTRIBUTION_LINKED_USER_KEY);

        // Detect user switch: different user logged in
        if (linkedUserId && linkedUserId !== currentUserId) {
          console.log(
            'User switch detected, resetting attribution data for new user'
          );
          // Generate new visitorId for the new user
          const newVisitorId = generateVisitorId();
          localStorage.setItem(VISITOR_ID_KEY, newVisitorId);
          // Clear session entry, first/last touch, registration session so new user starts fresh
          localStorage.removeItem(SESSION_ENTRY_KEY);
          localStorage.removeItem(FIRST_TOUCH_KEY);
          localStorage.removeItem(LAST_TOUCH_KEY);
          localStorage.removeItem(REGISTRATION_SESSION_KEY);
          // Clear linked user so next check will trigger sync
          localStorage.removeItem(ATTRIBUTION_LINKED_USER_KEY);
          // Reload page to re-capture fresh attribution data and sync
          console.log(
            'Reloading page to capture fresh attribution for new user'
          );
          window.location.reload();
          return true; // Won't reach here due to reload
        }

        if (linkedUserId === currentUserId) {
          // Already linked this user - no need to retry
          console.log(
            'Attribution already linked for this user, skipping sync'
          );
          return true;
        }

        // User is authenticated and not yet linked - sync attribution
        const { syncAttributionToServer } = await import('@/lib/attribution');
        const success = await syncAttributionToServer();

        if (success) {
          // Mark this user as linked
          localStorage.setItem(ATTRIBUTION_LINKED_USER_KEY, currentUserId);
          hasSyncedRef.current = true;
          console.log('Attribution synced and user linked:', currentUserId);
        }
        return true; // Done, no need to retry
      } catch (error) {
        // Auth check failed - might need to retry
        console.log('Attribution sync check failed, may retry');
        return false;
      }
    };

    const attemptSync = async () => {
      const done = await checkAndSync();

      if (!done && retryCount < maxRetries) {
        // Not authenticated yet - retry with exponential backoff
        retryCount++;
        const delay = baseDelay * Math.pow(2, retryCount - 1); // 500ms, 1s, 2s, 4s
        console.log(
          `Attribution sync: retry ${retryCount}/${maxRetries} in ${delay}ms`
        );
        timeoutId = setTimeout(attemptSync, delay);
      }
    };

    // Start first check after a short delay to allow initial page load
    timeoutId = setTimeout(attemptSync, 300);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    // Prevent double execution in strict mode
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    try {
      // Get or create visitor ID
      let visitorId = localStorage.getItem(VISITOR_ID_KEY);
      if (!visitorId) {
        visitorId = generateVisitorId();
        localStorage.setItem(VISITOR_ID_KEY, visitorId);
      }

      // Get current UTM params and referrer
      const utmParams = getUtmParams();
      const externalReferrer = getExternalReferrer();
      const landingPage = window.location.pathname + window.location.search;

      // Session entry: capture the FIRST page of this session (uses localStorage with expiration)
      // This survives OAuth redirects but expires after 30 minutes for genuine new sessions
      const storedSessionEntry = localStorage.getItem(SESSION_ENTRY_KEY);
      let sessionEntryValid = false;

      if (storedSessionEntry) {
        try {
          const parsed: SessionEntryData = JSON.parse(storedSessionEntry);
          // Check if session entry is still valid (not expired)
          if (
            parsed.timestamp &&
            Date.now() - parsed.timestamp < SESSION_ENTRY_EXPIRY_MS
          ) {
            sessionEntryValid = true;
          }
        } catch {
          // Invalid data, will be overwritten
        }
      }

      if (!sessionEntryValid) {
        const sessionEntry: SessionEntryData = {
          ...utmParams,
          landingPage,
          referrer: externalReferrer || undefined,
          timestamp: Date.now(),
        };
        // If no UTM but has referrer, parse it
        if (!hasUtmData(utmParams) && externalReferrer) {
          const parsed = parseReferrerToAttribution(externalReferrer);
          sessionEntry.source = parsed.source;
          sessionEntry.medium = parsed.medium;
          sessionEntry.campaign = parsed.campaign;
        }
        // If direct visit
        if (!hasUtmData(sessionEntry) && !externalReferrer) {
          sessionEntry.source = 'direct';
          sessionEntry.medium = 'none';
        }
        localStorage.setItem(SESSION_ENTRY_KEY, JSON.stringify(sessionEntry));
      }

      // First-touch: set once, never updated (localStorage)
      const storedFirstTouch = localStorage.getItem(FIRST_TOUCH_KEY);
      if (!storedFirstTouch) {
        let firstTouch: TouchDataWithPage;

        if (hasUtmData(utmParams)) {
          firstTouch = {
            ...utmParams,
            landingPage,
            referrer: externalReferrer || undefined,
          };
        } else if (externalReferrer) {
          const referrerAttribution =
            parseReferrerToAttribution(externalReferrer);
          firstTouch = {
            ...referrerAttribution,
            landingPage,
            referrer: externalReferrer,
          };
        } else {
          firstTouch = {
            source: 'direct',
            medium: 'none',
            campaign: null,
            landingPage,
            referrer: undefined,
          };
        }

        localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
      }

      // Last-touch: update when UTM params present (include landingPage and referrer)
      if (hasUtmData(utmParams)) {
        const lastTouch: TouchDataWithPage = {
          ...utmParams,
          landingPage,
          referrer: externalReferrer || undefined,
        };
        localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(lastTouch));
      }
    } catch (error) {
      console.error('Attribution tracking error:', error);
    }
  }, []);

  return null;
}

/**
 * Get session attribution data for checkout
 * Returns the current session's entry page and UTM, with fallback chain
 */
export function getSessionAttribution(): {
  sessionLandingPage?: string;
  sessionReferrer?: string;
  sessionSource?: string;
  sessionMedium?: string;
  sessionCampaign?: string;
} {
  try {
    // Priority: session entry (if not expired) -> last touch -> first touch
    const sessionEntryStr = localStorage.getItem(SESSION_ENTRY_KEY);
    const lastTouch = localStorage.getItem(LAST_TOUCH_KEY);
    const firstTouch = localStorage.getItem(FIRST_TOUCH_KEY);

    // Parse session entry with expiration check
    let session: TouchDataWithPage | null = null;
    if (sessionEntryStr) {
      const parsed: SessionEntryData = JSON.parse(sessionEntryStr);
      // Only use if not expired
      if (
        parsed.timestamp &&
        Date.now() - parsed.timestamp < SESSION_ENTRY_EXPIRY_MS
      ) {
        session = parsed;
      }
    }

    const last: TouchDataWithPage | null = lastTouch
      ? JSON.parse(lastTouch)
      : null;
    const first: TouchDataWithPage | null = firstTouch
      ? JSON.parse(firstTouch)
      : null;

    return {
      sessionLandingPage:
        session?.landingPage || last?.landingPage || first?.landingPage,
      sessionReferrer: session?.referrer || last?.referrer || first?.referrer,
      sessionSource:
        session?.source || last?.source || first?.source || undefined,
      sessionMedium:
        session?.medium || last?.medium || first?.medium || undefined,
      sessionCampaign:
        session?.campaign || last?.campaign || first?.campaign || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Capture the current session as registration session
 * Call this at the moment of user registration (before email verification flow)
 * This data will be used to fill reg* fields when the user eventually authenticates
 */
export function captureRegistrationSession(): void {
  try {
    // Get current session attribution (prioritizes session entry)
    const sessionAttribution = getSessionAttribution();

    // Store as registration session (never expires - will be used when user finally logs in)
    const regSession = {
      landingPage: sessionAttribution.sessionLandingPage,
      referrer: sessionAttribution.sessionReferrer,
      source: sessionAttribution.sessionSource,
      medium: sessionAttribution.sessionMedium,
      campaign: sessionAttribution.sessionCampaign,
      capturedAt: Date.now(),
    };

    localStorage.setItem(REGISTRATION_SESSION_KEY, JSON.stringify(regSession));
    console.log('Registration session captured:', regSession);
  } catch (error) {
    console.error('Failed to capture registration session:', error);
  }
}

/**
 * Get the stored registration session data
 * Returns null if no registration session was captured
 */
export function getRegistrationSession(): {
  landingPage?: string;
  referrer?: string;
  source?: string;
  medium?: string;
  campaign?: string;
} | null {
  try {
    const stored = localStorage.getItem(REGISTRATION_SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear the registration session (call after successful sync)
 */
export function clearRegistrationSession(): void {
  try {
    localStorage.removeItem(REGISTRATION_SESSION_KEY);
  } catch {
    // Ignore errors
  }
}
