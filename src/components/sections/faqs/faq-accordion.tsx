'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

interface FaqAccordionProps {
  faqData: FAQItem[];
}

export function FaqAccordion({ faqData }: FaqAccordionProps) {
  return (
    <div className="mx-auto max-w-4xl mt-12">
      <Accordion
        type="single"
        collapsible
        className="ring-muted w-full rounded-2xl border px-8 py-3 shadow-sm ring-4 dark:ring-0"
      >
        {faqData.map((item) => (
          <AccordionItem
            key={item.id}
            value={item.id}
            className="border-dashed"
          >
            <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-base text-muted-foreground">
                {item.answer}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
