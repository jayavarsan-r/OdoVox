"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import {
  dispatchFabItem,
  fabItemDelay,
  fabReducer,
  initialFabState,
  type FabItem,
  type FabTone,
} from "@/lib/ds/fab";
import { cn } from "@/lib/utils";

/**
 * Floating action button(s), bottom-right, offset to clear the floating tabs.
 * <FAB> is a single action; <FabMenu> expands to a stacked menu. Open/close +
 * dispatch logic lives in lib/ds/fab (tested). See design-system.md §6.
 */

type Offset = { bottom?: number; right?: number };

/** UI-level menu item — the logic `FabItem` (id/label/onClick/tone) plus an icon slot. */
export interface FabMenuItem extends FabItem {
  icon?: React.ReactNode;
}

function positionStyle(offset?: Offset): React.CSSProperties {
  return {
    bottom: `calc(${offset?.bottom ?? 96}px + var(--safe-bottom))`,
    right: offset?.right ?? 16,
  };
}

const toneClass: Record<FabTone, string> = {
  lime: "bg-lime text-ink",
  ink: "bg-ink text-paper",
  peach: "bg-peach text-ink",
  sky: "bg-sky text-ink",
  sage: "bg-sage text-paper",
};

export function FAB({
  icon,
  label,
  onClick,
  variant = "lime",
  offset,
  className,
}: {
  icon?: React.ReactNode;
  label?: string;
  onClick?: () => void;
  variant?: "lime" | "ink";
  offset?: Offset;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      aria-label={label}
      style={positionStyle(offset)}
      className={cn(
        "fixed z-40 flex h-14 items-center gap-2 rounded-pill px-5 text-sm font-semibold shadow-lime-glow [&_svg]:size-5",
        toneClass[variant],
        className,
      )}
    >
      {icon ?? <Plus />}
      {label ? <span>{label}</span> : null}
    </motion.button>
  );
}

export function FabMenu({
  icon,
  items,
  offset,
  label = "Actions",
  open: controlledOpen,
  onOpenChange,
}: {
  icon?: React.ReactNode;
  items: FabMenuItem[];
  offset?: Offset;
  label?: string;
  /**
   * Controlled mode. Frame 18 is "Home ＋ — speed dial open": the dial is summoned by
   * the header ＋, not by a second floating button of its own. Passing `open` hides the
   * built-in trigger, so the caller owns the affordance and the screen does not end up
   * with two ways to do the same thing sitting on top of each other.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, dispatch] = React.useReducer(
    fabReducer,
    initialFabState,
  );
  const controlled = controlledOpen !== undefined;
  const state = controlled ? { open: controlledOpen } : uncontrolled;
  const close = () =>
    controlled ? onOpenChange?.(false) : dispatch({ type: "close" });

  const runItem = (id: string) => {
    close();
    dispatchFabItem(items, id);
  };

  // Escape closes — a scrim you can only dismiss by tapping is a trap for keyboard users.
  React.useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open]);

  return (
    <>
      <AnimatePresence>
        {state.open ? (
          <motion.button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-[61] bg-[rgba(31,42,35,0.38)]"
          />
        ) : null}
      </AnimatePresence>

      {/* `.dial` — the stack sits ABOVE the orb so everything lands under the thumb */}
      <div
        style={positionStyle(offset)}
        className="fixed z-[62] flex flex-col-reverse items-end gap-2.5"
      >
        {/* Controlled mode has no trigger of its own — the caller owns the affordance
            (frame 18: the header ＋). Rendering one anyway would put a second floating
            button on a screen that already has the dock's orb. */}
        {controlled ? null : (
          <motion.button
            type="button"
            aria-label={label}
            aria-expanded={state.open}
            onClick={() => dispatch({ type: "toggle" })}
            whileTap={{ scale: 0.94 }}
            className="flex size-orb items-center justify-center rounded-pill border border-white/90 bg-orb text-pine shadow-orb [&_svg]:size-6"
          >
            <motion.span
              animate={{ rotate: state.open ? 45 : 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            >
              {icon ?? <Plus />}
            </motion.span>
          </motion.button>
        )}

        <AnimatePresence>
          {state.open ? (
            <motion.ul
              initial="closed"
              animate="open"
              exit="closed"
              className="flex flex-col-reverse items-end gap-2.5"
            >
              {items.map((item, index) => (
                <motion.li
                  key={item.id}
                  variants={{
                    closed: { opacity: 0, y: 12, scale: 0.9 },
                    open: { opacity: 1, y: 0, scale: 1 },
                  }}
                  /* Bottom-up stagger. The previous implementation passed
                     fabItemDelay(0) for every item, so nothing actually staggered. */
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 26,
                    delay: fabItemDelay(index, 0.03),
                  }}
                >
                  {/* `.dpill` */}
                  <button
                    type="button"
                    onClick={() => runItem(item.id)}
                    className="flex h-[54px] items-center gap-[13px] rounded-[28px] bg-white pl-[21px] pr-[7px] shadow-[0_16px_38px_rgba(31,42,35,0.2),var(--highlight-top)]"
                  >
                    <span className="whitespace-nowrap text-md font-heavy text-pine">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-pill [&_svg]:size-[18px]",
                        toneClass[item.tone ?? "lime"],
                      )}
                    >
                      {item.icon ?? <Plus />}
                    </span>
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
