'use server';

import { getExpiringCredits } from '@/credits/grant';
import type { User } from '@/lib/auth-types';
import { CREDITS_EXPIRATION_DAYS } from '@/lib/constants';
import { userActionClient } from '@/lib/safe-action';

/**
 * Get credit statistics for a user (from new Grant system)
 */
export const getCreditStatsAction = userActionClient.action(async ({ ctx }) => {
  try {
    const currentUser = (ctx as { user: User }).user;
    const userId = currentUser.id;

    // Get credits expiring in the next X days
    const expiringData = await getExpiringCredits(
      userId,
      CREDITS_EXPIRATION_DAYS
    );

    return {
      success: true,
      data: {
        expiringCredits: {
          amount: expiringData.amount,
        },
      },
    };
  } catch (error) {
    console.error('get credit stats error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch credit statistics',
    };
  }
});
