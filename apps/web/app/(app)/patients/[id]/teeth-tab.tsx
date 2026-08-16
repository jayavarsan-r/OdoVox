'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Odontogram, OdontogramLegend, TOOTH_STATUSES, type ToothStatus } from '@/components/odontogram/odontogram';
import { useToast } from '@/lib/toast';
import { useTeeth, useUpsertTooth, usePlans } from '@/lib/queries';
import { cn } from '@/lib/utils';

export function TeethTab({ patientId, records }: { patientId: string; records: Record<number, ToothStatus> }) {
  const toast = useToast();
  const router = useRouter();
  const teeth = useTeeth(patientId);
  const plans = usePlans(patientId);
  const upsert = useUpsertTooth(patientId);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<ToothStatus>('HEALTHY');
  const [notes, setNotes] = useState('');

  const activePlans = (plans.data ?? []).filter((p) => p.status === 'ACTIVE');
  const activePlanTeeth = [...new Set(activePlans.flatMap((p) => p.teeth))];
  const planForTooth = (n: number | null) =>
    n == null ? undefined : activePlans.find((p) => p.teeth.includes(n));

  const open = (n: number) => {
    setSelected(n);
    setStatus((records[n] ?? 'HEALTHY') as ToothStatus);
    const existing = teeth.data?.find((t) => t.toothNumber === n);
    setNotes(existing?.notes ?? '');
  };
  const history = teeth.data?.find((t) => t.toothNumber === selected)?.history ?? [];

  const save = async () => {
    if (selected == null) return;
    try {
      await upsert.mutateAsync({ tooth: selected, input: { status, notes: notes || null } });
      toast.success(`Tooth ${selected} updated.`);
      setSelected(null);
    } catch (err) {
      toast.apiError(err);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-surface p-4">
        <Odontogram records={records} highlightTooth={selected} activePlanTeeth={activePlanTeeth} onToothTap={open} />
      </div>
      <OdontogramLegend />

      {/* Frame 40: the status panel opens INLINE, below the chart — no sheet, no
          navigation jump. The doctor keeps the odontogram in view while they set a
          status, which is the whole point: the chart is the context for the decision.

          Everything the sheet did, this does — status chips, encrypted notes, per-tooth
          history, the active-plan link and Save. Nothing was dropped for the restyle. */}
      {selected != null ? (
        <div className="rounded-2xl bg-white p-4 shadow-elev-1">
          <div className="flex items-center gap-2.5">
            <Chip tone="lime">Tooth {selected}</Chip>
            {(() => {
              const pl = planForTooth(selected);
              return pl ? (
                <button
                  type="button"
                  onClick={() => router.push(`/patients/${patientId}/plans/${pl.id}`)}
                  className="min-w-0 flex-1 truncate text-left text-[13px] font-heavy text-pine"
                >
                  {pl.name} · sitting {pl.progress.completedSittings + 1} of{' '}
                  {pl.progress.totalSittings} →
                </button>
              ) : (
                <span className="text-[13px] font-semibold text-pine-3">Set status</span>
              );
            })()}
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close tooth panel"
              className="shrink-0 text-pine-3"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {TOOTH_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatus(st)}
                className={cn(
                  'rounded-pill px-3.5 py-1.5 text-[12.5px] font-heavy transition-colors',
                  status === st ? 'bg-pine text-white' : 'bg-paper text-pine-2',
                )}
              >
                {st}
              </button>
            ))}
          </div>

          <Input
            className="mt-3"
            placeholder="Notes (encrypted)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {history.length > 0 ? (
            <div className="mt-3">
              <p className="text-[9.5px] font-heavy uppercase tracking-eyebrow text-pine-3">
                History
              </p>
              <div className="mt-1 space-y-0.5">
                {history
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <p key={i} className="text-[11.5px] font-semibold text-pine-2">
                      {new Date(h.date).toLocaleDateString('en-IN')} · {h.status}
                      {h.notes ? ` · ${h.notes}` : ''}
                    </p>
                  ))}
              </div>
            </div>
          ) : null}

          <Button block className="mt-3.5 h-12" loading={upsert.isPending} onClick={save}>
            {planForTooth(selected) ? 'Save · link to plan' : 'Save'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ===== Media =================================================================
