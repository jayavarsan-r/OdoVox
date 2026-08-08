"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/** A slide-up modal anchored to the bottom of the mobile shell. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* `.scrim` */}
          <motion.div
            className="absolute inset-0 bg-[rgba(31,42,35,0.42)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* `.sheet` — 26px top radius, sheet surface, upward shadow */}
          <motion.div
            className="relative z-10 w-full max-w-mobile rounded-t-3xl bg-sheet px-[18px] pb-4 pt-2 shadow-sheetShadow"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            style={{ maxHeight: "85dvh" }}
          >
            {/* `.grab` — the drag affordance every v9 sheet carries */}
            <div
              aria-hidden
              className="mx-auto mb-3 h-[5px] w-9 rounded-[3px] bg-hair-2"
            />
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sheet-title font-heavy text-pine">{title}</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-pill text-pine-2 active:bg-[rgba(31,42,35,0.05)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div
              className="overflow-y-auto pt-3"
              style={{ maxHeight: "calc(85dvh - 84px)" }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
