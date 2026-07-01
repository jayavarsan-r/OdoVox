'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { GlassCard } from '@/components/ds';
import { usePatients } from '@/lib/queries';
import { useSendTemplate, useWhatsAppTemplates } from '@/lib/whatsapp-queries';
import { allSlotsFilled, renderTemplatePreview, templateSlots } from '@/lib/whatsapp-ui';
import { useToast } from '@/lib/toast';
import type { WhatsAppTemplateResponse } from '@odovox/types';
import { cn } from '@/lib/utils';

/** Compose a template message. `presetPatient` pre-fills the patient (from patient detail). */
export function ComposeSheet({
  onClose,
  presetPatient,
}: {
  onClose: () => void;
  presetPatient?: { id: string; name: string };
}) {
  const [search, setSearch] = useState('');
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(presetPatient ?? null);
  const [template, setTemplate] = useState<WhatsAppTemplateResponse | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const patients = usePatients(search, 'all');
  const templates = useWhatsAppTemplates();
  const send = useSendTemplate();
  const toast = useToast();

  const patientList = patients.data?.pages.flatMap((p) => p.items) ?? [];
  const slots = useMemo(() => (template ? templateSlots(template.body) : []), [template]);
  const preview = template ? renderTemplatePreview(template.body, variables) : '';
  const canSend = !!patient && !!template && allSlotsFilled(template.body, variables) && !send.isPending;

  function pickTemplate(t: WhatsAppTemplateResponse) {
    setTemplate(t);
    const seed: Record<string, string> = {};
    if (patient) seed['1'] = patient.name; // slot 1 is conventionally the patient name
    setVariables(seed);
  }

  async function submit() {
    if (!patient || !template) return;
    try {
      const outcome = await send.mutateAsync({ patientId: patient.id, templateKey: template.templateKey, variables });
      if (outcome.blocked) {
        toast.error(`Not sent — ${outcome.reason ?? 'blocked'}`);
      } else {
        toast.success('Message queued');
        onClose();
      }
    } catch {
      toast.error('Could not send message');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <GlassCard
        className="max-h-[85vh] w-full max-w-mobile overflow-y-auto rounded-t-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New message</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-text-subtle">
            <X className="size-5" />
          </button>
        </div>

        {/* Patient picker */}
        {!patient ? (
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-text-subtle">Patient</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients"
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-border-strong"
            />
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {patientList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPatient({ id: p.id, name: p.name })}
                  className="rounded-lg bg-paper-warm px-3 py-2 text-left text-sm font-medium"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-paper-warm px-3 py-2">
            <span className="text-sm font-semibold">{patient.name}</span>
            {!presetPatient ? (
              <button type="button" onClick={() => setPatient(null)} className="text-xs font-medium text-text-subtle">
                Change
              </button>
            ) : null}
          </div>
        )}

        {/* Template picker */}
        {patient ? (
          <div className="mt-4 space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-text-subtle">Template</label>
            <div className="flex flex-wrap gap-2">
              {(templates.data ?? []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTemplate(t)}
                  className={cn(
                    'rounded-pill px-3 py-1.5 text-xs font-medium',
                    template?.id === t.id ? 'bg-ink text-paper' : 'bg-paper-warm text-text-subtle',
                  )}
                >
                  {t.templateKey}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Variables */}
        {template ? (
          <div className="mt-4 space-y-2">
            {slots.map((slot) => (
              <div key={slot} className="space-y-1">
                <label className="text-xs font-medium text-text-subtle">Variable {'{{'}{slot}{'}}'}</label>
                <input
                  value={variables[slot] ?? ''}
                  onChange={(e) => setVariables((v) => ({ ...v, [slot]: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-border-strong"
                />
              </div>
            ))}
            <div className="rounded-lg bg-sage-soft p-3 text-sm text-ink" data-testid="template-preview">
              {preview}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canSend}
          onClick={submit}
          className={cn(
            'mt-5 w-full rounded-pill py-3 text-sm font-semibold',
            canSend ? 'bg-lime text-ink' : 'bg-border text-text-subtle',
          )}
        >
          {send.isPending ? 'Sending…' : 'Send'}
        </button>
      </GlassCard>
    </div>
  );
}
