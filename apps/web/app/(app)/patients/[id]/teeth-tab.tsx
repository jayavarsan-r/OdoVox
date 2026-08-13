'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Odontogram, OdontogramLegend, TOOTH_STATUSES, TOOTH_TONE, type ToothStatus } from '@/components/odontogram/odontogram';
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

      <BottomSheet open={selected != null} onClose={() => setSelected(null)} title={`Tooth ${selected ?? ''}`}>
        <div className="space-y-4">
          {(() => {
            const pl = planForTooth(selected);
            return pl ? (
              <button
                type="button"
                onClick={() => router.push(`/patients/${patientId}/plans/${pl.id}`)}
                className="flex w-full items-center justify-between rounded-lg bg-sage-tint px-3 py-2 text-left text-xs text-sage-deep"
              >
                <span>Active plan: {pl.name} · {pl.progress.completedSittings} of {pl.progress.totalSittings} sittings</span>
                <ChevronLeft className="size-4 rotate-180" />
              </button>
            ) : null;
          })()}
          <div className="flex flex-wrap gap-2">
            {TOOTH_STATUSES.map((st) => (
              <button key={st} type="button" onClick={() => setStatus(st)} className={cn('rounded-pill border px-3 py-1.5 text-xs font-medium', status === st ? TOOTH_TONE[st] + ' ring-2 ring-ink ring-offset-1' : 'border-border bg-surface')}>{st}</button>
            ))}
          </div>
          <Input placeholder="Notes (encrypted)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {history.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-subtle">History</p>
              <div className="space-y-1">
                {history.slice().reverse().map((h, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{new Date(h.date).toLocaleDateString('en-IN')} · {h.status}{h.notes ? ` · ${h.notes}` : ''}</p>
                ))}
              </div>
            </div>
          ) : null}
          <Button className="w-full" loading={upsert.isPending} onClick={save}>Save</Button>
        </div>
      </BottomSheet>
    </div>
  );
}

// ===== Media =================================================================
