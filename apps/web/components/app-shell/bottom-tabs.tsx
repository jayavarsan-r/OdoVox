'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  House,
  Activity,
  Users,
  CalendarDays,
  FlaskConical,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { tabsForRole, type Role, type TabIcon } from '@/lib/rbac';
import { cn } from '@/lib/utils';

const ICONS: Record<TabIcon, React.ComponentType<{ className?: string }>> = {
  home: House,
  today: Activity,
  patients: Users,
  schedule: CalendarDays,
  lab: FlaskConical,
  clinic: Building2,
  billing: TrendingUp,
};

/**
 * Phase 2 design (restored in Phase 3 prologue, locked in §6 / §12.1):
 * a floating paper pill with 5 tabs. The active tab is a lime pill carrying BOTH
 * its icon and its label (label next to the icon, not below). Inactive tabs are
 * icon-only and muted. Tapping an inactive tab presses (scale 0.95) then springs
 * to the lime pill with the label sliding in from the icon's right edge.
 */
export function BottomTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = tabsForRole(role);

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: 'calc(16px + var(--safe-bottom))' }}
    >
      <div className="pointer-events-auto flex w-full max-w-mobile items-center justify-between gap-1 rounded-pill bg-paper/95 px-2 py-2 shadow-elev-2 backdrop-blur-md">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.icon];
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              aria-label={tab.label}
              className={cn(
                'relative flex flex-1 items-center justify-center',
                active ? 'flex-initial' : 'flex-1',
              )}
            >
              <motion.span
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'relative flex h-10 items-center justify-center rounded-pill',
                  active ? 'gap-1.5 px-3.5' : 'w-10',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-pill bg-lime"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                ) : null}
                <Icon className={cn('relative size-6 shrink-0', active ? 'text-ink' : 'text-text-muted')} />
                {active ? (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="relative whitespace-nowrap text-sm font-medium text-ink"
                  >
                    {tab.label}
                  </motion.span>
                ) : (
                  <span className="sr-only">{tab.label}</span>
                )}
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
