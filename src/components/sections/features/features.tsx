import { HeaderSection } from '@/components/layout/header-section';
import { FeaturesAccordion } from '@/components/sections/features/features-accordion';
import type { FeatureItem, FeaturesSectionProps } from '@/lib/feature-helpers';

// Re-export types for convenience
export type { FeatureItem, FeaturesSectionProps } from '@/lib/feature-helpers';

/**
 * FeaturesSection - A data-driven Features component (Server Component)
 *
 * This component follows the "Smart Parent, Dumb Child" pattern:
 * - The parent page is responsible for fetching/assembling Feature data
 * - This component only renders the data it receives via props
 * - Interactive accordion is delegated to a Client Component
 *
 * SEO optimizations:
 * - Hidden semantic content for crawlers (sr-only)
 * - JSON-LD structured data for rich search results
 *
 * @example
 * // In page.tsx
 * import { getFeatureItems } from '@/lib/feature-helpers';
 *
 * const featuresT = await getTranslations('HomePage.features');
 * const items = getFeatureItems(featuresT as any);
 *
 * <FeaturesSection
 *   title={featuresT('title')}
 *   subtitle={featuresT('subtitle')}
 *   description={featuresT('description')}
 *   items={items}
 * />
 */
export default function FeaturesSection({
  title,
  subtitle,
  description,
  items,
  className,
}: FeaturesSectionProps) {
  return (
    <section id="features" className={`px-4 py-16 ${className ?? ''}`}>
      {/* SEO: Hidden semantic content for crawlers */}
      <div className="sr-only">
        <h2>{subtitle || title}</h2>
        <p>{description}</p>
        {items.map((item) => (
          <div key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </div>

      {/* SEO: JSON-LD structured data for rich search results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: subtitle || title,
            description: description,
            itemListElement: items.map((item, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: item.title,
              description: item.description,
            })),
          }),
        }}
      />

      <div className="mx-auto max-w-6xl space-y-8 lg:space-y-20 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        <HeaderSection
          title={title}
          subtitle={subtitle}
          subtitleAs="h2"
          description={description}
          descriptionAs="p"
        />

        <FeaturesAccordion
          items={items}
          title={title}
          description={description ?? ''}
        />
      </div>
    </section>
  );
}
