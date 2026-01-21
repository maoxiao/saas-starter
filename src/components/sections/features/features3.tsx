import { HeaderSection } from '@/components/layout/header-section';
import {
  CpuIcon,
  FingerprintIcon,
  PencilIcon,
  Settings2Icon,
  SparklesIcon,
  ZapIcon,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

// Icon array to match with items by index
const icons = [
  ZapIcon,
  CpuIcon,
  FingerprintIcon,
  PencilIcon,
  Settings2Icon,
  SparklesIcon,
];

/**
 * https://nsui.irung.me/features
 * pnpm dlx shadcn@canary add https://nsui.irung.me/r/features-4.json
 */
export default async function Features3Section() {
  const t = await getTranslations('HomePage.features3');

  // Get items array using raw()
  const items =
    (t.raw('items') as Array<{ title: string; description: string }>) || [];

  return (
    <section id="features3" className="px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-8 lg:space-y-20">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          subtitleAs="h2"
          description={t('description')}
          descriptionAs="p"
        />

        <div className="relative mx-auto grid divide-x divide-y border *:p-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const Icon = icons[index] || ZapIcon;
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4" />
                  <h3 className="text-base font-medium">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
