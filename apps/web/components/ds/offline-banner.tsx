"use client";

import { RotateCw } from "lucide-react";
import { MascotMoment } from "@/components/illustrations/mascot-moment";
import { Chip } from "@/components/ui/badge";
import { useQueueStore } from "@/lib/queue/store";
import { statusIndicator } from "@/lib/realtime/status";
import { cn } from "@/lib/utils";

/**
 * Frame 17 — the offline banner.
 *
 * Extracted out of `components/queue/realtime-dot.tsx`, where it was a one-line strip of
 * `ind.label` on a wash. It is the third REPLACE in the component mapping, and the reason
 * is the copy: "Reconnecting…" tells the user what the socket is doing, and frame 17 tells
 * them what it means for their work — everything still saves, it syncs when the connection
 * comes back. On a clinical screen that difference is the whole point.
 *
 * The banner is ADDITIVE. It sits above the normal hero and does not replace it, because
 * recording, notes and checkout all keep working offline. Swapping the screen out would
 * claim the app had stopped, which is false.
 *
 * Status logic is unchanged — the same `statusIndicator(status)` decides when it shows, so
 * "reconnecting" and "disconnected" still behave exactly as they did.
 */
export function OfflineBanner({
  onRetry,
  className,
}: {
  onRetry?: () => void;
  className?: string;
}) {
  const status = useQueueStore((s) => s.status);
  const ind = statusIndicator(status);
  if (!ind.showBanner) return null;

  const offline = status === "disconnected";

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2.5 rounded-2xl bg-warn-soft px-3.5 py-2.5",
        className,
      )}
    >
      <MascotMoment pose="thinking" size="sm" animation="none" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-heavy text-warn">
          {offline ? "You're offline" : "Reconnecting…"}
        </p>
        <p className="mt-0.5 text-[11.5px] font-semibold leading-[1.4] text-pine-2">
          Everything saves on this phone · syncs when back
        </p>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="shrink-0">
          <Chip tone="warn">
            <RotateCw className="size-3" />
            Retry
          </Chip>
        </button>
      ) : null}
    </div>
  );
}
