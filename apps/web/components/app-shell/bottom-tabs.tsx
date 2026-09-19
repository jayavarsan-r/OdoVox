"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  House,
  Activity,
  Users,
  CalendarDays,
  FlaskConical,
  Building2,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import { tabsForRole, type Role, type TabIcon } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const ICONS: Record<TabIcon, React.ComponentType<{ className?: string }>> = {
  home: House,
  today: Activity,
  patients: Users,
  schedule: CalendarDays,
  lab: FlaskConical,
  clinic: Building2,
  billing: TrendingUp,
  more: MoreHorizontal,
};

/**
 * `.lgnav` — the v9 glass nav pill (every frame from 12 onward).
 *
 * FOUR tabs. Lab, Clinic and Billing moved to `/more`; no route was removed.
 *
 * Spec: 72px tall, radius 36px, `--glass` fill with a 30px blur at 1.9 saturation, a
 * bright `--glass-line` border, `shadow-nav`, and a top sheen. This is ONE of only two
 * blurred surfaces permitted app-wide (the other is the voice menu) — see the perf
 * budget in docs/migration/04-migration-governance.md §2.
 *
 * The locked interaction survives from Phase 2: the lime capsule shows ONLY on the
 * active tab, with the label NEXT TO the icon, never below. Inactive tabs are icon-only
 * and muted; their label stays in the DOM as `sr-only`.
 */
export function BottomTabs({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  const pathname = usePathname();
  const tabs = tabsForRole(role);

  return (
    <nav
      className={cn(
        "relative flex h-nav flex-1 items-center rounded-nav px-2.5",
        "border border-glass-line bg-glass-light shadow-nav",
        "backdrop-blur-nav backdrop-saturate-[1.9]",
        className,
      )}
    >
      {/* `.lgnav::before` — the top sheen that makes the glass read as glass */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-px rounded-[35px] bg-nav-sheen"
      />
      {tabs.map((tab) => {
        const Icon = ICONS[tab.icon];
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            aria-label={tab.label}
            className={cn(
              "relative z-[2] flex items-center justify-center",
              active ? "flex-initial" : "flex-1",
            )}
          >
            <motion.span
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative flex h-nav-capsule items-center justify-center rounded-[26px]",
                active ? "gap-2 px-5" : "w-10",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-[26px] bg-lime shadow-cta"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              ) : null}
              <Icon
                className={cn(
                  "relative shrink-0",
                  active
                    ? "size-5 text-pine"
                    : "size-[22px] text-[rgba(31,42,35,0.42)]",
                )}
              />
              {active ? (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="relative whitespace-nowrap text-body font-heavy text-pine"
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
    </nav>
  );
}
