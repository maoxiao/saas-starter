'use client';

import { BorderBeam } from '@/components/magicui/border-beam';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ChartBarIncreasingIcon,
  Database,
  Fingerprint,
  IdCard,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useState } from 'react';
import type { FeatureItem } from '@/lib/feature-helpers';

// Icon mapping for features
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'feature-1': Database,
  'feature-2': Fingerprint,
  'feature-3': IdCard,
  'feature-4': ChartBarIncreasingIcon,
};

// Image mapping for features
const imageMap: Record<
  string,
  { image: string; darkImage: string; alt: string }
> = {
  'feature-1': {
    image: 'https://cdn.mksaas.com/blocks/charts-light.png',
    darkImage: 'https://cdn.mksaas.com/blocks/charts.png',
    alt: 'Product Feature One',
  },
  'feature-2': {
    image: 'https://cdn.mksaas.com/blocks/music-light.png',
    darkImage: 'https://cdn.mksaas.com/blocks/music.png',
    alt: 'Product Feature Two',
  },
  'feature-3': {
    image: 'https://cdn.mksaas.com/blocks/mail2-light.png',
    darkImage: 'https://cdn.mksaas.com/blocks/mail2.png',
    alt: 'Product Feature Three',
  },
  'feature-4': {
    image: 'https://cdn.mksaas.com/blocks/payments-light.png',
    darkImage: 'https://cdn.mksaas.com/blocks/payments.png',
    alt: 'Product Feature Four',
  },
};

interface FeaturesAccordionProps {
  items: FeatureItem[];
  title: string;
  description: string;
}

export function FeaturesAccordion({
  items,
  title,
  description,
}: FeaturesAccordionProps) {
  const [activeItem, setActiveItem] = useState<string>(items[0]?.id || '');

  // Get image data for active item
  const activeImage = imageMap[activeItem] || imageMap['feature-1'];

  return (
    <div className="grid gap-12 sm:px-12 lg:grid-cols-12 lg:gap-24 lg:px-0">
      <div className="lg:col-span-5 flex flex-col gap-8">
        <div className="lg:pr-0 text-left">
          <h3 className="text-3xl font-semibold lg:text-4xl text-foreground leading-normal py-1">
            {title}
          </h3>
          <p className="mt-4 text-muted-foreground">{description}</p>
        </div>
        <Accordion
          type="single"
          value={activeItem}
          onValueChange={(value) => setActiveItem(value)}
          className="w-full"
        >
          {items.map((item) => {
            const Icon = iconMap[item.id] || Database;
            return (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-base">
                    <Icon className="size-4" />
                    {item.title}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.description}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <div className="bg-background w-full relative flex overflow-hidden rounded-2xl border p-2 lg:h-auto lg:col-span-7">
        <div className="aspect-76/59 bg-background relative w-full rounded-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeItem}-id`}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="size-full overflow-hidden rounded-2xl border bg-zinc-900 shadow-md"
            >
              <Image
                src={activeImage.image}
                className="size-full object-cover object-left-top dark:hidden"
                alt={activeImage.alt}
                width={1207}
                height={929}
              />
              <Image
                src={activeImage.darkImage}
                className="size-full object-cover object-left-top dark:block hidden"
                alt={activeImage.alt}
                width={1207}
                height={929}
              />
            </motion.div>
          </AnimatePresence>
        </div>
        <BorderBeam
          duration={6}
          size={200}
          className="from-transparent via-violet-700 to-transparent dark:via-white/50"
        />
      </div>
    </div>
  );
}
