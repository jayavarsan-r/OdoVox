'use client';

import { useState } from 'react';
import { Pill, Plus, FileText, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { VoiceInput } from '@/components/voice/voice-input';
import { useToast } from '@/lib/toast';
import { useCreatePrescription, fetchPrescriptionPdfUrl, useTemplates, useApplyTemplate, useCreateTemplate } from '@/lib/queries';
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

