'use server';

import { deductCredits } from '@/credits/grant';
import type { User } from '@/lib/auth-types';
import { userActionClient } from '@/lib/safe-action';
import { z } from 'zod';

// consume credits schema
const consumeSchema = z.object({
  amount: z.number().min(1),
  eventId: z.string().min(1, 'eventId is required for idempotency'),
  description: z.string().optional(),
});

/**
 * Consume credits (using new Grant system)
 *
 * IMPORTANT: Caller must provide a stable eventId for idempotency.
 * Use the same eventId for retries to prevent double-charging.
 * Example: `task_${taskId}` or `generation_${generationId}`
 */
export const consumeCreditsAction = userActionClient
  .schema(consumeSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { amount, eventId, description } = parsedInput;
    const currentUser = (ctx as { user: User }).user;

    try {
      await deductCredits({
        userId: currentUser.id,
        amount,
        eventId,
        reason: description || `Consume credits: ${amount}`,
      });
      return { success: true };
    } catch (error) {
      console.error('consume credits error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
