"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FlaskConical,
  Mic,
  Search,
  UserPlus,
} from "lucide-react";
import {
  voiceMenuRows,
  type VoiceIntentId,
  type VoiceMenuContext,
} from "@/lib/ds/voice-menu";
import { cn } from "@/lib/utils";

/**
 * `.vmenu` — the orb-hold menu (v9 frame 78).
 *
 * "One thumb, no navigation." Spec: 262px wide, sits above the orb, glass at 92%
 * with a 24px blur — one of only TWO blurred surfaces permitted app-wide (the other
 * is the nav pill), per the perf budget in governance §2.
 *
 * The first row always NAMES who will be recorded, and refuses to offer a recording
 * at all when nobody is in the chair. That logic is in lib/ds/voice-menu.ts under
 * test, because it is a safety property: the hold is reachable from any screen, and
 * a nameless "Start consultation" is how audio lands on the wrong patient.
 */
const ICONS: Record<
  VoiceIntentId,
  React.ComponentType<{ className?: string }>
> = {
  consultation: Mic,
  "new-patient": UserPlus,
  book: CalendarDays,
  "lab-case": FlaskConical,
  "find-patient": Search,
};

export interface VoiceMenuProps extends VoiceMenuContext {
  open: boolean;
  onClose: () => void;
}

export function VoiceMenu({ open, onClose, ...ctx }: VoiceMenuProps) {
  const router = useRouter();
  const rows = voiceMenuRows(ctx);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close voice menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-[rgba(31,42,35,0.35)]"
          />
          <motion.div
            role="menu"
            aria-label="Voice commands"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn(
              "fixed right-4 z-[61] w-[262px] rounded-2xl p-1.5",
              "border border-glass-line bg-glass-menu shadow-[0_22px_54px_rgba(31,42,35,0.3)]",
              "backdrop-blur-menu backdrop-saturate-[1.8]",
            )}
            style={{ bottom: "calc(96px + var(--safe-bottom))" }}
          >
            {rows.map((row) => {
              const Icon = ICONS[row.id];
              return (
                <button
                  key={row.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onClose();
                    router.push(row.href);
                  }}
                  className={cn(
                    "flex w-full items-center gap-[11px] rounded-lg px-3 py-[11px] text-left",
                    "transition-colors duration-press",
                    "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
                    row.hot ? "bg-lime" : "active:bg-[rgba(31,42,35,0.05)]",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[17px] shrink-0",
                      row.hot ? "text-pine" : "text-pine-2",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-heavy text-pine">
                      {row.label}
                    </span>
                    {row.sublabel ? (
                      <span className="block truncate text-micro font-semibold text-pine-2">
                        {row.sublabel}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
