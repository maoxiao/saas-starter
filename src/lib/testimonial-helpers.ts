/**
 * Testimonial Item type for consistent structure across all Testimonial components
 */
export type TestimonialItem = {
  id: string;
  name: string;
  role: string;
  image: string;
  quote: string;
};

/**
 * Props for TestimonialsSection component
 */
export interface TestimonialsSectionProps {
  title: string;
  subtitle?: string;
  items: TestimonialItem[];
  className?: string;
}

/**
 * Raw Testimonial item structure from translations (array format)
 */
type RawTestimonialItem = {
  name: string;
  role: string;
  image: string;
  quote: string;
};

/**
 * Type for translation object with raw() method
 */
type TranslatorWithRaw = {
  raw: (key: string) => unknown;
  (key: string): string;
};

/**
 * Get all Testimonial items from a translation object.
 * Supports both array format (recommended) and object format.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @returns Array of TestimonialItem with auto-generated IDs
 *
 * @example
 * // Array format in messages/en.json (recommended):
 * // "testimonials": {
 * //   "title": "Testimonials",
 * //   "subtitle": "What our customers are saying",
 * //   "items": [
 * //     { "name": "John", "role": "CEO", "image": "/avatars/1.jpg", "quote": "..." },
 * //     { "name": "Jane", "role": "CTO", "image": "/avatars/2.jpg", "quote": "..." }
 * //   ]
 * // }
 *
 * // In page.tsx:
 * const t = await getTranslations('HomePage.testimonials');
 * const items = getTestimonialItems(t);
 *
 * <TestimonialsSection title={t('title')} subtitle={t('subtitle')} items={items} />
 */
export function getTestimonialItems(t: TranslatorWithRaw): TestimonialItem[] {
  const itemsRaw = t.raw('items');

  // Handle array format (recommended)
  if (Array.isArray(itemsRaw)) {
    return (itemsRaw as RawTestimonialItem[]).map((item, index) => ({
      id: `testimonial-${index + 1}`,
      name: item.name,
      role: item.role,
      image: item.image,
      quote: item.quote,
    }));
  }

  // Handle object format (backward compatibility)
  if (typeof itemsRaw === 'object' && itemsRaw !== null) {
    return Object.entries(itemsRaw as Record<string, RawTestimonialItem>).map(
      ([key, item], index) => ({
        id: key || `testimonial-${index + 1}`,
        name: item.name,
        role: item.role,
        image: item.image,
        quote: item.quote,
      })
    );
  }

  return [];
}

/**
 * Get specific Testimonial items by their indices (0-based).
 * Useful when you only want to display a subset of testimonials.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param indices - Array of indices to include (0-based)
 * @returns Array of TestimonialItem for the specified indices
 *
 * @example
 * // Only show the first 3 testimonials
 * const items = getTestimonialItemsByIndex(t, [0, 1, 2]);
 */
export function getTestimonialItemsByIndex(
  t: TranslatorWithRaw,
  indices: number[]
): TestimonialItem[] {
  const allItems = getTestimonialItems(t);
  return indices
    .filter((i) => i >= 0 && i < allItems.length)
    .map((i) => allItems[i]);
}

/**
 * Get the first N Testimonial items.
 * Useful for showing a preview of testimonials.
 *
 * @param t - Translation function from getTranslations() with raw() method
 * @param count - Number of items to return
 * @returns Array of first N TestimonialItems
 *
 * @example
 * // Show only first 6 testimonials on pricing page
 * const items = getFirstNTestimonialItems(t, 6);
 */
export function getFirstNTestimonialItems(
  t: TranslatorWithRaw,
  count: number
): TestimonialItem[] {
  return getTestimonialItems(t).slice(0, count);
}
