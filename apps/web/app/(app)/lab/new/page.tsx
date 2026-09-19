'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { VoiceInput } from '@/components/voice/voice-input';
import { useToast } from '@/lib/toast';
import { usePatients } from '@/lib/queries';
import { api } from '@/lib/api-client';
import { useCreateLabCase, useLabVendors } from '@/lib/lab-queries';
import { labCaseTypeLabel, validateNewCase } from '@/lib/lab-ui';
import type { CreateLabCaseInput, LabCaseType, LabNewCaseExtraction } from '@odovox/types';
import { cn } from '@/lib/utils';

/** /lab/dictate/new-case response (Phase 9.7 W1.2.4). */
interface LabDictateResponse {
  extraction: LabNewCaseExtraction;
  patientMatches: Array<{ id: string; name: string; phone: string; age: number }>;
  vendorMatch: { id: string; name: string } | null;
  transcript: string;
}

const TYPES: LabCaseType[] = [
  'CROWN',
  'BRIDGE',
  'DENTURE_FULL',
  'DENTURE_PARTIAL',
  'ALIGNER',
  'NIGHT_GUARD',
  'VENEER',
  'INLAY_ONLAY',
  'OTHER',
];

const MATERIALS = ['PFM', 'Zirconia', 'Lithium Disilicate', 'Acrylic', 'Metal'];
const SHADES = ['A1', 'A2', 'A3', 'A3.5', 'B1', 'B2'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-subtle">{label}</span>
      {children}
    </label>
  );
}

/**
 * The two due presets the frame offers beside the date picker. Computed at render, not at
 * module load, so a tab left open overnight does not offer yesterday.
 */
const DUE_PRESETS: { label: string; iso: () => string }[] = [
  {
    label: 'This Friday',
    iso: () => {
      const d = new Date();
      // 5 = Friday. Always the NEXT one, so on a Friday it means a week today rather than
      // a deadline that has already passed.
      d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
      return d.toISOString().slice(0, 10);
    },
  },
  {
    label: '+1 week',
    iso: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    },
  },
];

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-border-strong';

export default function NewLabCasePage() {
  const router = useRouter();
  const toast = useToast();
  const [patientSearch, setPatientSearch] = useState('');
  const patients = usePatients(patientSearch, 'all');
  const vendors = useLabVendors();
  const create = useCreateLabCase();

  const [patientId, setPatientId] = useState<string | undefined>();
  const [patientLabel, setPatientLabel] = useState('');
  const [vendorId, setVendorId] = useState<string | undefined>();
  const [type, setType] = useState<LabCaseType | undefined>();
  const [teethRaw, setTeethRaw] = useState('');
  const [material, setMaterial] = useState('');
  const [shade, setShade] = useState('');
  const [description, setDescription] = useState('');
  const [costRupees, setCostRupees] = useState('');
  const [chargeRupees, setChargeRupees] = useState('');

  const teeth = useMemo(
    () =>
      teethRaw
        .split(/[,\s]+/)
        .map((t) => parseInt(t, 10))
        .filter((n) => Number.isInteger(n) && n >= 11 && n <= 48),
    [teethRaw],
  );

  const { valid, errors: allErrors } = validateNewCase({ patientId, vendorId, type, teeth });

  /**
   * Required-field errors appear only after someone has TRIED to save.
   *
   * The form rendered all four the moment it opened — "Select a patient", "Select a vendor",
   * "Pick a case type", "Select at least one tooth" — in red, on an untouched screen. That
   * tells a receptionist they have done something wrong before they have done anything, and
   * it trains them to ignore red, which is the colour this app uses for allergy conflicts.
   *
   * The Save buttons stay enabled either way: pressing one is how you find out what is
   * missing, and a disabled button that will not say why is worse than an error that waits
   * its turn.
   */
  const [tried, setTried] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const errors = tried ? allErrors : ({} as typeof allErrors);

  const patientList = patients.data?.pages.flatMap((p) => p.items) ?? [];

  // Voice new case (W1.2.4) — extraction fills the form; unmatched entities stay as pickers.
  function applyDictation(data: LabDictateResponse) {
    const x = data.extraction;
    if (data.patientMatches.length === 1) {
      setPatientId(data.patientMatches[0]!.id);
      setPatientLabel(data.patientMatches[0]!.name);
    } else if (x.patientName) {
      setPatientSearch(x.patientName);
    }
    if (data.vendorMatch) setVendorId(data.vendorMatch.id);
    if (x.type) setType(x.type);
    if (x.teeth.length) setTeethRaw(x.teeth.join(', '));
    if (x.material) setMaterial(x.material.replace(/\b\w/g, (c) => c.toUpperCase()));
    if (x.shade) setShade(x.shade);
    if (x.description) setDescription(x.description);
    if (x.costPaise != null) setCostRupees(String(x.costPaise / 100));
    if (x.patientChargePaise != null) setChargeRupees(String(x.patientChargePaise / 100));
    if (x.clarifications.length) toast.info(x.clarifications.join(' '));
    else toast.info('Filled from your voice — review and save.');
  }

  // Create the DRAFT, then optionally send it (the send needs the created id, so it runs inline).
  async function save(send: boolean) {
    if (!valid || !patientId || !vendorId || !type) {
      // Now they have tried, so now the fields may say what is missing.
      setTried(true);
      toast.error('Fill the required fields');
      return;
    }
    const input: CreateLabCaseInput = {
      patientId,
      vendorId,
      type,
      teeth,
      material: material || undefined,
      shade: shade || undefined,
      description: description || undefined,
      expectedReturnAt: dueDate ? new Date(dueDate) : undefined,
      costPaise: costRupees ? Math.round(Number(costRupees) * 100) : undefined,
      patientChargePaise: chargeRupees ? Math.round(Number(chargeRupees) * 100) : undefined,
    };
    try {
      const created = await create.mutateAsync(input);
      if (send) await api.post(`/lab/cases/${created.id}/send`, {});
      toast.success(send ? 'Case sent to vendor' : 'Draft saved');
      router.replace(`/lab/${created.id}`);
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-5 px-5 pt-4 pb-32">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-9 items-center justify-center rounded-pill hover:bg-muted">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold">New lab case</h1>
      </div>

      {/* Speak the whole brief — the form below is the verification card. */}
      <VoiceInput<LabDictateResponse>
        mode="extraction"
        endpoint="/lab/dictate/new-case"
        placement="sheet"
        label="Speak the case"
        hint="“Zirconia crown for Ramesh, tooth 26, shade A2, Saveetha lab, one week”"
        onExtraction={applyDictation}
      />

      <Field label="Patient">
        {patientId ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <span>{patientLabel}</span>
            <button type="button" className="text-xs text-text-subtle" onClick={() => setPatientId(undefined)}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input className={inputCls} placeholder="Search patient" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
            {patientSearch && patientList.length > 0 ? (
              <div className="mt-1 flex max-h-40 flex-col overflow-auto rounded-lg border border-border bg-surface">
                {patientList.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setPatientId(p.id);
                      setPatientLabel(`${p.name} · ${p.age}`);
                    }}
                  >
                    {p.name} · {p.age}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
        {errors.patientId ? <span className="text-xs text-danger">{errors.patientId}</span> : null}
      </Field>

      {/*
        Frame 59: vendor as CHIPS, recent first — not a native <select>.

        A clinic sends to two or three labs. A dropdown makes picking one a two-tap
        interaction with a system UI in between, and hides the fact that there are only two
        choices. Chips show the whole decision at once.

        The first four are shown; a clinic with more gets the rest behind "All", which is the
        dropdown doing the job a dropdown is actually good at.
      */}
      <Field label="Vendor · recent first">
        <span className="flex flex-wrap gap-2">
          {(vendors.data?.items ?? []).slice(0, 4).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVendorId(vendorId === v.id ? undefined : v.id)}
              className={cn(
                'rounded-pill px-[13px] py-2 text-xs font-heavy transition-colors',
                vendorId === v.id
                  ? 'bg-pine text-white'
                  : 'bg-[rgba(31,42,35,0.05)] text-pine',
              )}
            >
              {v.name}
            </button>
          ))}
          {(vendors.data?.items.length ?? 0) > 4 ? (
            <select
              aria-label="All vendors"
              className="rounded-pill bg-[rgba(31,42,35,0.05)] px-3 py-2 text-xs font-heavy text-pine"
              value={vendorId ?? ''}
              onChange={(e) => setVendorId(e.target.value || undefined)}
            >
              <option value="">All ▾</option>
              {vendors.data?.items.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className="rounded-pill border border-dashed border-hair-2 px-[13px] py-2 text-xs font-heavy text-pine-3"
            onClick={() => router.push('/lab/vendors')}
          >
            + New
          </button>
        </span>
        {errors.vendorId ? <span className="text-xs text-danger">{errors.vendorId}</span> : null}
      </Field>

      <Field label="Type">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'rounded-pill px-3 py-1.5 text-xs font-medium',
                type === t ? 'bg-ink text-paper' : 'bg-paper-warm text-text-subtle',
              )}
            >
              {labCaseTypeLabel(t)}
            </button>
          ))}
        </div>
        {errors.type ? <span className="text-xs text-danger">{errors.type}</span> : null}
      </Field>

      <Field label="Teeth (FDI, comma-separated)">
        <input className={inputCls} placeholder="e.g. 26, 27" value={teethRaw} onChange={(e) => setTeethRaw(e.target.value)} />
        {errors.teeth ? <span className="text-xs text-danger">{errors.teeth}</span> : null}
      </Field>

      {/*
        Frame 59's DUE row. The API has always accepted `expectedReturnAt`; this form never
        offered it, so every case silently inherited the vendor's default turnaround and a
        rush job had no way to say so.

        Left blank it still inherits the default, which is the right thing to happen when
        nobody has an opinion — the chips are for when somebody does.
      */}
      <Field label="Due">
        <span className="flex flex-wrap items-center gap-2">
          {DUE_PRESETS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setDueDate(dueDate === d.iso() ? '' : d.iso())}
              className={cn(
                'rounded-pill px-[13px] py-2 text-xs font-heavy transition-colors',
                dueDate === d.iso()
                  ? 'bg-pine text-white'
                  : 'bg-[rgba(31,42,35,0.05)] text-pine',
              )}
            >
              {d.label}
            </button>
          ))}
          <input
            type="date"
            aria-label="Pick a due date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-pill bg-[rgba(31,42,35,0.05)] px-3 py-2 text-xs font-heavy text-pine"
          />
        </span>
      </Field>

      <Field label="Material">
        <input className={inputCls} list="materials" value={material} onChange={(e) => setMaterial(e.target.value)} />
        <datalist id="materials">
          {MATERIALS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>

      <Field label="Shade">
        <input className={inputCls} list="shades" value={shade} onChange={(e) => setShade(e.target.value)} />
        <datalist id="shades">
          {SHADES.map((sh) => (
            <option key={sh} value={sh} />
          ))}
        </datalist>
      </Field>

      <Field label="Description">
        <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Lab cost (₹)">
          <input className={inputCls} inputMode="numeric" value={costRupees} onChange={(e) => setCostRupees(e.target.value)} />
        </Field>
        <Field label="Patient charge (₹)">
          <input className={inputCls} inputMode="numeric" value={chargeRupees} onChange={(e) => setChargeRupees(e.target.value)} />
        </Field>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-mobile gap-3 border-t border-border bg-paper px-5 py-3" style={{ paddingBottom: 'calc(12px + var(--safe-bottom))' }}>
        <Button variant="ghost" className="flex-1" disabled={create.isPending} onClick={() => save(false)}>
          Save as draft
        </Button>
        <Button className="flex-1" disabled={create.isPending} onClick={() => save(true)}>
          Save &amp; send
        </Button>
      </div>
    </AnimatedPage>
  );
}
