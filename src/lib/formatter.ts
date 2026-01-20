/**
 * Format a price for display
 * @param price Price amount in currency units (dollars, euros, etc.)
 * @param currency Currency code
 * @returns Formatted price string
 */
export function formatPrice(price: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  });

  return formatter.format(price / 100); // Convert from cents to dollars
}

/**
 * Format a date for display
 * 
 * NOTE: This function intentionally uses local timezone methods (getFullYear, getMonth, getDate)
 * for display purposes. It formats dates in the user's local timezone, not UTC.
 * For server-side date calculations, use UTC methods from @/lib/date-utils instead.
 * 
 * @param date Date to format
 * @returns Formatted date string in the format "YYYY/MM/DD"
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}
