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

  const { valid, errors } = validateNewCase({ patientId, vendorId, type, teeth });

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

      <Field label="Vendor">
        <select className={inputCls} value={vendorId ?? ''} onChange={(e) => setVendorId(e.target.value || undefined)}>
          <option value="">Select a vendor</option>
          {vendors.data?.items.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button type="button" className="self-start text-xs text-info" onClick={() => router.push('/lab/vendors')}>
          + New vendor
        </button>
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
