'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ChevronLeft, MoreHorizontal, Trash2, UserX } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { type ToothStatus } from '@/components/odontogram/odontogram';
import { useToast } from '@/lib/toast';
import { usePatient, useTeeth, useDeletePatient, usePlans } from '@/lib/queries';

import { cn } from '@/lib/utils';
import { IconCircle } from '@/components/ds';
import { InitialsAvatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/badge';
import { flagChips } from '@/lib/queue/medical-flags';
import { rupees } from '@/lib/billing/format';
import { OverviewTab } from './overview-tab';
import { CasesTab } from './cases-tab';
import { TeethTab } from './teeth-tab';
import { MediaTab } from './media-tab';
import { BillingTab } from './billing-tab';

type Tab = 'overview' | 'cases' | 'teeth' | 'media' | 'billing';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Cases' },
  { id: 'teeth', label: 'Teeth' },
  { id: 'media', label: 'Media' },
  { id: 'billing', label: 'Billing' },
];

/** One of frame 37's three facts. Quiet label, loud value. */
function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'crit';
}) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2.5 text-center shadow-elev-1">
      <p
        className={cn(
          'text-[15px] font-heavy leading-none tracking-tight tabular-nums',
          tone === 'crit' ? 'text-crit' : 'text-pine',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[9.5px] font-heavy uppercase tracking-eyebrow text-pine-3">
        {label}
      </p>
    </div>
  );
}

export default function PatientDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const plans = usePlans(id);

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
  const flags = flagChips(p.medicalFlags);

  // Sittings across every ACTIVE plan — the frame's "2/3". Plans are already fetched for
  // the tabs, so this costs no extra request.
  const activePlans = (plans.data ?? []).filter((pl) => pl.status === 'ACTIVE');
  const sittingsDone = activePlans.reduce((n, pl) => n + pl.progress.completedSittings, 0);
  const sittingsTotal = activePlans.reduce((n, pl) => n + pl.progress.totalSittings, 0);
  const sittingsLabel = sittingsTotal > 0 ? `${sittingsDone}/${sittingsTotal}` : '—';

  // "8 Jul". A patient who has never been seen shows a dash, not today's date.
  const lastVisitLabel = p.lastVisitAt
    ? new Date(p.lastVisitAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Kolkata',
      })
    : '—';

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
      {/* Frame 37's identity block: a back circle and an overflow menu, then the patient
          centred under a lime-ringed avatar.

          Delete moved OUT of the top bar into the ⋯ menu. It was a bare red trash icon one
          tap from the back button — the frame's own arrangement is the safer one, and
          nothing is lost: the same action, one tap further from an accident. */}
      <header className="flex items-center justify-between px-gutter pt-2">
        <IconCircle size="md" tone="surface" aria-label="Back" onClick={() => router.back()}>
          <ChevronLeft />
        </IconCircle>
        <IconCircle
          size="md"
          tone="surface"
          aria-label="More actions"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreHorizontal />
        </IconCircle>
      </header>

      {menuOpen ? (
        <div className="mx-gutter mt-2 overflow-hidden rounded-2xl bg-white shadow-elev-1">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setConfirmDelete(true);
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13.5px] font-heavy text-crit"
          >
            <Trash2 className="size-4" /> Delete patient
          </button>
        </div>
      ) : null}

      <div className="mt-1 flex flex-col items-center px-gutter">
        <InitialsAvatar name={p.name} ring="lime" size="xl" />
        <h1 className="mt-2.5 truncate text-[22px] font-heavy tracking-tight text-pine">
          {p.name}
        </h1>
        {/* AGE · SEX · PATIENT CODE (ruling B3). The phone is not repeated here — it has
            its own action below, and the code is what staff quote to each other. */}
        <p className="mt-0.5 text-[12.5px] font-semibold text-pine-2">
          {p.age} · {p.gender.charAt(0).toUpperCase()} · {p.patientCode}
        </p>

        {/* Clinical flags. The server sends these ONLY to DOCTOR/ADMIN (ruling B1), so a
            receptionist's payload has an empty array and this renders nothing — the gate
            is the data boundary, and this is just what is left after it. */}
        {flags.chips.length > 0 ? (
          <span className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {flags.chips.map((c) => (
              <Chip key={c.label} tone={c.tone}>
                {c.tone === 'crit' ? <AlertTriangle className="size-3" /> : null}
                {c.label}
              </Chip>
            ))}
            {flags.more > 0 ? <Chip tone="neutral">+{flags.more}</Chip> : null}
          </span>
        ) : null}
      </div>

      {/* Three facts worth knowing before you act: how far through treatment, when they
          were last here, what they owe. */}
      <div className="mt-3.5 grid grid-cols-3 gap-gap-tight px-gutter">
        <StatCard label="SITTINGS" value={sittingsLabel} />
        <StatCard label="LAST VISIT" value={lastVisitLabel} />
        <StatCard
          label="BALANCE"
          value={rupees(p.outstandingPaise)}
          tone={p.outstandingPaise > 0 ? 'crit' : 'neutral'}
        />
      </div>

      {/* `.ptabs` — the spec's inset pill group, replacing the underline row.
      
          FIVE tabs, not the frame's four: the app has Media, which has no frame and must
          not be dropped. They share the width evenly, so the group stays one object rather
          than a scrolling strip that hides whichever tab falls off the right edge. */}
      <div className="sticky top-0 z-10 mx-4 mt-[14px] flex gap-0.5 rounded-pill bg-[rgba(31,42,35,0.05)] p-1 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cn(
              // No horizontal padding and slightly tighter tracking: five tabs share a
              // 370px row where the frame had four, and the frame's 13px/px-3 truncated
              // the active tab's own label to "Overvi…".
              'h-[34px] min-w-0 flex-1 rounded-pill text-[12.5px] tracking-tight transition-colors',
              tab === t.id
                ? 'bg-white font-heavy text-pine shadow-[0_3px_10px_rgba(31,42,35,0.12)]'
                : 'font-semibold text-pine-2',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 py-4">
        {tab === 'overview' && <OverviewTab patientId={id} patientName={p.name} patientPhone={p.phone} records={records} onOpenTeeth={() => setTab('teeth')} onOpenBilling={() => setTab('billing')} />}
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
