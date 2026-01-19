'use server';

import { getTransactionLogs } from '@/credits/grant';
import type { User } from '@/lib/auth-types';
import { userActionClient } from '@/lib/safe-action';
import { z } from 'zod';

// Define the schema for getCreditTransactions parameters
const getCreditTransactionsSchema = z.object({
  pageIndex: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(100).default(10),
  search: z.string().optional().default(''),
  sorting: z
    .array(
      z.object({
        id: z.string(),
        desc: z.boolean(),
      })
    )
    .optional()
    .default([]),
  filters: z
    .array(
      z.object({
        id: z.string(),
        value: z.string(),
      })
    )
    .optional()
    .default([]),
});

// Create a safe action for getting credit transactions (from new Grant system)
export const getCreditTransactionsAction = userActionClient
  .schema(getCreditTransactionsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const { pageIndex, pageSize, search, sorting, filters } = parsedInput;
      const currentUser = (ctx as { user: User }).user;

      // Get sort configuration
      const sortConfig = sorting[0];
      const sortField = sortConfig?.id || 'createdAt';
      const sortDesc = sortConfig?.desc ?? true;

      // Get filter by type
      const typeFilter = filters.find((f) => f.id === 'type');

      // Query new credit_log table
      const result = await getTransactionLogs(currentUser.id, {
        pageIndex,
        pageSize,
        search: search || undefined,
        sortField,
        sortDesc,
        filterType: typeFilter?.value,
      });

      return {
        success: true,
        data: {
          items: result.items,
          total: result.total,
        },
      };
    } catch (error) {
      console.error('get credit transactions error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch credit transactions',
      };
    }
  });
