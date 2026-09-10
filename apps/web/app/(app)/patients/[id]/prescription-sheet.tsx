'use client';

import { useState } from 'react';
import { Pill, Plus, FileText, Star, X, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/badge';
import { DoseDots } from '@/components/ds';
import { warningLabel, warningsFor } from '@/lib/patients/rx-conflicts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { VoiceInput } from '@/components/voice/voice-input';
import { useToast } from '@/lib/toast';
import { useCreatePrescription, fetchPrescriptionPdfUrl, useTemplates, useApplyTemplate, useCreateTemplate, usePatient } from '@/lib/queries';
import { cn } from '@/lib/utils';

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


export function PrescriptionSheet({ patientId, open, onClose }: { patientId: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const createRx = useCreatePrescription(patientId);
  const [meds, setMeds] = useState<Med[]>([]);
  const [instructions, setInstructions] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  // The safety layer's own warnings, kept so each medcard can show the flag on the drug it
  // concerns rather than only in a toast that scrolls away.
  const [safetyWarnings, setSafetyWarnings] = useState<string[]>([]);
  const patient = usePatient(patientId);

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
    setSafetyWarnings(safetyWarnings);
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
              <button key={m} type="button" onClick={() => addMed(m)}>
                <Chip tone="neutral">{m}</Chip>
              </button>
            ))}
          </div>

          {/* Frame 44's `.medcard`: white, 22px radius, a lav Rx circle, the name at 16/800,
              dose dots and duration on one line. Editing stays inline — a prescription is
              corrected while it is being written, not in a second screen. */}
          {meds.map((med, i) => {
            const warns = warningsFor(med.name, safetyWarnings);
            return (
              <div
                key={i}
                className={cn(
                  'rounded-[22px] bg-white p-[14px_15px] shadow-elev-1',
                  // Frame 45 outlines the offending card. The flag is on the drug, not in a
                  // banner away from it — the same treatment as the verification card.
                  warns.length > 0 && 'outline outline-2 outline-offset-[-1px] outline-crit',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lavender-soft">
                    <Pill className="size-4 text-pine" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[16px] font-heavy', warns.length ? 'text-crit' : 'text-pine')}>
                      {med.name}
                    </p>
                    <span className="mt-1 flex items-center gap-2">
                      <DoseDots frequency={med.frequency} />
                      <span className="text-[11.5px] font-semibold text-pine-3">
                        {med.dosage} · {med.durationDays} days
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMeds((ms) => ms.filter((_, j) => j !== i))}
                    aria-label={`Remove ${med.name}`}
                    className="shrink-0 text-pine-3"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* The conflict the SERVER flagged, on the row it concerns. Nothing here
                    decides what conflicts: matching drug names against allergies would mean
                    asserting amoxicillin is a penicillin, which needs clinical knowledge
                    this app does not have (#51) and rule 7 forbids inventing. */}
                {warns.map((w) => (
                  <div
                    key={w}
                    className="mt-2.5 flex items-center gap-2 rounded-[14px] border-[1.5px] border-crit bg-white px-3 py-2"
                  >
                    <TriangleAlert className="size-3.5 shrink-0 text-crit" />
                    <span className="min-w-0 flex-1 text-[12px] font-bold leading-tight text-crit">
                      {warningLabel(w, patient.data?.allergies ?? null)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMeds((ms) => ms.filter((_, j) => j !== i))}
                      className="shrink-0 text-[12px] font-heavy text-pine-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <div className="mt-2.5 flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Dosage"
                    value={med.dosage}
                    onChange={(e) => setMeds((ms) => ms.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))}
                  />
                  <Input
                    className="w-20"
                    type="number"
                    min={1}
                    value={med.durationDays}
                    onChange={(e) => setMeds((ms) => ms.map((x, j) => (j === i ? { ...x, durationDays: Number(e.target.value) } : x)))}
                  />
                </div>
                <div className="mt-2 flex gap-1.5">
                  {FREQ.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setMeds((ms) => ms.map((x, j) => (j === i ? { ...x, frequency: f } : x)))}
                      className={cn(
                        'flex-1 rounded-pill py-1.5 text-[12px] font-heavy',
                        med.frequency === f ? 'bg-pine text-white' : 'bg-paper text-pine-2',
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* The dose legend renders ONCE, above the CTA — repeating it on every card turns
              a reference into noise the eye stops reading. */}
          {meds.length > 0 ? (
            <p className="flex items-center gap-2 pt-1 text-[10px] font-heavy uppercase tracking-eyebrow text-pine-3">
              <DoseDots frequency="TID" /> DOSE · morning — afternoon — night
            </p>
          ) : null}

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

