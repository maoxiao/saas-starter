/**
 * Integration Item type for consistent structure across all Integration components
 */
export type IntegrationItem = {
  id: string;
  title: string;
  description: string;
  icon: string; // Icon name, e.g. 'gemini', 'replit'
  link?: string;
};

/**
 * Props for IntegrationSection component
 */
export interface IntegrationSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  learnMore: string;
  items: IntegrationItem[];
  className?: string;
}

/**
 * Raw Integration item structure from translations (array format)
 */
type RawIntegrationItem = {
  title: string;
  description: string;
  icon: string;
  link?: string;
};

/**
 * Type for translation object with raw() method
 */
type TranslatorWithRaw = {
  raw: (key: string) => unknown;
  (key: string): string;
};

/**
 * Get all Integration items from a translation object.
 * Supports both array format (recommended) and object format.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @returns Array of IntegrationItem with auto-generated IDs
 *
 * @example
 * // Array format in messages/en.json (recommended):
 * // "integration": {
 * //   "title": "Integrations",
 * //   "subtitle": "Integrate with your favorite tools",
 * //   "items": [
 * //     { "title": "Gemini", "description": "...", "icon": "gemini" },
 * //     { "title": "Replit", "description": "...", "icon": "replit" }
 * //   ]
 * // }
 *
 * // In page.tsx:
 * const t = await getTranslations('HomePage.integration');
 * const items = getIntegrationItems(t);
 *
 * <IntegrationSection title={t('title')} subtitle={t('subtitle')} items={items} />
 */
export function getIntegrationItems(t: TranslatorWithRaw): IntegrationItem[] {
  const itemsRaw = t.raw('items');

  // Handle array format (recommended)
  if (Array.isArray(itemsRaw)) {
    return (itemsRaw as RawIntegrationItem[]).map((item, index) => ({
      id: `integration-${index + 1}`,
      title: item.title,
      description: item.description,
      icon: item.icon,
      link: item.link,
    }));
  }

  // Handle object format (backward compatibility)
  if (typeof itemsRaw === 'object' && itemsRaw !== null) {
    return Object.entries(itemsRaw as Record<string, RawIntegrationItem>).map(
      ([key, item], index) => ({
        id: key || `integration-${index + 1}`,
        title: item.title,
        description: item.description,
        icon: item.icon,
        link: item.link,
      })
    );
  }

  return [];
}

/**
 * Get specific Integration items by their indices (0-based).
 * Useful when you only want to display a subset of integrations.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param indices - Array of indices to include (0-based)
 * @returns Array of IntegrationItem for the specified indices
 *
 * @example
 * // Only show the first 3 integrations
 * const items = getIntegrationItemsByIndex(t, [0, 1, 2]);
 */
export function getIntegrationItemsByIndex(
  t: TranslatorWithRaw,
  indices: number[]
): IntegrationItem[] {
  const allItems = getIntegrationItems(t);
  return indices
    .filter((i) => i >= 0 && i < allItems.length)
    .map((i) => allItems[i]);
}

/**
 * Get the first N Integration items.
 * Useful for showing a preview of integrations.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param count - Number of items to return
 * @returns Array of first N IntegrationItems
 *
 * @example
 * // Show only first 3 integrations on homepage
 * const items = getFirstNIntegrationItems(t, 3);
 */
export function getFirstNIntegrationItems(
  t: TranslatorWithRaw,
  count: number
): IntegrationItem[] {
  return getIntegrationItems(t).slice(0, count);
}
