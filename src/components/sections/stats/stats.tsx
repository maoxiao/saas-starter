import { HeaderSection } from '@/components/layout/header-section';
import type { StatsSectionProps } from '@/lib/stats-helpers';

export default function StatsSection({
  title,
  subtitle,
  description,
  items,
}: StatsSectionProps) {
  return (
    <section id="stats" className="px-4 py-16">
      <div className="mx-auto max-w-5xl px-6 space-y-8 md:space-y-16">
        <HeaderSection
          title={title}
          subtitle={subtitle}
          subtitleAs="h2"
          description={description}
          descriptionAs="p"
        />

        <div className="grid gap-12 divide-y-0 *:text-center md:grid-cols-3 md:gap-2 md:divide-x">
          {items.map((item) => (
            <div key={item.id} className="space-y-4">
              <div className="text-5xl font-bold text-primary">{item.value}</div>
              <p>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
