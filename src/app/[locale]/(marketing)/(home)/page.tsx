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

  return (
    <>
      <div className="flex flex-col">
        <HeroSection />

        <LogoCloud />

        <StatsSection />

        <IntegrationSection />

        <FeaturesSection />

        <Features2Section />

        <Features3Section />

        <Integration2Section />

        <PricingSection />

        <FaqSection />

        <CallToActionSection />

        <TestimonialsSection />

        <NewsletterCard />

        <CrispChat />
      </div>
    </>
  );
}
