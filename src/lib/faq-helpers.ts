/**
 * FAQ Item type for consistent structure across all FAQ components
 */
export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

/**
 * Props for FaqSection component
 */
export interface FaqSectionProps {
  title: string;
  subtitle?: string;
  items: FaqItem[];
  className?: string;
}

/**
 * Raw FAQ item structure from translations (array format)
 */
type RawFaqItem = {
  question: string;
  answer: string;
};

/**
 * Type for translation object with raw() method
 */
type TranslatorWithRaw = {
  raw: (key: string) => unknown;
  (key: string): string;
};

/**
 * Get all FAQ items from a translation object.
 * Supports both array format (recommended) and object format.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @returns Array of FaqItem with auto-generated IDs
 *
 * @example
 * // Array format in messages/en.json (recommended):
 * // "faqs": {
 * //   "title": "FAQ",
 * //   "items": [
 * //     { "question": "Q1?", "answer": "A1" },
 * //     { "question": "Q2?", "answer": "A2" }
 * //   ]
 * // }
 *
 * // In page.tsx:
 * const t = await getTranslations('HomePage.faqs');
 * const items = getFaqItems(t);
 *
 * <FaqSection title={t('title')} items={items} />
 */
export function getFaqItems(t: TranslatorWithRaw): FaqItem[] {
  const itemsRaw = t.raw('items');

  // Handle array format (recommended)
  if (Array.isArray(itemsRaw)) {
    return (itemsRaw as RawFaqItem[]).map((item, index) => ({
      id: `faq-${index + 1}`,
      question: item.question,
      answer: item.answer,
    }));
  }

  // Handle object format (backward compatibility)
  if (typeof itemsRaw === 'object' && itemsRaw !== null) {
    return Object.entries(itemsRaw as Record<string, RawFaqItem>).map(
      ([key, item], index) => ({
        id: key || `faq-${index + 1}`,
        question: item.question,
        answer: item.answer,
      })
    );
  }

  return [];
}

/**
 * Get specific FAQ items by their indices (0-based).
 * Useful when you only want to display a subset of FAQs.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param indices - Array of indices to include (0-based)
 * @returns Array of FaqItem for the specified indices
 *
 * @example
 * // Only show the first 3 FAQs
 * const items = getFaqItemsByIndex(t, [0, 1, 2]);
 */
export function getFaqItemsByIndex(
  t: TranslatorWithRaw,
  indices: number[]
): FaqItem[] {
  const allItems = getFaqItems(t);
  return indices
    .filter((i) => i >= 0 && i < allItems.length)
    .map((i) => allItems[i]);
}

/**
 * Get the first N FAQ items.
 * Useful for showing a preview of FAQs.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param count - Number of items to return
 * @returns Array of first N FaqItems
 *
 * @example
 * // Show only first 3 FAQs on pricing page
 * const items = getFirstNFaqItems(t, 3);
 */
export function getFirstNFaqItems(
  t: TranslatorWithRaw,
  count: number
): FaqItem[] {
  return getFaqItems(t).slice(0, count);
}
