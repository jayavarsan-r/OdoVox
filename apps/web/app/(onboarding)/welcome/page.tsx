"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { Check, IndianRupee, Mic } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { MascotMoment } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SlideHeroTooth() {
  return (
    <div className="relative flex h-56 items-center justify-center">
      {/* Frame 02: Odo at 140 with the lime and blue sparkles, on the canvas. */}
      <MascotMoment
        pose="hero"
        size="xl"
        animation="float"
        background="none"
        sparkles
      />
    </div>
  );
}

function SlideHeroVoice() {
  const items = [
    "Procedure: RCT · Tooth 36",
    "Next visit: Cleaning",
    "Prescribed: Ibuprofen 400mg",
  ];
  return (
    <div className="relative flex h-56 flex-col items-center justify-center gap-4">
      <div className="flex items-end gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-pill bg-ink"
            animate={{ height: [8, 28, 12, 32, 10] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              repeatType: "mirror",
              delay: i * 0.08,
            }}
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
      <div className="absolute -bottom-3 right-0 rotate-[6deg]">
        <MascotMoment pose="smile" size="sm" animation="float" />
      </div>
    </div>
  );
}

function SlideHeroConnected() {
  const cards = ["Treatment Plan", "Procedure", "Visit"];
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.2 }}
          className={cn(
            "w-44 rounded-lg border px-4 py-2.5 text-center text-sm font-medium shadow-soft",
            i === 0 && "border-lavender bg-lavender-soft",
            i === 1 && "border-sky bg-sky-soft",
            i === 2 && "border-sage bg-sage-soft",
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
    heading: "Built for Indian dental clinics",
    body: "From single-chair practices in Salem to multi-location groups in Mumbai. Speak in English, हिन्दी, or தமிழ் — Odovox understands.",
    chips: ["English", "हिन्दी", "தமிழ்"],
  },
  {
    hero: <SlideHeroVoice />,
    heading: "Speak. It structures itself.",
    body: "Dictate what you did and Odovox files the notes, the prescription, and the next visit. No forms, no typing between patients.",
  },
  {
    hero: <SlideHeroConnected />,
    heading: "Plan, procedure, visit — connected",
    body: "Every appointment knows which procedure it advances and which plan it belongs to. Progress tracks itself across visits.",
  },
  {
    hero: <SlideHeroSync />,
    heading: "Your front desk, in sync",
    body: "Doctor records. Front desk sees it instantly. Payments, prescriptions, next visit — everyone on the same page.",
  },
] as const;

export default function WelcomePage() {
  const router = useRouter();
  const [emblaRef, embla] = useEmblaCarousel({ loop: false });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    onSelect();
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  const isLast = index === SLIDES.length - 1;
  const onContinue = useCallback(() => {
    if (isLast) router.push("/phone");
    else embla?.scrollNext();
  }, [embla, isLast, router]);

  return (
    <MobileShell className="bg-paper">
      <div className="flex items-center justify-end px-5 pt-3">
        <button
          type="button"
          onClick={() => router.push("/phone")}
          className="min-h-target rounded-pill px-3 py-1.5 text-body font-semibold text-pine-2"
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
                animate={
                  index === i ? { opacity: 1, x: 0 } : { opacity: 0.4, x: 0 }
                }
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                /* Frame 02's `.ob` is `align-items:center;text-align:center` — the
                   front door is a centred composition, not a left-aligned one. */
                className="flex h-full flex-col items-center justify-center text-center"
              >
                {/* No card behind Odo: frame 02 puts him straight on the canvas. */}
                <div className="flex items-center justify-center py-6">
                  {slide.hero}
                </div>
                <h1 className="mt-[18px] text-[29px] font-heavy leading-[1.15] tracking-tight text-pine">
                  {slide.heading}
                </h1>
                {/* `.ob-s` carries max-width:280px so the line length stays readable. */}
                <p className="mt-2 max-w-[280px] text-sm leading-[1.5] text-pine-2">
                  {slide.body}
                </p>
                {"chips" in slide && slide.chips ? (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {slide.chips.map((c) => (
                      <span
                        key={c}
                        className="inline-flex h-7 items-center rounded-pill bg-[rgba(31,42,35,0.05)] px-[11px] text-xs font-semibold text-pine"
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
                "h-1.5 rounded-sm transition-all duration-state",
                index === i ? "w-[18px] bg-pine" : "w-1.5 bg-hair-2",
              )}
            />
          ))}
        </div>
        <Button size="lg" block onClick={onContinue}>
          {isLast ? "Continue with phone" : "Continue"}
        </Button>
        {/* Frame 02's reassurance line — the pricing promise belongs on the front door. */}
        <p className="text-center text-xs font-semibold text-pine-3">
          Free for your first 50 patients
        </p>
      </div>
    </MobileShell>
  );
}
