import FaqSection from '@/components/sections/faqs/faqs';
import Container from '@/components/layout/container';
import { PricingTable } from '@/components/pricing/pricing-table';
import { getFaqItems } from '@/lib/faq-helpers';
import { getTranslations } from 'next-intl/server';

export default async function PricingPage() {
  // Reuse HomePage FAQ for now - can be changed to PricingPage.faqs later
  const faqT = await getTranslations('HomePage.faqs');
  const faqItems = getFaqItems(faqT as any);

  return (
    <Container className="mt-8 max-w-6xl px-4 flex flex-col gap-16">
      <PricingTable />

      <FaqSection
        title={faqT('title')}
        subtitle={faqT('subtitle')}
        items={faqItems}
      />
    </Container>
  );
}


