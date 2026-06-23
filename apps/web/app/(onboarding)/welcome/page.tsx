'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useEmblaCarousel from 'embla-carousel-react';
import { motion } from 'framer-motion';
import { Check, IndianRupee, Mic } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { GradientMesh } from '@/components/gradient-mesh';
import { ToothMark } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MESH_PRESETS = ['one', 'two', 'three', 'four'] as const;

function SlideHeroTooth() {
  return (
    <div className="relative flex h-56 items-center justify-center">
      <motion.div
        className="flex size-36 items-center justify-center rounded-pill bg-gradient-to-br from-lime to-sage"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ToothMark className="size-16 text-ink" />
      </motion.div>
    </div>
  );
}

function SlideHeroVoice() {
  const items = ['Procedure: RCT · Tooth 36', 'Next visit: Cleaning', 'Prescribed: Ibuprofen 400mg'];
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-4">
      <div className="flex items-end gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-pill bg-ink"
            animate={{ height: [8, 28, 12, 32, 10] }}
            transition={{ duration: 0.9, repeat: Infinity, repeatType: 'mirror', delay: i * 0.08 }}
          />
        ))}
      </div>
      <div className="w-full rounded-lg border border-border bg-surface/80 p-3 shadow-soft backdrop-blur">
        {items.map((t, i) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.25 }}
            className="flex items-center gap-2 py-1 text-sm"
          >
            <Check className="size-4 text-success" /> {t}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SlideHeroConnected() {
  const cards = ['Treatment Plan', 'Procedure', 'Visit'];
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.2 }}
          className={cn(
            'w-44 rounded-lg border px-4 py-2.5 text-center text-sm font-medium shadow-soft',
            i === 0 && 'border-lavender bg-lavender-soft',
            i === 1 && 'border-sky bg-sky-soft',
            i === 2 && 'border-sage bg-sage-soft',
          )}
        >
          {c}
        </motion.div>
      ))}
    </div>
  );
}

function SlideHeroSync() {
  return (
    <div className="flex h-56 items-center justify-center gap-3">
      <div className="flex flex-1 flex-col items-center gap-2 rounded-lg border border-border bg-surface/80 p-4 shadow-soft backdrop-blur">
        <span className="flex size-10 items-center justify-center rounded-pill bg-lime text-ink">
          <Mic className="size-5" />
        </span>
        <span className="text-xs text-muted-foreground">In chair</span>
        <span className="text-sm font-semibold">Akhilesh</span>
      </div>
      <motion.span
        className="size-2.5 rounded-pill bg-success"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      <div className="flex flex-1 flex-col items-center gap-2 rounded-lg border border-border bg-surface/80 p-4 shadow-soft backdrop-blur">
        <span className="flex items-center gap-1 text-sm font-semibold">
          <IndianRupee className="size-3.5" />
          3,500
        </span>
        <span className="text-xs text-muted-foreground">collected</span>
        <span className="text-xs text-muted-foreground">3 in queue</span>
      </div>
    </div>
  );
}

const SLIDES = [
  {
    hero: <SlideHeroTooth />,
    heading: 'Built for Indian dental clinics',
    body: 'From single-chair practices in Salem to multi-location groups in Mumbai. Speak in English, हिन्दी, or தமிழ் — Odovox understands.',
    chips: ['English', 'हिन्दी', 'தமிழ்'],
  },
  {
    hero: <SlideHeroVoice />,
    heading: 'Speak. It structures itself.',
    body: 'Dictate what you did and Odovox files the notes, the prescription, and the next visit. No forms, no typing between patients.',
  },
  {
    hero: <SlideHeroConnected />,
    heading: 'Plan, procedure, visit — connected',
    body: 'Every appointment knows which procedure it advances and which plan it belongs to. Progress tracks itself across visits.',
  },
  {
    hero: <SlideHeroSync />,
    heading: 'Your front desk, in sync',
    body: 'Doctor records. Front desk sees it instantly. Payments, prescriptions, next visit — everyone on the same page.',
  },
] as const;

export default function WelcomePage() {
  const router = useRouter();
  const [emblaRef, embla] = useEmblaCarousel({ loop: false });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', onSelect);
    onSelect();
    return () => {
      embla.off('select', onSelect);
    };
  }, [embla]);

  const isLast = index === SLIDES.length - 1;
  const onContinue = useCallback(() => {
    if (isLast) router.push('/phone');
    else embla?.scrollNext();
  }, [embla, isLast, router]);

  return (
    <MobileShell>
      <GradientMesh preset={MESH_PRESETS[index]} />

      <div className="flex items-center justify-end px-5 pt-3">
        <button
          type="button"
          onClick={() => router.push('/phone')}
          className="rounded-pill px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {SLIDES.map((slide, i) => (
            <div key={i} className="min-w-0 flex-[0_0_100%] px-7">
              <motion.div
                key={`${i}-${index}`}
                initial={{ opacity: 0, x: 24 }}
                animate={index === i ? { opacity: 1, x: 0 } : { opacity: 0.4, x: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-full flex-col justify-center"
              >
                {slide.hero}
                <h1 className="mt-8 text-3xl font-semibold tracking-tight">{slide.heading}</h1>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">{slide.body}</p>
                {'chips' in slide && slide.chips ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {slide.chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-pill border border-border bg-surface/70 px-3 py-1 text-sm font-medium backdrop-blur"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 px-7 pb-8 pt-4">
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => embla?.scrollTo(i)}
              className={cn(
                'h-2 rounded-pill transition-all',
                index === i ? 'w-6 bg-ink' : 'w-2 bg-border-strong',
              )}
            />
          ))}
        </div>
        <Button size="lg" className="w-full" onClick={onContinue}>
          {isLast ? 'Get started' : 'Continue'}
        </Button>
      </div>
    </MobileShell>
  );
}
