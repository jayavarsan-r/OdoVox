'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Trash2, UserX } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { type ToothStatus } from '@/components/odontogram/odontogram';
import { useToast } from '@/lib/toast';
import { usePatient, useTeeth, useDeletePatient } from '@/lib/queries';
import { initials, statusStyle } from '@/lib/patient-ui';
import { cn } from '@/lib/utils';
import { OverviewTab } from './overview-tab';
import { CasesTab } from './cases-tab';
import { TeethTab } from './teeth-tab';
import { MediaTab } from './media-tab';
import { BillingTab } from './billing-tab';

type Tab = 'overview' | 'cases' | 'teeth' | 'media' | 'billing';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Cases' },
  { id: 'teeth', label: 'Tooth Map' },
  { id: 'media', label: 'Media' },
  { id: 'billing', label: 'Billing' },
];

export default function PatientDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patient = usePatient(id);
  const teeth = useTeeth(id);
  const deletePatient = useDeletePatient();

  const records = useMemo(() => {
    const map: Record<number, ToothStatus> = {};
    for (const t of teeth.data ?? []) map[t.toothNumber] = t.status as ToothStatus;
    return map;
  }, [teeth.data]);

  if (patient.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }
  if (patient.isError || !patient.data) {
    return (
      <EmptyState
        variant="page"
        icon={<UserX />}
        iconTone="peach"
        title="Patient not found"
        body="This patient may have been removed."
        cta={{ label: 'Back to patients', onClick: () => router.push('/patients') }}
      />
    );
  }
  const p = patient.data;
  const s = statusStyle(p.status);

  const doDelete = async () => {
    try {
      await deletePatient.mutateAsync(id);
      toast.success('Patient deleted.');
      router.replace('/patients');
    } catch (err) {
      toast.apiError(err);
    }
  };

  return (
    <AnimatedPage className="flex flex-1 flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 pt-3">
        <button onClick={() => router.back()} aria-label="Back" className="-ml-1 flex size-10 items-center justify-center rounded-pill hover:bg-muted">
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm font-medium text-muted-foreground">Patient</span>
        <button onClick={() => setConfirmDelete(true)} aria-label="Delete patient" className="flex size-10 items-center justify-center rounded-pill text-danger hover:bg-muted">
          <Trash2 className="size-5" />
        </button>
      </div>

      {/* Identity */}
      <div className="flex items-center gap-3 px-5 pt-2">
        <span className={cn('flex size-14 items-center justify-center rounded-pill text-lg font-semibold ring-2 ring-lime/40 ring-offset-2 ring-offset-background', s.avatar)}>
          {initials(p.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
          <p className="text-sm text-muted-foreground">
            {p.age} · {p.gender.toLowerCase()} · <span className="font-mono">{p.phone}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 mt-4 flex gap-1 overflow-x-auto border-b border-border bg-background px-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors',
              tab === t.id ? 'text-ink' : 'text-text-muted',
            )}
          >
            {t.label}
            {tab === t.id ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-pill bg-lime" /> : null}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 py-4">
        {tab === 'overview' && <OverviewTab patientId={id} patientName={patient.data?.name ?? ''} records={records} onOpenTeeth={() => setTab('teeth')} onOpenBilling={() => setTab('billing')} />}
        {tab === 'cases' && <CasesTab patientId={id} />}
        {tab === 'teeth' && <TeethTab patientId={id} records={records} />}
        {tab === 'media' && <MediaTab patientId={id} />}
        {tab === 'billing' && <BillingTab patientId={id} />}
      </div>

      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete patient?">
        <p className="text-sm text-muted-foreground">
          {p.name} will be hidden from all lists. This can be undone by an admin.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={doDelete} loading={deletePatient.isPending}>Delete</Button>
        </div>
      </BottomSheet>
    </AnimatedPage>
  );
}

// ===== Overview ==============================================================
