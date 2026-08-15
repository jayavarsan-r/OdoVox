'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Phone, Pill, CalendarPlus, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconCircle } from '@/components/ds';
import { Odontogram, type ToothStatus } from '@/components/odontogram/odontogram';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { usePlans, useCompletedProcedures } from '@/lib/queries';
import { PatientWhatsAppCard } from '@/components/whatsapp/patient-whatsapp-card';
import { UpcomingAppointments } from './upcoming-appointments';
import { PrescriptionSheet } from './prescription-sheet';
import { NewVisitSheet } from './new-visit-sheet';
import { Section, ProgressBar } from './ui-bits';

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

      <Section title="Current treatment">
        {activePlan ? (
          <div className="rounded-lg border border-sage/40 bg-sage-tint/40 p-4">
            <button type="button" onClick={() => router.push(`/patients/${patientId}/plans/${activePlan.id}`)} className="w-full text-left">
              <p className="text-sm font-semibold text-ink">{activePlan.name}{activePlan.teeth.length ? ` · Tooth ${activePlan.teeth.join(', ')}` : ''}</p>
              <ProgressBar percent={activePlan.progress.percent} />
              <p className="mt-1 text-xs text-text-muted">{activePlan.progress.completedSittings} of {activePlan.progress.totalSittings} sittings completed</p>
            </button>
            {canRecordFindings ? (
              <Button variant="ghost" size="sm" className="mt-2 w-full" loading={starting} onClick={() => void startConsultation()}>
                <Mic className="size-4" /> Continue treatment
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">No active treatment yet.</div>
        )}
      </Section>

      <UpcomingAppointments patientId={patientId} />

      <PatientWhatsAppCard patientId={patientId} patientName={patientName} />

      <Section title="Affected teeth" action={<button onClick={onOpenTeeth} className="text-sm text-muted-foreground">Open →</button>}>
        <div className="rounded-lg border border-border bg-surface p-3">
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
