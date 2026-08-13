'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Pill, CalendarPlus, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroCard } from '@/components/ds';
import { Odontogram, type ToothStatus } from '@/components/odontogram/odontogram';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { usePlans, useCompletedProcedures } from '@/lib/queries';
import { PatientWhatsAppCard } from '@/components/whatsapp/patient-whatsapp-card';
import { UpcomingAppointments } from './upcoming-appointments';
import { PrescriptionSheet } from './prescription-sheet';
import { NewVisitSheet } from './new-visit-sheet';
import { Section, ProgressBar, QuickAction } from './ui-bits';

export function OverviewTab({ patientId, patientName, records, onOpenTeeth, onOpenBilling }: { patientId: string; patientName: string; records: Record<number, ToothStatus>; onOpenTeeth: () => void; onOpenBilling: () => void }) {
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
      {canRecordFindings ? (
        <HeroCard
          variant="dark"
          icon={<Mic />}
          title="Record findings"
          subtitle="Voice consultation"
          onClick={() => void startConsultation()}
        />
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <QuickAction label="Prescribe" icon={<Pill className="size-5" />} accent="bg-peach-soft" onClick={() => setRx(true)} />
        <QuickAction label="New visit" icon={<CalendarPlus className="size-5" />} accent="bg-sky-soft" onClick={() => setVisitOpen(true)} />
        <QuickAction label="Collect" icon={<IndianRupee className="size-5" />} accent="bg-lime-soft" onClick={onOpenBilling} />
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
