import { HeaderSection } from '@/components/layout/header-section';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import type {
  TestimonialItem,
  TestimonialsSectionProps,
} from '@/lib/testimonial-helpers';

/**
 * Chunk an array into smaller arrays of a specified size
 */
const chunkArray = (
  array: TestimonialItem[],
  chunkSize: number
): TestimonialItem[][] => {
  const result: TestimonialItem[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
};

/**
 * TestimonialsSection - Server Component
 *
 * Displays customer testimonials in a responsive grid layout.
 * Accepts props from parent component for i18n support.
 *
 * @example
 * const t = await getTranslations('HomePage.testimonials');
 * const items = getTestimonialItems(t);
 * <TestimonialsSection
 *   title={t('title')}
 *   subtitle={t('subtitle')}
 *   items={items}
 * />
 */
export default function TestimonialsSection({
  title,
  subtitle,
  items,
  className,
}: TestimonialsSectionProps) {
  const testimonialChunks = chunkArray(items, Math.ceil(items.length / 3));

  return (
    <section id="testimonials" className={`px-4 py-16 ${className || ''}`}>
      <div className="mx-auto max-w-6xl">
        <HeaderSection
          title={title}
          titleAs="h2"
          subtitle={subtitle}
          subtitleAs="p"
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:mt-12 lg:grid-cols-3">
          {testimonialChunks.map((chunk, chunkIndex) => (
            <div key={chunkIndex} className="space-y-3">
              {chunk.map(({ id, name, role, quote, image }) => (
                <Card
                  key={id}
                  className="shadow-none bg-transparent hover:bg-accent dark:hover:bg-card"
                >
                  <CardContent className="grid grid-cols-[auto_1fr] gap-3 pt-4">
                    <Avatar className="size-9 border-2 border-gray-200">
                      <AvatarImage
                        alt={name}
                        src={image}
                        loading="lazy"
                        width="120"
                        height="120"
                      />
                      <AvatarFallback />
                    </Avatar>

                    <div>
                      <h3 className="font-medium">{name}</h3>

                      <span className="text-muted-foreground block text-sm tracking-wide">
                        {role}
                      </span>

                      <blockquote className="mt-3">
                        <p className="text-gray-700 dark:text-gray-300">
                          {quote}
                        </p>
                      </blockquote>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* SEO: Hidden content for search engines */}
      <div className="sr-only" aria-hidden="true">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong> - {item.role}: {item.quote}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
