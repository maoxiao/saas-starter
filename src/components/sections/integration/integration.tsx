import { HeaderSection } from '@/components/layout/header-section';
import {
  Gemini,
  GooglePaLM,
  MagicUI,
  MediaWiki,
  Replit,
  VSCodium,
} from '@/components/tailark/logos';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import {
  getIntegrationItems,
  type IntegrationItem,
  type IntegrationSectionProps,
} from '@/lib/integration-helpers';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';

/**
 * Icon mapping from icon name to React component
 * Add new icons here when adding new integrations
 */
const ICON_MAP: Record<string, React.ComponentType> = {
  gemini: Gemini,
  replit: Replit,
  magicui: MagicUI,
  vscodium: VSCodium,
  mediawiki: MediaWiki,
  googlepalm: GooglePaLM,
};

/**
 * IntegrationSection - Server Component
 * Receives data via props, renders integration cards with dynamic icons
 */
export default function IntegrationSection({
  title,
  subtitle,
  description,
  learnMore,
  items,
}: IntegrationSectionProps) {
  return (
    <section id="integration" className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <HeaderSection
          title={title}
          subtitle={subtitle}
          description={description}
          subtitleAs="h2"
          descriptionAs="p"
        />

        {/* SEO: Hidden text for screen readers */}
        <div className="sr-only">
          <h2>{title}</h2>
          <p>{description}</p>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>: {item.description}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <IntegrationCard
              key={item.id}
              item={item}
              learnMore={learnMore}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * IntegrationCard - Renders a single integration card
 */
const IntegrationCard = ({
  item,
  learnMore,
}: {
  item: IntegrationItem;
  learnMore: string;
}) => {
  const IconComponent = ICON_MAP[item.icon];

  return (
    <Card className="p-6 bg-transparent hover:bg-accent dark:hover:bg-card">
      <div className="relative">
        <div className="*:size-10">
          {IconComponent ? <IconComponent /> : null}
        </div>

        <div className="space-y-2 py-6">
          <h3 className="text-base font-medium">{item.title}</h3>
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {item.description}
          </p>
        </div>

        <div className="flex gap-3 border-t border-dashed pt-6">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1 pr-2 shadow-none"
          >
            <LocaleLink href={item.link || '#'}>
              {learnMore}
              <ChevronRight className="ml-0 !size-3.5 opacity-50" />
            </LocaleLink>
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Re-export helpers for convenience
export { getIntegrationItems };
