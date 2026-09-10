'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FileText, FlaskConical, Pill, XCircle, CheckCircle2 } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Input } from '@/components/ui/input';
import { BentoTile, IconCircle, SectionHeader } from '@/components/ds';
import { Chip, Mini } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/avatar';
import { flagChips } from '@/lib/queue/medical-flags';
import { caseTitle } from '@/lib/patients/case-title';
import { rupees } from '@/lib/billing/format';
import { useLabCases } from '@/lib/lab-queries';
import { labCaseTypeLabel } from '@/lib/lab-ui';
import { usePatientAppointments } from '@/lib/schedule/api';
import { formatLocalTime } from '@/lib/schedule/tz';
import { useToast } from '@/lib/toast';
import { usePlan, usePatient, useCompletePlan, useCancelPlan, fetchPlanPdfUrl } from '@/lib/queries';
import { useCreateRecurring } from '@/lib/schedule/api';
import { previewSeries } from '@/lib/schedule/recurring-preview';
import { addDaysISO, localDateISO } from '@/lib/schedule/tz';
import { ApiError } from '@/lib/api-client';
import { CalendarPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const CLINIC_TZ = 'Asia/Kolkata';
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtISO = (iso: string) => `${Number(iso.split('-')[2])} ${MON3[Number(iso.split('-')[1]) - 1]}`;

type Interval = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** §6.2 — pre-schedule the remaining sittings of a plan as a recurring series tied to the plan. */
function ScheduleRemaining({
  patientId,
  planId,
  doctorId,
  procedureName,
  remaining,
  completedSittings,
}: {
  patientId: string;
  planId: string;
  doctorId: string;
  procedureName: string;
  remaining: number;
  completedSittings: number;
}) {
  const toast = useToast();
  const recurring = useCreateRecurring();
  const [interval, setInterval] = useState<Interval>('BIWEEKLY');
  const baseISO = addDaysISO(localDateISO(new Date(), CLINIC_TZ), 7);
  const preview = previewSeries({ firstDateISO: baseISO, interval, totalOccurrences: remaining });

  async function scheduleAll() {
    try {
      await recurring.mutateAsync({
        patientId,
        doctorId,
        firstStartsAt: new Date(`${baseISO}T10:00:00+05:30`),
        durationMinutes: 30,
        totalOccurrences: remaining,
        interval,
        procedureHint: procedureName,
        treatmentPlanId: planId,
      });
      toast.success(`Scheduled ${remaining} sittings`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERIES_UNSCHEDULED') {
        toast.error('Some sittings could not be placed — adjust the interval or pick manually');
      } else {
        toast.apiError(err);
      }
    }
  }

  const options: Array<[Interval, string]> = [['WEEKLY', 'Weekly'], ['BIWEEKLY', 'Every 2 weeks'], ['MONTHLY', 'Monthly']];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-paper-warm p-4">
      <p className="text-sm font-semibold">Schedule remaining sittings</p>
      <div className="flex gap-2">
        {options.map(([v, label]) => (
          <button key={v} type="button" onClick={() => setInterval(v)} className={cn('flex-1 rounded-pill border px-2.5 py-1.5 text-xs font-medium', interval === v ? 'border-lime bg-lime text-ink' : 'border-border')}>
            {label}
          </button>
        ))}
      </div>
      <ul className="text-xs text-text-muted">
        {preview.map((r) => (
          <li key={r.index}>Sitting {completedSittings + r.index} — {fmtISO(r.dateISO)} · 10:00 AM</li>
        ))}
      </ul>
      <Button size="sm" onClick={scheduleAll} loading={recurring.isPending}>
        <CalendarPlus className="size-4" /> Schedule all
      </Button>
    </div>
  );
}


export default function PlanDetailPage() {
  const { id: patientId, planId } = useParams<{ id: string; planId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: plan, isLoading } = usePlan(planId);
  const completeMut = useCompletePlan(planId, patientId);
  const cancelMut = useCancelPlan(planId, patientId);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const patient = usePatient(patientId);
  // The plan's own lab case and prescription — both already linked in the data model
  // (LabCase.treatmentPlanId, and prescriptions across the plan's sitting visits).
  const labCases = useLabCases({ patientId });
  const appts = usePatientAppointments(patientId);

  if (isLoading || !plan) {
    return (
      <AnimatedPage>
        <div className="flex h-64 items-center justify-center"><Spinner /></div>
      </AnimatedPage>
    );
  }

  const proc = plan.procedures[0];
  const active = plan.status === 'ACTIVE';

  // This plan's lab case, and the most recent prescription raised across its sittings.
  const labCase = (labCases.data?.pages.flatMap((pg) => pg.items) ?? []).find(
    (c) => c.treatmentPlanId === planId,
  );
  // `medicines` is stored as JSON, so it arrives as `unknown`. Narrow it here instead of
  // asserting — a malformed row should render no Rx line, never crash the case screen.
  const lastRx = plan.prescriptions[plan.prescriptions.length - 1]?.medicines;
  const activeRx = Array.isArray(lastRx)
    ? lastRx
        .map((m) => (typeof m === 'object' && m && 'name' in m ? String((m as { name: unknown }).name) : ''))
        .filter(Boolean)
        .join(' + ') || null
    : null;
  // The next booked sitting for THIS plan — appointments carry treatmentPlanId.
  const nextAppt = (appts.data?.appointments ?? [])
    .filter((a) => a.treatmentPlanId === planId && a.status === 'SCHEDULED')
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];

  async function markComplete() {
    try {
      await completeMut.mutateAsync();
      toast.success('Plan marked complete.');
    } catch (err) {
      toast.apiError(err);
    }
  }

  async function doCancel() {
    if (!reason.trim()) return;
    try {
      await cancelMut.mutateAsync(reason.trim());
      toast.success('Plan cancelled.');
      setCancelOpen(false);
    } catch (err) {
      toast.apiError(err);
    }
  }

  async function viewPdf() {
    try {
      const url = await fetchPlanPdfUrl(planId);
      window.open(url, '_blank');
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <AnimatedPage>
      <div className="flex flex-col gap-5 px-4 pb-28 pt-4">
        {/* Frame 39's header: the case names itself. "RCT · Tooth 36" is the string every
            other surface in the app uses to refer to this plan, so it is the title here —
            landing on a screen headed "Treatment Plan" makes you check you opened the right
            one. The sitting chip carries live progress. */}
        <header className="flex items-center gap-2.5">
          <IconCircle size="md" tone="surface" aria-label="Back" onClick={() => router.push(`/patients/${patientId}`)}>
            <ChevronLeft />
          </IconCircle>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-heavy text-pine">
            {caseTitle(plan.name, proc?.name, proc?.toothNumbers ?? [])}
          </h1>
          <Chip tone={active ? 'live' : 'neutral'}>
            Sitting {plan.progress.completedSittings}/{plan.progress.totalSittings}
          </Chip>
          <IconCircle size="md" tone="surface" aria-label="Case sheet PDF" onClick={viewPdf}>
            <FileText />
          </IconCircle>
        </header>

        {/* The patient this case belongs to — one tap back to their record. Clinical flags
            render only where the payload carries them (ruling B1), so a receptionist sees
            the row without the allergy. */}
        {patient.data ? (
          <button
            type="button"
            onClick={() => router.push(`/patients/${patientId}`)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-elev-1"
          >
            <InitialsAvatar name={patient.data.name} ring="none" size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-heavy text-pine">{patient.data.name}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                {flagChips(patient.data.medicalFlags).chips.map((c) => (
                  <Mini key={c.label} tone={c.tone}>{c.label}</Mini>
                ))}
                <Mini tone="neutral">{patient.data.patientCode}</Mini>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-pine-3" aria-hidden />
          </button>
        ) : null}

        {/* FEES over NEXT. Fees are what has actually been paid against this plan, derived
            from its own bill items — never the bill's whole payment, which would credit
            another procedure's money to this one. */}
        <div className="grid grid-cols-2 gap-gap-tight">
          <BentoTile label="FEES">
            <span className="mt-[3px] block text-[23px] font-heavy leading-none tracking-tight tabular-nums text-pine">
              {rupees(plan.paidPaise)}
              {plan.estimatedCostPaise > 0 ? (
                <span className="text-[13px] font-bold text-pine-3">
                  {' '}/ {(plan.estimatedCostPaise / 100).toLocaleString('en-IN')}
                </span>
              ) : null}
            </span>
            {plan.estimatedCostPaise > 0 ? (
              <span className="mt-2 block h-1.5 overflow-hidden rounded-sm bg-hair-2">
                <span
                  className="block h-full rounded-sm bg-lime"
                  style={{ width: `${Math.min(100, Math.round((plan.paidPaise / plan.estimatedCostPaise) * 100))}%` }}
                />
              </span>
            ) : null}
          </BentoTile>

          <BentoTile tone="sky" label="NEXT">
            {nextAppt ? (
              <>
                <span className="mt-[3px] block text-[19px] font-heavy leading-tight tracking-tight text-sky">
                  {new Date(nextAppt.startsAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: CLINIC_TZ })}
                  {' '}
                  {formatLocalTime(nextAppt.startsAt, CLINIC_TZ)}
                </span>
                {nextAppt.procedureHint ? (
                  <span className="mt-1 block text-3xs font-bold text-sky">{nextAppt.procedureHint}</span>
                ) : null}
              </>
            ) : (
              <span className="mt-[3px] block text-[15px] font-heavy leading-tight text-sky">
                Not booked
              </span>
            )}
          </BentoTile>
        </div>

        {/* Sittings. */}
        {proc ? (
          <div>
            <SectionHeader title="Sittings" className="px-0 pt-0" />
            <div className="overflow-hidden rounded-2xl bg-white shadow-elev-1">
              {Array.from({ length: proc.totalSittings }, (_, i) => i + 1).map((n) => {
                const sit = proc.sittings.find((x) => x.sittingNumber === n);
                const done = sit?.completed ?? false;
                const isNext = !done && n === proc.completedSittings + 1;
                // Frame 39 has each sitting open its visit record (frame 43). That sheet
                // is not built: its body is FINDINGS and PROCEDURE prose, and those
                // extraction fields do not exist (#52), so the row would open a mostly
                // empty sheet. Rendered as a row rather than a dead button until #52
                // lands — no chevron, so it does not advertise a destination.
                return (
                  <div
                    key={n}
                    className="flex w-full items-center gap-3 border-b border-hair px-4 py-3 text-left last:border-0"
                  >
                    <Mini tone={done ? 'live' : isNext ? 'sky' : 'neutral'}>
                      S{n}{done ? ' ✓' : ''}
                    </Mini>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[14px] font-heavy', done || isNext ? 'text-pine' : 'text-pine-3')}>
                        {sit?.notes?.trim() || (done ? `Sitting ${n} completed` : isNext ? 'Next sitting' : `Sitting ${n}`)}
                      </span>
                      {sit && (done || isNext) ? (
                        <span className="mt-0.5 block text-[11.5px] font-semibold text-pine-3">
                          {new Date(sit.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: CLINIC_TZ })}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Linked work: the lab case this plan raised, and its active prescription. Both are
            real records; neither renders when the plan has none. */}
        {(labCase || activeRx) ? (
          <div>
            <SectionHeader title="Linked" className="px-0 pt-0" />
            <div className="overflow-hidden rounded-2xl bg-white shadow-elev-1">
              {labCase ? (
                <button
                  type="button"
                  onClick={() => router.push(`/lab/${labCase.id}`)}
                  className="flex w-full items-center gap-3 border-b border-hair px-4 py-3 text-left last:border-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-peach-soft">
                    <FlaskConical className="size-4 text-pine" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-heavy text-pine">
                      {labCase.caseNumber} · {labCaseTypeLabel(labCase.type)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-pine-3" aria-hidden />
                </button>
              ) : null}
              {activeRx ? (
                <button
                  type="button"
                  onClick={() => router.push(`/patients/${patientId}?tab=overview`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-sage-tint">
                    <Pill className="size-4 text-pine" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-heavy text-pine">
                    Active Rx · {activeRx}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-pine-3" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Schedule remaining sittings (§6.2) */}
        {active && proc && plan.createdById && proc.totalSittings - proc.completedSittings > 0 ? (
          <ScheduleRemaining
            patientId={patientId}
            planId={planId}
            doctorId={plan.createdById}
            procedureName={proc.name}
            remaining={proc.totalSittings - proc.completedSittings}
            completedSittings={proc.completedSittings}
          />
        ) : null}

        {/* Actions */}
        {active ? (
          <div className="flex flex-col gap-2">
            <Button onClick={markComplete} loading={completeMut.isPending}>
              <CheckCircle2 className="size-4" /> Mark plan complete
            </Button>
            <Button variant="ghost" className="text-danger" onClick={() => setCancelOpen(true)}>
              <XCircle className="size-4" /> Cancel plan
            </Button>
          </div>
        ) : plan.status === 'CANCELLED' && plan.cancellationReason ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-text-muted">
            Cancelled{plan.cancelledAt ? ` on ${new Date(plan.cancelledAt).toLocaleDateString('en-IN')}` : ''}: “{plan.cancellationReason}”
          </div>
        ) : null}

        {plan.description ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Notes</p>
            <p className="text-sm text-ink">{plan.description}</p>
          </div>
        ) : null}
      </div>

      <BottomSheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel plan">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">This stops the plan and all its procedures. A future consultation will start a new plan instead of continuing this one.</p>
          <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="destructive" disabled={!reason.trim()} loading={cancelMut.isPending} onClick={doCancel}>
            Cancel this plan
          </Button>
        </div>
      </BottomSheet>
    </AnimatedPage>
  );
}
