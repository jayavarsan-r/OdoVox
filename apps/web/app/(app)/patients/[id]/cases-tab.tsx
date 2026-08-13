'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { useToast } from '@/lib/toast';
import { usePlans, useCreatePlan } from '@/lib/queries';
import { rupees } from '@/lib/patient-ui';
import { useLabCases } from '@/lib/lab-queries';
import { labCaseTypeLabel, labStatusStyle } from '@/lib/lab-ui';
import { cn } from '@/lib/utils';
import { ProgressBar } from './ui-bits';

export function CasesTab({ patientId }: { patientId: string }) {
  const toast = useToast();
  const router = useRouter();
  const plans = usePlans(patientId);
  const createPlan = useCreatePlan(patientId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [procs, setProcs] = useState<{ name: string; totalSittings: number; toothNumbers: string }[]>([
    { name: '', totalSittings: 1, toothNumbers: '' },
  ]);

  const save = async () => {
    try {
      await createPlan.mutateAsync({
        name,
        estimatedCostPaise: Math.round((Number(cost) || 0) * 100),
        procedures: procs
          .filter((p) => p.name.trim())
          .map((p) => ({
            name: p.name,
            totalSittings: p.totalSittings,
            toothNumbers: p.toothNumbers.split(',').map((n) => Number(n.trim())).filter((n) => !Number.isNaN(n)),
          })),
      });
      toast.success('Treatment plan created.');
      setOpen(false);
      setName(''); setCost(''); setProcs([{ name: '', totalSittings: 1, toothNumbers: '' }]);
    } catch (err) {
      toast.apiError(err);
    }
  };

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => setOpen(true)}><Plus className="size-4" /> New plan</Button>
      {plans.isLoading ? (
        <Spinner />
      ) : (plans.data?.length ?? 0) === 0 ? (
        <EmptyState
          variant="inline"
          icon={<ClipboardList />}
          iconTone="sage"
          title="No treatment plans"
          body="Tap Record findings or + New plan to start."
        />
      ) : (
        (() => {
          const all = plans.data!;
          // DRAFT is "not started", never "past" — it sits with active work until it begins.
          const activePlans = all.filter((p) => p.status === 'ACTIVE' || p.status === 'DRAFT');
          const pastPlans = all.filter((p) => p.status !== 'ACTIVE' && p.status !== 'DRAFT');
          const goTo = (id: string) => router.push(`/patients/${patientId}/plans/${id}`);
          return (
            <>
              {activePlans.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Active treatment</p>
                  {activePlans.map((pl) => (
                    <button key={pl.id} type="button" onClick={() => goTo(pl.id)} className="w-full rounded-lg border border-sage/40 bg-sage-tint/40 p-4 text-left active:scale-[0.99]">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink">{pl.name}</p>
                        <span className="rounded-pill bg-sage-tint px-2 py-0.5 text-xs text-sage-deep">
                          {pl.status === 'DRAFT' ? 'Not started' : 'Active'}
                        </span>
                      </div>
                      <ProgressBar percent={pl.progress.percent} />
                      <p className="mt-1 text-xs text-text-muted">
                        {pl.progress.completedSittings} of {pl.progress.totalSittings} sittings completed
                        {pl.progress.completedSittings < pl.progress.totalSittings
                          ? ` · Next: sitting ${pl.progress.completedSittings + 1}`
                          : ''}{' '}
                        · {rupees(pl.estimatedCostPaise)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
              {pastPlans.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Past treatments · {pastPlans.length}</p>
                  {pastPlans.map((pl) => (
                    <button key={pl.id} type="button" onClick={() => goTo(pl.id)} className="w-full rounded-lg border border-border bg-surface p-4 text-left active:scale-[0.99]">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{pl.name}</p>
                        <span className="rounded-pill bg-muted px-2 py-0.5 text-xs">{pl.status}</span>
                      </div>
                      <ProgressBar percent={pl.progress.percent} />
                      <p className="mt-1 text-xs text-muted-foreground">{pl.progress.completedSittings}/{pl.progress.totalSittings} sittings · {rupees(pl.estimatedCostPaise)}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          );
        })()
      )}

      <PatientLabCases patientId={patientId} />

      <BottomSheet open={open} onClose={() => setOpen(false)} title="New treatment plan">
        <div className="space-y-3">
          <Input placeholder="Plan name (e.g. RCT + Crown)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Estimated cost (₹)" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
          <p className="text-xs font-semibold uppercase tracking-widest text-text-subtle">Procedures</p>
          {procs.map((proc, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <Input placeholder="Procedure (RCT, Scaling…)" value={proc.name} onChange={(e) => setProcs((ps) => ps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <div className="flex gap-2">
                <Input placeholder="Teeth (e.g. 36, 37)" value={proc.toothNumbers} onChange={(e) => setProcs((ps) => ps.map((x, j) => (j === i ? { ...x, toothNumbers: e.target.value } : x)))} />
                <Input className="w-20" type="number" min={1} value={proc.totalSittings} onChange={(e) => setProcs((ps) => ps.map((x, j) => (j === i ? { ...x, totalSittings: Number(e.target.value) } : x)))} />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setProcs((ps) => [...ps, { name: '', totalSittings: 1, toothNumbers: '' }])} className="text-sm font-medium text-muted-foreground">+ Add procedure</button>
          <Button className="w-full" disabled={!name.trim()} loading={createPlan.isPending} onClick={save}>Create plan</Button>
        </div>
      </BottomSheet>
    </div>
  );
}

// ===== Lab cases (shown under treatment plans on the Cases tab) ==============
export function PatientLabCases({ patientId }: { patientId: string }) {
  const router = useRouter();
  const query = useLabCases({ patientId });
  const cases = query.data?.pages.flatMap((p) => p.items) ?? [];
  if (cases.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Lab cases · {cases.length}</p>
      {cases.map((c) => {
        const s = labStatusStyle(c.status);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => router.push(`/lab/${c.id}`)}
            className="flex w-full items-stretch overflow-hidden rounded-lg border border-border bg-surface text-left active:scale-[0.99]"
          >
            <span className={cn('w-1 shrink-0', s.bar)} />
            <span className="flex flex-1 flex-col gap-0.5 p-3">
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold">{c.caseNumber}</span>
                <span className={cn('rounded-pill px-2 py-0.5 text-xs font-medium', s.pill)}>{s.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {labCaseTypeLabel(c.type)}
                {c.teeth.length ? ` · Tooth ${c.teeth.join(', ')}` : ''}
                {c.vendorName ? ` · ${c.vendorName}` : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ===== Tooth Map =============================================================
