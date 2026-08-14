"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, RotateCcw, ChevronRight, Info, CircleDot } from "lucide-react";
import type { VisitWithPatient } from "@odovox/types";
import { springScale } from "@/components/ds/motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, Mini } from "@/components/ui/badge";
import { InitialsAvatar as DsAvatar } from "@/components/ui/avatar";
import { IconCircle } from "@/components/ds";
import { rupees } from "@/lib/queue/checkout-form";
import { cn } from "@/lib/utils";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_TONES = [
  "bg-sage-soft",
  "bg-peach-soft",
  "bg-sky-soft",
  "bg-lavender",
];

export function InitialsAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const tone = AVATAR_TONES[name.charCodeAt(0) % AVATAR_TONES.length];
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-pill text-sm font-semibold text-ink",
        tone,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function useElapsed(since: Date | string | null): string {
  const [, force] = useState(0);
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return "";
  const secs = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
  // A negative elapsed means the clock and the record disagree — a device with the wrong
  // time, a server/client skew, or a pinned clock in the screenshot harness. This used to
  // clamp to zero and render "0:00", which asserts the patient sat down this instant. On
  // the card a doctor uses to judge who has been waiting longest, a confident wrong number
  // is worse than none, so the chip simply does not render.
  if (secs < 0) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Frame 21's "Now treating" card: `.card.wash`, a 52px live-ringed avatar, the name at
 * 18px/800, glyph `Mini`s underneath, then a 48px `.cta` beside a 48px `.icirc`.
 *
 * The frame puts "Record" on the primary and the return-to-queue on the icon button
 * rather than a second full-width row — one dominant action, one escape hatch. Both do
 * exactly what they did before.
 */
export function InChairCard({
  visit,
  onRecord,
  onReturn,
  busyRecord,
  busyReturn,
}: {
  visit: VisitWithPatient;
  onRecord: () => void;
  onReturn: () => void;
  busyRecord?: boolean;
  busyReturn?: boolean;
}) {
  const elapsed = useElapsed(visit.calledInAt);
  return (
    <motion.div layoutId={`visit-${visit.id}`} {...springScale}>
      <Card wash className="p-[15px]">
        <div className="flex items-center gap-[13px]">
          <DsAvatar name={visit.patient.name} ring="live" size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-heavy tracking-tight text-pine">
              {visit.patient.name}
            </p>
            <span className="mt-[5px] flex flex-wrap items-center gap-1.5">
              <Mini tone="neutral">Token {visit.tokenNumber}</Mini>
              {visit.chiefComplaint ? (
                <Mini tone="neutral">{visit.chiefComplaint}</Mini>
              ) : null}
              {visit.recording ? (
                <Mini tone="crit">
                  <CircleDot className="size-2.5 animate-pulse" /> recording
                </Mini>
              ) : null}
              {elapsed ? <Mini tone="sky">{elapsed}</Mini> : null}
            </span>
          </div>
        </div>
        <div className="mt-3.5 flex items-center gap-[9px]">
          <Button
            className="h-12 flex-1 text-[14.5px]"
            onClick={onRecord}
            loading={busyRecord}
          >
            <Mic /> Record
          </Button>
          {/* The frame's second slot is an icon, not a full-width row: returning to the
              queue is the escape hatch, not a co-equal action. */}
          <IconCircle
            size="lg"
            aria-label="Return to queue"
            onClick={onReturn}
            disabled={busyReturn}
          >
            <RotateCcw />
          </IconCircle>
        </div>
      </Card>
    </motion.div>
  );
}

/**
 * Frame 21's waiting `.vrow`: a 44px sky-ringed avatar, the name, glyph `Mini`s, and a
 * lime "Call in" chip. A patient nobody can call in yet reads "Booked" in pine-3 — the
 * frame distinguishes "your move" from "not yet" by colour alone, so the row never
 * offers an action it cannot perform.
 *
 * The lime flash on entry stays: it is how a doctor notices someone just arrived.
 */
export function WaitingRow({
  visit,
  onCallIn,
  calling,
  onOpen,
  onLongPress,
}: {
  visit: VisitWithPatient;
  onCallIn?: () => void;
  calling?: boolean;
  onOpen?: () => void;
  onLongPress?: () => void;
}) {
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  const startPress = () => {
    if (!onLongPress) return;
    pressTimer = setTimeout(onLongPress, 500);
  };
  const endPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };
  return (
    <motion.div
      layoutId={`visit-${visit.id}`}
      {...springScale}
      className="overflow-hidden"
      onContextMenu={(e) => {
        if (onLongPress) {
          e.preventDefault();
          onLongPress();
        }
      }}
    >
      <motion.div
        initial={{ backgroundColor: "rgba(205,231,99,0.5)" }}
        animate={{ backgroundColor: "rgba(205,231,99,0)" }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-3 px-4 py-2.5"
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={onOpen}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
        >
          <DsAvatar
            name={visit.patient.name}
            ring={onCallIn ? "sky" : "none"}
            size="md"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate text-[14px] font-heavy text-pine">
              {visit.patient.name}
              {visit.priority > 0 ? <Mini tone="warn">PRIORITY</Mini> : null}
              {onOpen ? (
                <Info className="size-3.5 shrink-0 text-pine-3" />
              ) : null}
            </span>
            <span className="mt-1 flex flex-wrap gap-1.5">
              <Mini tone="neutral">{visit.chiefComplaint ?? "Walk-in"}</Mini>
              <Mini tone="neutral">#{visit.tokenNumber}</Mini>
            </span>
          </span>
        </button>
        {onCallIn ? (
          <button
            type="button"
            onClick={onCallIn}
            disabled={calling}
            className="shrink-0"
          >
            <Chip tone="lime">{calling ? "Calling…" : "Call in"}</Chip>
          </button>
        ) : (
          <Chip tone="neutral">Booked</Chip>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Frame 21's "Sent to checkout" row, drawn at 65% opacity: the work is done, so it
 * recedes. The doctor sees the amount and nothing else; the receptionist gets the CTA.
 */
export function CheckoutRow({
  visit,
  onTakePayment,
}: {
  visit: VisitWithPatient;
  onTakePayment?: () => void;
}) {
  return (
    <motion.div
      layoutId={`visit-${visit.id}`}
      {...springScale}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5",
        onTakePayment ? "" : "opacity-65",
      )}
    >
      <DsAvatar name={visit.patient.name} ring="none" size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-heavy text-pine">
          {visit.patient.name}
        </p>
        {visit.doctorName ? (
          <p className="truncate text-[11.5px] font-semibold text-pine-2">
            {visit.doctorName}
          </p>
        ) : null}
      </div>
      {onTakePayment ? (
        <button type="button" onClick={onTakePayment} className="shrink-0">
          <Chip tone="lime">
            Take payment <ChevronRight className="size-3" />
          </Chip>
        </button>
      ) : visit.billDuePaise != null ? (
        <Mini tone="live">{rupees(visit.billDuePaise)}</Mini>
      ) : (
        <Mini tone="neutral">Checkout</Mini>
      )}
    </motion.div>
  );
}
