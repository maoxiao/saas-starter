/**
 * Feature Item type for consistent structure across all Feature components
 */
export type FeatureItem = {
  id: string;
  title: string;
  description: string;
};

/**
 * Props for FeaturesSection component
 */
export interface FeaturesSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  items: FeatureItem[];
  className?: string;
}

/**
 * Raw Feature item structure from translations (array or object format)
 */
type RawFeatureItem = {
  title: string;
  description: string;
};

/**
 * Type for translation object with raw() method
 */
type TranslatorWithRaw = {
  raw: (key: string) => unknown;
  (key: string): string;
};

/**
 * Get all Feature items from a translation object.
 * Supports both array format (recommended) and object format.
 * IDs are auto-generated based on index.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @returns Array of FeatureItem with auto-generated IDs
 *
 * @example
 * // Array format in messages/en.json (recommended):
 * // "features": {
 * //   "title": "Features",
 * //   "items": [
 * //     { "title": "Feature 1", "description": "..." },
 * //     { "title": "Feature 2", "description": "..." }
 * //   ]
 * // }
 *
 * // Object format (backward compatible):
 * // "features": {
 * //   "items": {
 * //     "item-1": { "title": "Feature 1", "description": "..." }
 * //   }
 * // }
 *
 * // In page.tsx:
 * const t = await getTranslations('HomePage.features');
 * const items = getFeatureItems(t);
 *
 * <FeaturesSection title={t('title')} items={items} />
 */
export function getFeatureItems(t: TranslatorWithRaw): FeatureItem[] {
  const itemsRaw = t.raw('items');

  // Handle array format (recommended)
  if (Array.isArray(itemsRaw)) {
    return (itemsRaw as RawFeatureItem[]).map((item, index) => ({
      id: `feature-${index + 1}`,
      title: item.title,
      description: item.description,
    }));
  }

  // Handle object format (backward compatibility)
  if (typeof itemsRaw === 'object' && itemsRaw !== null) {
    return Object.entries(itemsRaw as Record<string, RawFeatureItem>).map(
      ([_key, item], index) => ({
        id: `feature-${index + 1}`,
        title: item.title,
        description: item.description,
      })
    );
  }

  return [];
}

/**
 * Get specific Feature items by their indices (0-based).
 * Useful when you only want to display a subset of Features.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param indices - Array of indices to include (0-based)
 * @returns Array of FeatureItem for the specified indices
 *
 * @example
 * // Only show the first 3 features
 * const items = getFeatureItemsByIndex(t, [0, 1, 2]);
 */
export function getFeatureItemsByIndex(
  t: TranslatorWithRaw,
  indices: number[]
): FeatureItem[] {
  const allItems = getFeatureItems(t);
  return indices
    .filter((i) => i >= 0 && i < allItems.length)
    .map((i) => allItems[i]);
}

/**
 * Get the first N Feature items.
 * Useful for showing a preview of Features.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param count - Number of items to return
 * @returns Array of first N FeatureItems
 *
 * @example
 * // Show only first 3 features on a page
 * const items = getFirstNFeatureItems(t, 3);
 */
export function getFirstNFeatureItems(
  t: TranslatorWithRaw,
  count: number
): FeatureItem[] {
  return getFeatureItems(t).slice(0, count);
}
