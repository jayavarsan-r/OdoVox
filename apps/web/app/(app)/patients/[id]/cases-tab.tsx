'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ChevronRight, FileText } from 'lucide-react';
import { Chip } from '@/components/ui/badge';
import { VerticalJourney } from '@/components/ds';
import { caseJourney } from '@/lib/patients/case-journey';
import { caseTitle } from '@/lib/patients/case-title';
import { EmptyState } from '@/components/ds';
import { useToast } from '@/lib/toast';
import { usePlans, useCreatePlan, usePlan, fetchPlanPdfUrl } from '@/lib/queries';
import { rupees } from '@/lib/patient-ui';
import { useLabCases } from '@/lib/lab-queries';
import { labCaseTypeLabel, labStatusStyle } from '@/lib/lab-ui';
import { cn } from '@/lib/utils';
import { ProgressBar } from './ui-bits';

/**
 * The active plan's sittings as frame 38's vertical journey.
 *
 * Fetched per-plan because the plans LIST returns progress counts only — the individual
 * sittings live on /plans/:id, which is also where the clinical boundary is enforced
 * (reception's response carries notes: null and never decrypts them, ruling B4).
 */
function ActivePlanJourney({ planId, onOpen }: { planId: string; onOpen: () => void }) {
  const plan = usePlan(planId);
  if (plan.isLoading) return <Spinner />;
  const procedures = plan.data?.procedures ?? [];
  if (procedures.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-elev-1">
      {procedures.map((proc) => (
        <div key={proc.id}>
          {procedures.length > 1 ? (
            <p className="mb-1 text-[12.5px] font-heavy text-pine-2">{proc.name}</p>
          ) : null}
          <VerticalJourney sittings={caseJourney(proc.sittings, proc.name)} />
        </div>
      ))}
      {/* Frame 38's card actions. PDF is real — /plans/:id/pdf already renders the plan.
          "Schedule remaining" is NOT here: no endpoint books a plan's outstanding sittings
          in one action, and a button that silently did nothing would be worse than its
          absence (recorded as a deviation). */}
      <div className="flex items-center gap-2.5 pt-1">
        <Button
          variant="outline"
          className="h-10 flex-1 text-[13px]"
          onClick={async () => {
            try {
              window.open(await fetchPlanPdfUrl(planId), '_blank');
            } catch {
              /* the toast belongs to the caller's error boundary */
            }
          }}
        >
          <FileText className="size-4" /> PDF
        </Button>
        <button type="button" onClick={onOpen} className="text-[12.5px] font-heavy text-pine-2">
          Open case →
        </button>
      </div>
    </div>
  );
}

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
              {/* Frame 38: the active plan opens as a JOURNEY rather than a progress bar.
                  A bar says how far; the journey says which sittings happened, which is
                  under way, and what is still to come — the thing a doctor and a
                  receptionist are both actually asking. */}
              {activePlans.length ? (
                <div className="space-y-2">
                  <p className="text-[9.5px] font-heavy uppercase tracking-eyebrow text-pine-3">
                    Active treatment
                  </p>
                  {/* The case name navigates to case detail, like every other place the
                      app renders one (Global Constraint 10). It was the one render site
                      that did not — which is what made "Schedule remaining" look missing
                      (#81): the control is on that screen, and this heading is how you
                      reach it from here. Named with caseTitle() so the words match the
                      screen it opens. */}
                  <button
                    type="button"
                    onClick={() => goTo(activePlans[0]!.id)}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    <span className="min-w-0 truncate text-[15px] font-heavy text-pine">
                      {caseTitle(activePlans[0]!.name, undefined, activePlans[0]!.teeth)}
                    </span>
                    <Chip tone={activePlans[0]!.status === 'DRAFT' ? 'neutral' : 'live'}>
                      {activePlans[0]!.status === 'DRAFT' ? 'Not started' : 'Active'}
                    </Chip>
                    <ChevronRight className="size-4 shrink-0 text-pine-3" aria-hidden />
                  </button>
                  <ActivePlanJourney planId={activePlans[0]!.id} onOpen={() => goTo(activePlans[0]!.id)} />
                  {activePlans.slice(1).map((pl) => (
                    <button key={pl.id} type="button" onClick={() => goTo(pl.id)} className="w-full rounded-2xl bg-white p-4 text-left shadow-elev-1 active:scale-[0.99]">
                      <div className="flex items-center justify-between">
                        <p className="text-[14px] font-heavy text-pine">{pl.name}</p>
                        <Chip tone={pl.status === 'DRAFT' ? 'neutral' : 'live'}>
                          {pl.status === 'DRAFT' ? 'Not started' : 'Active'}
                        </Chip>
                      </div>
                      <ProgressBar percent={pl.progress.percent} />
                      <p className="mt-1 text-[11.5px] font-semibold text-pine-2">
                        {pl.progress.completedSittings} of {pl.progress.totalSittings} sittings · {rupees(pl.estimatedCostPaise)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
              {pastPlans.length ? (
                <div className="space-y-2">
                  <p className="text-[9.5px] font-heavy uppercase tracking-eyebrow text-pine-3">Past treatments · {pastPlans.length}</p>
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
