/**
 * Date utility functions for UTC-safe date operations
 */

/**
 * Add days to a date using UTC timestamp arithmetic
 * This ensures consistent behavior across all timezones without relying on TZ environment variable
 * 
 * @param date - Base date (Date object or timestamp)
 * @param days - Number of days to add (can be negative to subtract)
 * @returns New Date object with added days
 * 
 * @example
 * const future = addDaysUTC(new Date(), 30); // 30 days from now
 * const past = addDaysUTC(Date.now(), -7);   // 7 days ago
 */
export function addDaysUTC(date: Date | number, days: number): Date {
  const timestamp = typeof date === 'number' ? date : date.getTime();
  return new Date(timestamp + days * 24 * 60 * 60 * 1000);
}

/**
 * Get the start of a month in UTC
 * 
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12, NOT 0-11)
 * @returns Date object representing the start of the month in UTC
 * 
 * @example
 * const jan2026 = getMonthStartUTC(2026, 1); // 2026-01-01T00:00:00.000Z
 */
export function getMonthStartUTC(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/**
 * Get the end of a month in UTC (last millisecond)
 * 
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12, NOT 0-11)
 * @returns Date object representing the end of the month in UTC
 * 
 * @example
 * const endJan2026 = getMonthEndUTC(2026, 1); // 2026-01-31T23:59:59.999Z
 */
export function getMonthEndUTC(year: number, month: number): Date {
  // Start of next month minus 1 millisecond
  return new Date(Date.UTC(year, month, 1) - 1);
}

/**
 * Get the current month's start and end in UTC
 * 
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Object with start and end dates
 * 
 * @example
 * const { start, end } = getCurrentMonthUTC();
 */
export function getCurrentMonthUTC(referenceDate?: Date): { start: Date; end: Date } {
  const now = referenceDate || new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // Convert to 1-based
  
  return {
    start: getMonthStartUTC(year, month),
    end: getMonthEndUTC(year, month),
  };
}
