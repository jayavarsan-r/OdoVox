'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import {
  dispatchFabItem,
  fabItemDelay,
  fabReducer,
  initialFabState,
  type FabItem,
  type FabTone,
} from '@/lib/ds/fab';
import { cn } from '@/lib/utils';

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
  lime: 'bg-lime text-ink',
  ink: 'bg-ink text-paper',
  peach: 'bg-peach text-ink',
  sky: 'bg-sky text-ink',
  sage: 'bg-sage text-paper',
};

export function FAB({
  icon,
  label,
  onClick,
  variant = 'lime',
  offset,
  className,
}: {
  icon?: React.ReactNode;
  label?: string;
  onClick?: () => void;
  variant?: 'lime' | 'ink';
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
        'fixed z-40 flex h-14 items-center gap-2 rounded-pill px-5 text-sm font-semibold shadow-lime-glow [&_svg]:size-5',
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
  label = 'Actions',
}: {
  icon?: React.ReactNode;
  items: FabMenuItem[];
  offset?: Offset;
  label?: string;
}) {
  const [state, dispatch] = React.useReducer(fabReducer, initialFabState);

  const runItem = (id: string) => {
    dispatch({ type: 'close' });
    dispatchFabItem(items, id);
  };

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
            onClick={() => dispatch({ type: 'close' })}
            className="fixed inset-0 z-30 bg-black/20"
          />
        ) : null}
      </AnimatePresence>

      <div style={positionStyle(offset)} className="fixed z-40 flex flex-col items-end gap-3">
        <AnimatePresence>
          {state.open ? (
            <motion.ul
              initial="closed"
              animate="open"
              exit="closed"
              variants={{ open: { transition: { staggerChildren: 0.04, staggerDirection: -1 } } }}
              className="flex flex-col items-end gap-3"
            >
              {items.map((item) => (
                <motion.li
                  key={item.id}
                  variants={{
                    closed: { opacity: 0, y: 12, scale: 0.9 },
                    open: { opacity: 1, y: 0, scale: 1 },
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26, delay: fabItemDelay(0) }}
                >
                  <button
                    type="button"
                    onClick={() => runItem(item.id)}
                    className="flex items-center gap-2.5 rounded-pill bg-surface py-2.5 pl-4 pr-3 text-sm font-medium text-ink shadow-elev-3 [&_svg]:size-4"
                  >
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-pill',
                        toneClass[item.tone ?? 'lime'],
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

        <motion.button
          type="button"
          aria-label={label}
          aria-expanded={state.open}
          onClick={() => dispatch({ type: 'toggle' })}
          whileTap={{ scale: 0.92 }}
          className="flex size-14 items-center justify-center rounded-pill bg-lime text-ink shadow-lime-glow [&_svg]:size-6"
        >
          <motion.span
            animate={{ rotate: state.open ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            {icon ?? <Plus />}
          </motion.span>
        </motion.button>
      </div>
    </>
  );
}
