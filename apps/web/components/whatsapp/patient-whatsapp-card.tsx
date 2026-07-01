'use client';

import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { usePatientConsent, usePatientMessages, useSetConsent } from '@/lib/whatsapp-queries';
import { messageStatusLabel } from '@/lib/whatsapp-ui';
import { useToast } from '@/lib/toast';
import { ComposeSheet } from '@/app/(app)/messages/compose-sheet';
import { cn } from '@/lib/utils';

const CONSENT_TONE: Record<string, string> = {
  OPTED_IN: 'bg-sage-tint text-sage-deep',
  OPTED_OUT: 'bg-peach-soft text-peach-deep',
  NOT_ASKED: 'bg-paper-warm text-text-subtle',
  PENDING: 'bg-paper-warm text-text-subtle',
  EXPIRED: 'bg-peach-soft text-peach-deep',
};

/** Patient-detail WhatsApp card: consent state + opt-in/out, recent activity, and a compose button. */
export function PatientWhatsAppCard({ patientId, patientName }: { patientId: string; patientName: string }) {
  const consent = usePatientConsent(patientId);
  const messages = usePatientMessages(patientId);
  const setConsent = useSetConsent(patientId);
  const toast = useToast();
  const [compose, setCompose] = useState(false);

  const status = consent.data?.status ?? 'NOT_ASKED';
  const canSend = consent.data?.canSend ?? false;
  const recent = messages.data ?? [];

  async function optIn() {
    await setConsent.mutateAsync({ action: 'opt-in', body: { method: 'verbal' } });
    toast.success('Opted in to WhatsApp updates');
  }
  async function optOut() {
    await setConsent.mutateAsync({ action: 'opt-out', body: {} });
    toast.info('Opted out of WhatsApp updates');
  }

  return (
    <section className="space-y-3 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-sage-deep" />
          <h3 className="text-sm font-semibold">WhatsApp</h3>
        </div>
        <span className={cn('rounded-pill px-2 py-0.5 text-xs font-medium', CONSENT_TONE[status])}>
          {status.replace('_', ' ').toLowerCase()}
        </span>
      </div>

      {status !== 'OPTED_IN' ? (
        <button
          type="button"
          onClick={optIn}
          disabled={setConsent.isPending}
          className="w-full rounded-pill bg-lime py-2.5 text-sm font-semibold text-ink"
        >
          Opt in to WhatsApp updates
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCompose(true)}
            disabled={!canSend}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-pill bg-ink py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
          >
            <Send className="size-4" /> Send template
          </button>
          <button type="button" onClick={optOut} className="rounded-pill bg-surface px-4 py-2.5 text-sm font-medium text-text-subtle">
            Opt out
          </button>
        </div>
      )}

      {recent.length > 0 ? (
        <div className="space-y-1.5">
          {recent.slice(0, 3).map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-text-subtle">
                {m.direction === 'INBOUND' ? '← ' : '→ '}
                {m.body || '(no text)'}
              </span>
              <span className="shrink-0 text-[11px] text-text-subtle">{messageStatusLabel(m.status)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {compose ? <ComposeSheet onClose={() => setCompose(false)} presetPatient={{ id: patientId, name: patientName }} /> : null}
    </section>
  );
}
