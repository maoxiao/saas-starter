/**
 * Stat Item type for consistent structure across all Stats components
 */
export type StatItem = {
  id: string;
  value: string;
  label: string;
};

/**
 * Props for StatsSection component
 */
export interface StatsSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  items: StatItem[];
  className?: string;
}

/**
 * Raw Stat item structure from translations (array format)
 */
type RawStatItem = {
  value: string;
  label: string;
};

/**
 * Type for translation object with raw() method
 */
type TranslatorWithRaw = {
  raw: (key: string) => unknown;
  (key: string): string;
};

/**
 * Get all Stat items from a translation object.
 * Supports both array format (recommended) and object format.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @returns Array of StatItem with auto-generated IDs
 *
 * @example
 * // Array format in messages/en.json (recommended):
 * // "stats": {
 * //   "title": "Stats",
 * //   "items": [
 * //     { "value": "+1200", "label": "Active Users" },
 * //     { "value": "22 Million", "label": "Generated Works" }
 * //   ]
 * // }
 *
 * // In page.tsx:
 * const t = await getTranslations('HomePage.stats');
 * const items = getStatItems(t);
 *
 * <StatsSection title={t('title')} items={items} />
 */
export function getStatItems(t: TranslatorWithRaw): StatItem[] {
  const itemsRaw = t.raw('items');

  // Handle array format (recommended)
  if (Array.isArray(itemsRaw)) {
    return (itemsRaw as RawStatItem[]).map((item, index) => ({
      id: `stat-${index + 1}`,
      value: item.value,
      label: item.label,
    }));
  }

  // Handle object format (backward compatibility)
  if (typeof itemsRaw === 'object' && itemsRaw !== null) {
    return Object.entries(itemsRaw as Record<string, RawStatItem>).map(
      ([key, item], index) => ({
        id: key || `stat-${index + 1}`,
        value: item.value,
        label: item.label,
      })
    );
  }

  return [];
}

/**
 * Get specific Stat items by their indices (0-based).
 * Useful when you only want to display a subset of stats.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param indices - Array of indices to include (0-based)
 * @returns Array of StatItem for the specified indices
 *
 * @example
 * // Only show the first 2 stats
 * const items = getStatItemsByIndex(t, [0, 1]);
 */
export function getStatItemsByIndex(
  t: TranslatorWithRaw,
  indices: number[]
): StatItem[] {
  const allItems = getStatItems(t);
  return indices
    .filter((i) => i >= 0 && i < allItems.length)
    .map((i) => allItems[i]);
}

/**
 * Get the first N Stat items.
 * Useful for showing a preview of stats.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param count - Number of items to return
 * @returns Array of first N StatItems
 *
 * @example
 * // Show only first 2 stats on a page
 * const items = getFirstNStatItems(t, 2);
 */
export function getFirstNStatItems(
  t: TranslatorWithRaw,
  count: number
): StatItem[] {
  return getStatItems(t).slice(0, count);
}
