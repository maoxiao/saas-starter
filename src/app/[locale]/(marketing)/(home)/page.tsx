import CallToActionSection from '@/components/sections/calltoaction/calltoaction';
import FaqSection from '@/components/sections/faqs/faqs';
import FeaturesSection from '@/components/sections/features/features';
import Features2Section from '@/components/sections/features/features2';
import Features3Section from '@/components/sections/features/features3';
import HeroSection from '@/components/sections/hero/hero';
import IntegrationSection from '@/components/sections/integration/integration';
import Integration2Section from '@/components/sections/integration/integration2';
import LogoCloud from '@/components/sections/logo-cloud/logo-cloud';
import PricingSection from '@/components/sections/pricing/pricing';
import StatsSection from '@/components/sections/stats/stats';
import TestimonialsSection from '@/components/sections/testimonials/testimonials';
import CrispChat from '@/components/layout/crisp-chat';
import { NewsletterCard } from '@/components/newsletter/newsletter-card';
import { constructMetadata } from '@/lib/metadata';
import { getFaqItems } from '@/lib/faq-helpers';
import { getFeatureItems } from '@/lib/feature-helpers';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

/**
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#metadata-api
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return constructMetadata({
    title: t('title'),
    description: t('description'),
    locale,
    pathname: '',
  });
}

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage(props: HomePageProps) {
  const params = await props.params;
  const { locale } = params;
  const t = await getTranslations('HomePage');

  // Fetch FAQ data using helper function - pass translation object
  const faqT = await getTranslations('HomePage.faqs');
  const faqItems = getFaqItems(faqT as any);

  // Fetch Features data using helper function - pass translation object
  const featuresT = await getTranslations('HomePage.features');
  const featureItems = getFeatureItems(featuresT as any);

  return (
    <>
      <div className="flex flex-col">
        <HeroSection />

        <LogoCloud />

        <StatsSection />

        <IntegrationSection />

        <FeaturesSection
          title={featuresT('title')}
          subtitle={featuresT('subtitle')}
          description={featuresT('description')}
          items={featureItems}
        />

        <Features2Section />

        <Features3Section />

        <Integration2Section />

        <PricingSection />

        <FaqSection
          title={faqT('title')}
          subtitle={faqT('subtitle')}
          items={faqItems}
        />

        <CallToActionSection />

        <TestimonialsSection />

        <NewsletterCard />

        <CrispChat />
      </div>
    </>
  );
}

