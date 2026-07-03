'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Trash2,
  Mic,
  Pill,
  CalendarPlus,
  IndianRupee,
  Plus,
  FileText,
  Image as ImageIcon,
  ClipboardList,
  Receipt,
  UserX,
  Star,
  X,
} from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState, HeroCard } from '@/components/ds';
import {
  Odontogram,
  OdontogramLegend,
  TOOTH_STATUSES,
  TOOTH_TONE,
  type ToothStatus,
} from '@/components/odontogram/odontogram';
import { api } from '@/lib/api-client';
import { VoiceInput } from '@/components/voice/voice-input';
import { useToast } from '@/lib/toast';
import {
  usePatient,
  useTeeth,
  useUpsertTooth,
  usePlans,
  useCreatePlan,
  useCompletedProcedures,
  useCreateVisit,
  useCreatePrescription,
  useMedia,
  useUploadMedia,
  useDeleteMedia,
  useDeletePatient,
  fetchMediaUrl,
  fetchPrescriptionPdfUrl,
  useTemplates,
  useApplyTemplate,
  useCreateTemplate,
} from '@/lib/queries';
import { initials, statusStyle, rupees } from '@/lib/patient-ui';
import { useLabCases } from '@/lib/lab-queries';
import { labCaseTypeLabel, labStatusStyle } from '@/lib/lab-ui';
import { usePatientAppointments } from '@/lib/schedule/api';
import { appointmentSubtitle } from '@/lib/schedule/format';
import { formatLocalTime } from '@/lib/schedule/tz';
import { cn } from '@/lib/utils';
import { useBills } from '@/lib/billing/api';
import { billStatusStyle } from '@/lib/billing/format';
import { BillSheet } from '@/components/billing/bill-sheet';
import { PatientWhatsAppCard } from '@/components/whatsapp/patient-whatsapp-card';

const CLINIC_TZ = 'Asia/Kolkata';
const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function UpcomingAppointments({ patientId }: { patientId: string }) {
  const { data } = usePatientAppointments(patientId);
  const appts = data?.appointments ?? [];
  if (appts.length === 0) return null;
  return (
    <Section title={`Upcoming appointments · ${appts.length}`}>
      <ul className="flex flex-col gap-2">
        {appts.map((a) => {
          const d = new Date(a.startsAt);
          const dateLabel = `${DAY3[d.getDay()]} ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: CLINIC_TZ })}`;
          const sub = appointmentSubtitle(a);
          return (
            <li key={a.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="font-medium tabular-nums">{dateLabel} {formatLocalTime(d, CLINIC_TZ)}</span>
              {sub ? <span className="text-text-muted"> — {sub}</span> : null}
              {a.doctorName ? <span className="text-text-muted"> — {a.doctorName}</span> : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

type Tab = 'overview' | 'cases' | 'teeth' | 'media' | 'billing';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Cases' },
  { id: 'teeth', label: 'Tooth Map' },
  { id: 'media', label: 'Media' },
  { id: 'billing', label: 'Billing' },
];
const FREQ = ['OD', 'BD', 'TID', 'QID', 'SOS'];
const MED_SUGGESTIONS = [
  'Amoxicillin 500mg',
  'Ibuprofen 400mg',
  'Paracetamol 500mg',
  'Metronidazole 400mg',
  'Chlorhexidine MW',
  'Diclofenac 50mg',
];

interface Med {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

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
function OverviewTab({ patientId, patientName, records, onOpenTeeth, onOpenBilling }: { patientId: string; patientName: string; records: Record<number, ToothStatus>; onOpenTeeth: () => void; onOpenBilling: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const completedProcedures = useCompletedProcedures(patientId);
  const plans = usePlans(patientId);
  const [rx, setRx] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const activePlan = plans.data?.find((pl) => pl.status === 'ACTIVE');

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
      <HeroCard
        variant="dark"
        icon={<Mic />}
        title="Record findings"
        subtitle="Voice consultation"
        onClick={() => void startConsultation()}
      />

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
            <Button variant="ghost" size="sm" className="mt-2 w-full" loading={starting} onClick={() => void startConsultation()}>
              <Mic className="size-4" /> Continue treatment
            </Button>
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
function CasesTab({ patientId }: { patientId: string }) {
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
function PatientLabCases({ patientId }: { patientId: string }) {
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
function TeethTab({ patientId, records }: { patientId: string; records: Record<number, ToothStatus> }) {
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
function MediaTab({ patientId }: { patientId: string }) {
  const toast = useToast();
  const media = useMedia(patientId);
  const upload = useUploadMedia(patientId);
  const del = useDeleteMedia(patientId);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const type = file.type === 'application/pdf' ? 'DOCUMENT' : 'XRAY';
    try {
      await upload.mutateAsync({ file, type });
      toast.success('Uploaded.');
    } catch (err) {
      toast.apiError(err);
    }
  };

  const items = media.data?.items ?? [];
  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface p-4 text-sm font-medium text-muted-foreground">
        {upload.isPending ? <Spinner /> : <Plus className="size-4" />}
        Upload x-ray, photo or document
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {media.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<ImageIcon />}
          iconTone="sky"
          title="No media yet"
          body="Upload x-rays, photos, or documents."
        />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((m) => (
            <MediaThumb key={m.id} id={m.id} type={m.type} onDelete={() => del.mutate(m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaThumb({ id, type, onDelete }: { id: string; type: string; onDelete: () => void }) {
  const { data: url } = useQuery({ queryKey: ['media-url', id], queryFn: () => fetchMediaUrl(id) });
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-paper-warm">
      {type === 'DOCUMENT' || !url ? (
        <button onClick={() => url && window.open(url, '_blank')} className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <FileText className="size-6" /> {type === 'DOCUMENT' ? 'PDF' : '…'}
        </button>
      ) : (
        <img src={url} alt="media" className="size-full object-cover" onClick={() => window.open(url, '_blank')} />
      )}
      <button onClick={onDelete} aria-label="Delete" className="absolute right-1 top-1 hidden rounded-pill bg-ink/70 p-1 text-paper group-hover:block">
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

// ===== Billing ===============================================================
interface BillingData {
  summary: { totalBilledPaise: number; totalPaidPaise: number; outstandingPaise: number };
  bills: { id: string; totalPaise: number; paidPaise: number; status: string; createdAt: string }[];
}
function BillingTab({ patientId }: { patientId: string }) {
  const billing = useQuery({ queryKey: ['billing', patientId], queryFn: () => api.get<BillingData>(`/patients/${patientId}/billing`) });
  const bills = useBills({ patientId });
  const [openBillId, setOpenBillId] = useState<string | null>(null);
  const toast = useToast();

  async function openStatement() {
    try {
      const res = await api.get<{ url: string }>(`/reports/patient-statement?patientId=${patientId}`);
      window.open(res.url, '_blank');
    } catch {
      toast.error('Could not generate statement');
    }
  }

  if (billing.isLoading || bills.isLoading) return <Spinner />;
  const d = billing.data!;
  const rows = bills.data?.items ?? [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface p-4">
        <div><p className="text-xs text-muted-foreground">Billed</p><p className="font-semibold">{rupees(d.summary.totalBilledPaise)}</p></div>
        <div><p className="text-xs text-muted-foreground">Paid</p><p className="font-semibold">{rupees(d.summary.totalPaidPaise)}</p></div>
        <div><p className="text-xs text-muted-foreground">Due</p><p className="font-semibold text-danger">{rupees(d.summary.outstandingPaise)}</p></div>
      </div>
      {rows.length > 0 && (
        <button type="button" onClick={openStatement} className="text-sm font-medium text-info">
          Print statement
        </button>
      )}
      {rows.length === 0 ? (
        <EmptyState variant="inline" icon={<Receipt />} iconTone="neutral" title="No bills yet" body="Bills will appear here after visits." />
      ) : (
        rows.map((b) => {
          const s = billStatusStyle(b.status);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setOpenBillId(b.id)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-ink">{b.billNumber}</p>
                <p className="text-xs text-text-subtle">{new Date(b.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm tabular-nums text-ink">{rupees(b.totalPaise)}</span>
                <span className={cn('rounded-pill px-2 py-0.5 text-xs font-medium', s.pill)}>{s.label}</span>
              </div>
            </button>
          );
        })
      )}
      <BillSheet billId={openBillId} onClose={() => setOpenBillId(null)} />
    </div>
  );
}

// ===== Shared sub-forms ======================================================
function PrescriptionSheet({ patientId, open, onClose }: { patientId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const createRx = useCreatePrescription(patientId);
  const [meds, setMeds] = useState<Med[]>([]);
  const [instructions, setInstructions] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);

  // Phase 5: template picker. `applied` is the template currently populating the sheet (null = none).
  const [templateSearch, setTemplateSearch] = useState('');
  const [applied, setApplied] = useState<{ id: string; name: string } | null>(null);
  const { data: templateData } = useTemplates(templateSearch);
  const templates = templateData?.items ?? [];
  const applyTemplate = useApplyTemplate();
  const createTemplate = useCreateTemplate();

  const addMed = (name: string) => setMeds((m) => [...m, { name, dosage: '1 tab', frequency: 'BD', durationDays: 5 }]);

  async function pickTemplate(id: string, name: string) {
    try {
      const res = await applyTemplate.mutateAsync(id);
      setMeds(
        res.medicines.map((p) => ({
          name: p.name,
          dosage: p.dosage,
          frequency: p.frequency,
          durationDays: p.durationDays ?? 5,
          instructions: p.instructions,
        })),
      );
      if (res.instructions) setInstructions(res.instructions);
      setApplied({ id, name });
      toast.info(`Applied “${name}” — review and edit before saving.`);
    } catch (err) {
      toast.apiError(err);
    }
  }

  function clearTemplate() {
    setApplied(null);
    setMeds([]);
  }

  async function saveAsTemplate() {
    const name = window.prompt('Template name (e.g. RCT pack)')?.trim();
    if (!name) return;
    try {
      await createTemplate.mutateAsync({
        name,
        medicines: meds.map((m) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          durationDays: m.durationDays,
          instructions: m.instructions,
        })),
        instructions: instructions || undefined,
      });
      toast.success(`Saved “${name}” as a template.`);
    } catch (err) {
      toast.apiError(err);
    }
  }

  // Dictation (Phase 3) now also recognises a spoken template name → applied pill.
  const onRxExtraction = ({ prescription, templateUsed, safetyWarnings }: {
    prescription: { prescriptions: { name: string; dosage: string | null; frequency: string | null; durationDays: number | null }[] };
    templateUsed: { id: string; name: string } | null;
    safetyWarnings: string[];
  }) => {
    setMeds(
      prescription.prescriptions.map((p) => ({
        name: p.name,
        dosage: p.dosage ?? '1 tab',
        frequency: (p.frequency ?? 'BD') as Med['frequency'],
        durationDays: p.durationDays ?? 5,
      })),
    );
    setApplied(templateUsed);
    if (safetyWarnings.length) toast.info(`Safety: ${safetyWarnings.join(', ')} — verify before saving.`);
    else if (templateUsed) toast.info(`Applied “${templateUsed.name}” from your voice — review and edit.`);
    else toast.info('Filled from your voice — review and edit.');
  };

  const save = async () => {
    try {
      const rx = await createRx.mutateAsync({ medicines: meds, instructions: instructions || undefined });
      setSavedId(rx.id);
      toast.success('Prescription saved.');
    } catch (err) {
      toast.apiError(err);
    }
  };
  const viewPdf = async () => {
    if (!savedId) return;
    const url = await fetchPrescriptionPdfUrl(savedId);
    window.open(url, '_blank');
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="New prescription">
      {savedId ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">Prescription saved.</p>
          <Button className="w-full" onClick={viewPdf}><FileText className="size-4" /> View PDF</Button>
          <Button variant="outline" className="w-full" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <VoiceInput
            mode="extraction"
            endpoint="/prescriptions/dictate"
            extraBody={{ patientId }}
            placement="sheet"
            label="Dictate prescription"
            hint="Medicines · dosage · duration (auto-stops)"
            onExtraction={onRxExtraction}
          />

          {/* Phase 5: template picker — one tap fills the medicines below. */}
          {applied ? (
            <div className="flex items-center justify-between rounded-pill bg-sage-tint px-3 py-1.5 text-xs font-medium text-sage-deep">
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-3.5" /> Used: {applied.name}
              </span>
              <button type="button" aria-label="Clear template" onClick={clearTemplate} className="flex size-5 items-center justify-center rounded-pill hover:bg-sage-soft">
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Templates</p>
              <Input placeholder="Search templates…" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} />
              {templates.length ? (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => void pickTemplate(t.id, t.name)}
                      disabled={applyTemplate.isPending}
                      className="shrink-0 rounded-lg border border-border bg-paper-warm p-2.5 text-left active:scale-[0.98]"
                      style={{ minWidth: 140 }}
                    >
                      <span className="block truncate text-sm font-semibold text-ink">{t.name}</span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
                        <span className="inline-flex items-center gap-1"><Pill className="size-3" /> {t.medicines.length}</span>
                        <span className="inline-flex items-center gap-1"><Star className="size-3" /> {t.usageCount}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No templates yet — build one in Clinic › Templates.</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {MED_SUGGESTIONS.map((m) => (
              <button key={m} type="button" onClick={() => addMed(m)} className="rounded-pill border border-border px-3 py-1 text-xs">{m}</button>
            ))}
          </div>
          {meds.map((med, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{med.name}</p>
                <button onClick={() => setMeds((ms) => ms.filter((_, j) => j !== i))} className="text-danger" aria-label="Remove">−</button>
              </div>
              <div className="flex gap-2">
                <Input className="flex-1" placeholder="Dosage" value={med.dosage} onChange={(e) => setMeds((ms) => ms.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))} />
                <Input className="w-20" type="number" min={1} value={med.durationDays} onChange={(e) => setMeds((ms) => ms.map((x, j) => (j === i ? { ...x, durationDays: Number(e.target.value) } : x)))} />
              </div>
              <div className="flex gap-1.5">
                {FREQ.map((f) => (
                  <button key={f} type="button" onClick={() => setMeds((ms) => ms.map((x, j) => (j === i ? { ...x, frequency: f } : x)))} className={cn('flex-1 rounded-md border py-1.5 text-xs', med.frequency === f ? 'border-ink bg-ink text-paper' : 'border-border')}>{f}</button>
                ))}
              </div>
            </div>
          ))}
          <Input placeholder="Instructions (after food…)" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          {meds.length > 0 && !applied ? (
            <Button variant="ghost" size="sm" className="w-full" loading={createTemplate.isPending} onClick={saveAsTemplate}>
              <Plus className="size-4" /> Save as template
            </Button>
          ) : null}
          <Button className="w-full" disabled={meds.length === 0} loading={createRx.isPending} onClick={save}>Save prescription</Button>
        </div>
      )}
    </BottomSheet>
  );
}

function NewVisitSheet({ patientId, open, onClose }: { patientId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const createVisit = useCreateVisit(patientId);
  const [procedure, setProcedure] = useState('');
  const [notes, setNotes] = useState('');

  const save = async () => {
    try {
      await createVisit.mutateAsync({ procedure, notes: notes || undefined, toothNumbers: [] });
      toast.success('Visit recorded.');
      onClose();
      setProcedure(''); setNotes('');
    } catch (err) {
      toast.apiError(err);
    }
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="Record a visit">
      <div className="space-y-3">
        <Input placeholder="Procedure (e.g. Scaling)" value={procedure} onChange={(e) => setProcedure(e.target.value)} />
        <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="w-full" disabled={!procedure.trim()} loading={createVisit.isPending} onClick={save}>Save visit</Button>
      </div>
    </BottomSheet>
  );
}

// ===== tiny shared bits ======================================================
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-widest text-text-subtle">{title.toUpperCase()}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-muted">
      <div className="h-full rounded-pill bg-lime" style={{ width: `${percent}%` }} />
    </div>
  );
}
function QuickAction({ label, icon, accent, onClick }: { label: string; icon: React.ReactNode; accent: string; onClick: () => void }) {
  // Mini light-hero tile: elevated + scale-on-tap (kept vertical for the 3-up grid).
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border border-border/60 p-3 text-left shadow-elev-2 transition-transform active:scale-95',
        accent,
      )}
    >
      <span className="text-ink">{icon}</span>
      <span className="text-xs font-medium text-ink">{label}</span>
    </button>
  );
}
