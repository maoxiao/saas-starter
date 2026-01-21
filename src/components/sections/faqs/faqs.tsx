import { HeaderSection } from '@/components/layout/header-section';
import { FaqAccordion } from '@/components/sections/faqs/faq-accordion';
import type { FaqItem, FaqSectionProps } from '@/lib/faq-helpers';

// Re-export types for convenience
export type { FaqItem, FaqSectionProps } from '@/lib/faq-helpers';

/**
 * FaqSection - A data-driven FAQ component
 *
 * This component follows the "Smart Parent, Dumb Child" pattern:
 * - The parent page is responsible for fetching/assembling FAQ data
 * - This component only renders the data it receives via props
 *
 * @example
 * // In page.tsx
 * import { getFaqItems } from '@/lib/faq-helpers';
 *
 * const faqT = await getTranslations('HomePage.faqs');
 * const items = getFaqItems(faqT as any);
 *
 * <FaqSection
 *   title={faqT('title')}
 *   subtitle={faqT('subtitle')}
 *   items={items}
 * />
 */
export default function FaqSection({
  title,
  subtitle,
  items,
  className,
}: FaqSectionProps) {
  return (
    <section id="faqs" className={`px-4 py-16 ${className ?? ''}`}>
      {/* SEO: Hidden semantic content for crawlers */}
      <div className="sr-only">
        {items.map((item) => (
          <div key={item.id}>
            <h2>{item.question}</h2>
            <p>{item.answer}</p>
          </div>
        ))}
      </div>

      {/* SEO: JSON-LD structured data for rich search results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
              },
            })),
          }),
        }}
      />

      <div className="mx-auto max-w-4xl">
        <HeaderSection
          title={title}
          titleAs="h2"
          subtitle={subtitle}
          subtitleAs="p"
        />

        <FaqAccordion faqData={items} />
      </div>
    </section>
  );
}
