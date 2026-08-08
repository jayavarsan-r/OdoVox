"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  HOLD_MS,
  holdFired,
  initialPress,
  pressCancel,
  pressDown,
  pressUp,
  type OrbPress,
} from "@/lib/ds/orb";

/**
 * `.actbtn` — the orb (frame 78).
 *
 * "The fastest path to the app's core act — dictating."
 *   tap        → the context action (record whoever is in the chair; on Consult,
 *                record; anywhere else, jump to Consult)
 *   hold 350ms → the voice menu, whose first row always NAMES who will be recorded
 *
 * Spec: 66px round, `--grad-orb`, white border, `shadow-orb`, 26px icon, and an
 * `::after` halo ring at inset -6px. `active` adds the extra lime-soft ring the spec
 * shows when the orb's own tab is current (frame 21).
 *
 * The press/hold machine is in lib/ds/orb.ts under test — a tap that fires the menu,
 * or a hold that also fires a recording, are both clinic-grade mistakes.
 */
export interface OrbProps {
  onTap: () => void;
  onHold?: () => void;
  /** The extra lime-soft ring shown when the orb's own tab is current. */
  active?: boolean;
  /** Accessible name. Must describe BOTH actions when a hold action exists. */
  label: string;
  icon: React.ReactNode;
  className?: string;
}

export function Orb({
  onTap,
  onHold,
  active = false,
  label,
  icon,
  className,
}: OrbProps) {
  const [press, setPress] = React.useState<OrbPress>(initialPress);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressRef = React.useRef<OrbPress>(initialPress);

  const set = (next: OrbPress) => {
    pressRef.current = next;
    setPress(next);
  };

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  React.useEffect(() => clearTimer, []);

  const down = () => {
    set(pressDown(Date.now()));
    clearTimer();
    if (!onHold) return;
    timer.current = setTimeout(() => {
      const promoted = holdFired(pressRef.current);
      if (promoted.state === "held") {
        set(promoted);
        onHold();
      }
    }, HOLD_MS);
  };

  const up = () => {
    clearTimer();
    const { next, resolution } = pressUp(pressRef.current, Date.now());
    set(next);
    // `hold` already fired via the timer; firing again here would double-invoke.
    if (resolution === "tap") onTap();
  };

  const cancel = () => {
    clearTimer();
    set(pressCancel().next);
  };

  return (
    <button
      type="button"
      aria-label={
        onHold ? `${label}. Press and hold for voice commands.` : label
      }
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.preventDefault();
      }}
      onKeyUp={(e) => {
        // Keyboard has no long-press; Enter/Space is the tap. The hold action is
        // reachable from the "What can I say" surface, and is named in the label above.
        if (e.key === "Enter" || e.key === " ") onTap();
      }}
      className={cn(
        "relative flex size-orb shrink-0 items-center justify-center rounded-pill",
        "border border-white/90 bg-orb text-pine shadow-orb",
        "transition-transform duration-press ease-out",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
        press.state !== "idle" && "scale-[0.94]",
        "[&_svg]:size-[26px]",
        className,
      )}
    >
      {/* `.actbtn::after` — the halo ring */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-1.5 rounded-pill border-[1.5px] border-[rgba(205,231,99,0.45)]",
          active && "shadow-[0_0_0_4px_var(--lime-soft)]",
        )}
      />
      {icon}
    </button>
  );
}
