"use client";

import { useRouter, usePathname } from "next/navigation";
import { Mic, Plus } from "lucide-react";
import { BottomTabs } from "@/components/app-shell/bottom-tabs";
import { Orb } from "@/components/ds/orb";
import { orbAction } from "@/lib/ds/nav-dock";
import type { Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * `.navwrap` — the v9 bottom dock: the glass tab pill and the orb, 11px apart.
 *
 * Spec: left/right 16px, bottom 14px + safe area, z-70.
 *
 * The orb is role-shaped. A doctor's core act is dictating, so the orb is a mic. A
 * receptionist's is adding — walk-ins, appointments, payments — so it is a ＋. Frame 77
 * makes that swap the headline consequence of switching roles.
 */
export function NavDock({
  role,
  onOrbHold,
  className,
}: {
  role: Role;
  /** Opens the voice menu (frame 78). Wired in Task 7. */
  onOrbHold?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const action = orbAction(role, pathname);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4",
        className,
      )}
      style={{ bottom: "calc(14px + var(--safe-bottom))" }}
    >
      <div className="pointer-events-auto flex w-full max-w-mobile items-center gap-[11px]">
        <BottomTabs role={role} />
        <Orb
          label={action.label}
          icon={action.icon === "mic" ? <Mic /> : <Plus />}
          active={action.highlighted}
          onTap={() => router.push(action.href)}
          onHold={onOrbHold}
        />
      </div>
    </div>
  );
}
