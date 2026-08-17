'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Mic, Phone, Pill, CalendarPlus, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconCircle, ProgressRing } from '@/components/ds';
import { Mini } from '@/components/ui/badge';
import { rupees } from '@/lib/billing/format';
import { Odontogram, type ToothStatus } from '@/components/odontogram/odontogram';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { usePlans, useCompletedProcedures } from '@/lib/queries';
import { PatientWhatsAppCard } from '@/components/whatsapp/patient-whatsapp-card';
import { UpcomingAppointments } from './upcoming-appointments';
import { PrescriptionSheet } from './prescription-sheet';
import { NewVisitSheet } from './new-visit-sheet';
import { Section } from './ui-bits';

export function OverviewTab({ patientId, patientName, patientPhone, records, onOpenTeeth, onOpenBilling }: { patientId: string; patientName: string; patientPhone?: string; records: Record<number, ToothStatus>; onOpenTeeth: () => void; onOpenBilling: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const completedProcedures = useCompletedProcedures(patientId);
  const plans = usePlans(patientId);
  const [rx, setRx] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const activePlan = plans.data?.find((pl) => pl.status === 'ACTIVE');
  // Phase 9.6 Issue 14: recording clinical findings is a doctor act (regulatory). Receptionists
  // never see the record surface — the server 403s POST /consultations for them anyway.
  const role = useAuth((s) => s.activeMembership?.role);
  const canRecordFindings = role === 'DOCTOR' || role === 'ADMIN';

  const startConsultation = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { consultationId } = await api.post<{ consultationId: string }>('/consultations', { patientId });
      router.push(`/consult/${consultationId}?patientId=${patientId}`);
    } catch {
      toast.info('Could not start the consultation. Please try again.');
      setStarting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Frame 37's action row (ruling B2: reorganize, never remove).
      
          Recording is the dominant surface — a full-width lime CTA — with the two
          everyday actions as circles beside it. The three equally-weighted pastel tiles
          are gone as a LAYOUT, not as features: Prescribe becomes the Rx circle, phone is
          new here (the frame has it and a patient record with no way to call the patient
          was a gap), and New visit / Collect move to a secondary row below where they
          stay one tap away without competing with the primary action.

          The recording CTA stays doctor-only. */}
      <div className="flex items-center gap-2.5">
        {canRecordFindings ? (
          <Button block className="h-12 flex-1" onClick={() => void startConsultation()}>
            <Mic /> Record findings
          </Button>
        ) : null}
        <IconCircle
          size="lg"
          tone="surface"
          aria-label={`Call ${patientName}`}
          onClick={() => patientPhone && window.open(`tel:${patientPhone}`)}
        >
          <Phone />
        </IconCircle>
        <IconCircle size="lg" tone="surface" aria-label="New prescription" onClick={() => setRx(true)}>
          <Pill />
        </IconCircle>
      </div>

      <div className="flex gap-2.5">
        <Button variant="outline" className="h-11 flex-1 text-[13px]" onClick={() => setVisitOpen(true)}>
          <CalendarPlus className="size-4" /> New visit
        </Button>
        <Button variant="outline" className="h-11 flex-1 text-[13px]" onClick={onOpenBilling}>
          <IndianRupee className="size-4" /> Collect
        </Button>
      </div>

      {/* Frame 37's active-case card: a progress RING rather than a bar, because it reads
          as a single glanceable figure ("2/3") beside the case name instead of a length the
          eye has to measure. Tapping it opens the case; Continue treatment stays doctor-only. */}
      {activePlan ? (
        <div className="rounded-2xl bg-white p-4 shadow-elev-1">
          <button
            type="button"
            onClick={() => router.push(`/patients/${patientId}/plans/${activePlan.id}`)}
            className="flex w-full items-center gap-3.5 text-left"
          >
            <ProgressRing
              value={activePlan.progress.completedSittings}
              max={activePlan.progress.totalSittings}
              size={60}
            />
            <span className="min-w-0 flex-1">
              {/* Only append teeth when the plan name does not already carry them —
                  a plan called "RCT · Tooth 36" was rendering "RCT · Tooth 36 · Tooth 36". */}
              <span className="block truncate text-[14.5px] font-heavy text-pine">
                {activePlan.name}
                {activePlan.teeth.length && !/tooth/i.test(activePlan.name)
                  ? ` · Tooth ${activePlan.teeth.join(', ')}`
                  : ''}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {activePlan.progress.completedSittings < activePlan.progress.totalSittings ? (
                  <Mini tone="lav">
                    Next: sitting {activePlan.progress.completedSittings + 1}
                  </Mini>
                ) : null}
                <Mini tone="neutral">{rupees(activePlan.estimatedCostPaise)}</Mini>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-pine-3" aria-hidden />
          </button>
          {canRecordFindings ? (
            <Button variant="outline" className="mt-3 h-11 w-full text-[13px]" loading={starting} onClick={() => void startConsultation()}>
              <Mic className="size-4" /> Continue treatment
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-4 text-[13px] font-semibold text-pine-3 shadow-elev-1">
          No active treatment yet.
        </div>
      )}

      <UpcomingAppointments patientId={patientId} />

      <PatientWhatsAppCard patientId={patientId} patientName={patientName} />

      <Section title="Teeth" action={<button onClick={onOpenTeeth} className="text-[12.5px] font-heavy text-pine-2">Map →</button>}>
        <div className="rounded-2xl bg-white p-3 shadow-elev-1">
          <Odontogram records={records} compact activePlanTeeth={[...new Set((plans.data ?? []).filter((p) => p.status === 'ACTIVE').flatMap((p) => p.teeth))]} onToothTap={onOpenTeeth} />
        </div>
      </Section>

      <Section title="Previous work">
        {(completedProcedures.data?.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">No completed procedures yet.</div>
        ) : (
          <div className="space-y-2">
            {completedProcedures.data!.slice(0, 5).map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-sm font-medium">
                  {p.name}
                  {p.toothNumbers.length ? ` · Tooth ${p.toothNumbers.join(', ')}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(p.completedAt).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <PrescriptionSheet patientId={patientId} open={rx} onClose={() => setRx(false)} />
      <NewVisitSheet patientId={patientId} open={visitOpen} onClose={() => setVisitOpen(false)} />
    </div>
  );
}

// ===== Cases =================================================================
