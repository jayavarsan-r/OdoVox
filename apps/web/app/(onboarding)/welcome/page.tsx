"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { IndianRupee, Mic } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { MascotMoment } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SlideHeroTooth() {
  return (
    // No fixed height: an `h-56` box centred the 140px mascot in 224px and pushed the
    // whole composition ~42px below where frame 02 puts it.
    <div className="relative flex items-center justify-center">
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

/**
 * THREE slides, not four, and slide 1 is frame 02's copy verbatim. (MUST-FIX #16)
 *
 * The frame's own note is "3 swipeable value dots; CTA skips them" — so the dots are the
 * only way to advance and the CTA always goes straight to /phone. That IS the skip
 * affordance, which is why the frame carries no separate Skip link.
 *
 * Our old slide 1 ("Built for Indian dental clinics" + language chips) and slide 2
 * ("Speak. It structures itself.") said the same thing frame 02 says in one screen, so
 * the frame's wording replaces both rather than a slide being arbitrarily dropped.
 */
const SLIDES = [
  {
    hero: <SlideHeroTooth />,
    heading: (
      <>
        Speak.
        <br />
        Odovox writes the record.
      </>
    ),
    body: "Notes, prescriptions, sittings and billing — updated from what you say after each consultation.",
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

  // Frame 02: "CTA skips them." The button always goes to /phone from any slide, which
  // is the frame's skip affordance — the dots and a swipe are what advance the carousel.
  const onContinue = useCallback(() => router.push("/phone"), [router]);

  return (
    <MobileShell className="bg-paper">
      {/* No Skip link: the CTA carries that job in frame 02. (MUST-FIX #16)

          Frame 02's `.ob` is TOP-ANCHORED, not centred: 56px above Odo, 18px to the
          question, the body, then the dots 20px below it — and only then does
          `margin-top:auto` push the CTA to the floor. Centring the whole group dropped
          everything ~70px and pushed the dots down beside the CTA. */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {SLIDES.map((slide, i) => (
            <div
              key={i}
              className="min-w-0 flex-[0_0_100%] px-gutter-onboarding"
            >
              <motion.div
                key={`${i}-${index}`}
                initial={{ opacity: 0, x: 24 }}
                animate={
                  index === i ? { opacity: 1, x: 0 } : { opacity: 0.4, x: 0 }
                }
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                /* `align-items:center;text-align:center` — the front door is a centred
                   composition horizontally, top-anchored vertically. */
                className="flex flex-col items-center pt-14 text-center"
              >
                {/* No card behind Odo: frame 02 puts him straight on the canvas. */}
                <div className="flex items-center justify-center">
                  {slide.hero}
                </div>
                <h1 className="mt-[18px] text-[29px] font-heavy leading-[1.15] tracking-question text-pine">
                  {slide.heading}
                </h1>
                {/* `.ob-s` carries max-width:280px so the line length stays readable. */}
                <p className="mt-2 max-w-[280px] text-sm leading-[1.5] text-pine-2">
                  {slide.body}
                </p>
                {/* No language chips: frame 02 has none. (MUST-FIX #16) */}
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* `.ob-dots` sits 20px under the body, still in the upper block — not down beside
          the CTA. Same geometry as the wizard's dots: 6px, 18px wide when active. */}
      <div className="mt-5 flex justify-center gap-1.5">
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

      {/* `margin-top:auto` — the frame drops the CTA to the floor, 18px from the edge. */}
      <div className="mt-auto px-gutter-onboarding pb-[18px]">
        <Button size="lg" block onClick={onContinue}>
          Continue with phone
        </Button>
        {/* Frame 02's reassurance line — the pricing promise belongs on the front door. */}
        <p className="mt-3 text-center text-xs font-semibold text-pine-3">
          Free for your first 50 patients
        </p>
      </div>
    </MobileShell>
  );
}
