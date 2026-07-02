'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Eye, ImagePlus, Pencil, Phone } from 'lucide-react';
import type { LabCaseStatus } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { useToast } from '@/lib/toast';
import { ApiError } from '@/lib/api-client';
import {
  useLabCase,
  useLabPhotos,
  useLabTransition,
  useLabVendorConsent,
  useLabVendorDetail,
  useUploadLabPhoto,
} from '@/lib/lab-queries';
import { expectedReturnInfo, labCaseTypeLabel, labNextStatuses, labStatusStyle, labTriggerLabel, maskPhone } from '@/lib/lab-ui';
import { rupees } from '@/lib/patient-ui';
import { cn } from '@/lib/utils';

/** Button copy per target status — reception's manual tracker (§2.16 sub-stage 2.A). */
const TO_LABEL: Record<string, string> = {
  SENT: 'Send to lab',
  ACKNOWLEDGED: 'Lab confirmed',
  IN_PROGRESS: 'In progress',
  READY: 'Mark ready',
  DISPATCHED: 'Dispatched',
  RECEIVED: 'Received at clinic',
  FITTED: 'Fitted',
  ISSUE_RAISED: 'Raise issue',
  DELIVERED: 'Deliver',
  COMPLETED: 'Mark complete',
  RETURNED_FOR_REWORK: 'Send for rework',
  CANCELLED: 'Cancel',
};

/** Targets that need a spoken/typed reason before they apply. */
const NEEDS_NOTE = new Set(['ISSUE_RAISED', 'CANCELLED', 'RETURNED_FOR_REWORK']);

function fmt(d: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtDateTime(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{title}</h2>
      {children}
    </section>
  );
}

export default function LabCaseDetailPage() {
  const router = useRouter();
  const { caseId } = useParams<{ caseId: string }>();
  const toast = useToast();
  const { data: c, isLoading } = useLabCase(caseId);
  const photos = useLabPhotos(caseId);
  const transition = useLabTransition(caseId);
  const upload = useUploadLabPhoto(caseId);
  const [revealVendor, setRevealVendor] = useState(false);
  const vendorDetail = useLabVendorDetail(revealVendor && c?.vendorId ? c.vendorId : null);
  const consent = useLabVendorConsent(c?.vendorId ?? '');
  const [reasonFor, setReasonFor] = useState<LabCaseStatus | null>(null);
  const [reason, setReason] = useState('');
  const [consentModal, setConsentModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading || !c) {
    return <AnimatedPage className="flex flex-1 items-center justify-center px-5">Loading…</AnimatedPage>;
  }

  const s = labStatusStyle(c.status);
  const due = expectedReturnInfo(c.expectedReturnAt);
  const nextStatuses = labNextStatuses(c.status);
  const canEdit = c.status === 'DRAFT' || c.status === 'SENT';
  const margin = c.costPaise != null && c.patientChargePaise != null ? c.patientChargePaise - c.costPaise : null;

  async function move(to: LabCaseStatus, note?: string, skipWhatsApp?: boolean) {
    try {
      await transition.mutateAsync({ to, ...(note ? { note } : {}), ...(skipWhatsApp ? { skipWhatsApp } : {}) });
      toast.success(to === 'CANCELLED' ? 'Case cancelled' : `Marked ${TO_LABEL[to]?.toLowerCase() ?? to}`);
      setReasonFor(null);
      setConsentModal(false);
    } catch (err) {
      // §2.11 — the blocking consent modal: confirm consent or mark sent without WhatsApp.
      if (err instanceof ApiError && err.code === 'LAB_SEND_NO_CONSENT') {
        setConsentModal(true);
        return;
      }
      toast.apiError(err);
    }
  }

  function runAction(to: LabCaseStatus) {
    if (NEEDS_NOTE.has(to)) {
      setReason('');
      setReasonFor(to);
      return;
    }
    void move(to);
  }

  async function confirmConsentAndSend() {
    try {
      await consent.mutateAsync('mark_confirmed');
      await move('SENT');
    } catch (err) {
      toast.apiError(err);
    }
  }

  async function onPickFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      for (const file of Array.from(files)) await upload.mutateAsync(file);
      toast.success('Photo added');
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-5 px-5 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-9 items-center justify-center rounded-pill hover:bg-muted">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="font-mono text-sm font-semibold">
          {c.caseCode ?? c.caseNumber}
          {c.caseCode ? <span className="ml-2 text-xs font-normal text-text-subtle">{c.caseNumber}</span> : null}
        </h1>
        {canEdit ? (
          <button type="button" aria-label="Edit case" onClick={() => router.push(`/lab/${caseId}/edit`)} className="ml-auto flex size-9 items-center justify-center rounded-pill hover:bg-muted">
            <Pencil className="size-4" />
          </button>
        ) : null}
      </div>

      {/* STATUS CARD — manual tracker buttons (works with zero WhatsApp parsing, §2.15) */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-elev-1">
        <div className="flex items-center gap-2">
          <span className={cn('size-2.5 rounded-pill', s.bar)} />
          <span className={cn('text-sm font-semibold', s.strikethrough && 'line-through')}>{s.label}</span>
        </div>
        <p className="text-xs text-text-subtle">
          {c.sentAt ? `Sent ${fmt(c.sentAt)}` : 'Not yet sent'}
          {c.expectedReturnAt ? ` · Expected ${fmt(c.expectedReturnAt)}` : ''}
          {due ? ` · ${due.label}` : ''}
        </p>
        {nextStatuses.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((to) => (
              <Button
                key={to}
                size="sm"
                variant={to === 'CANCELLED' ? 'destructive' : to === 'ISSUE_RAISED' || to === 'RETURNED_FOR_REWORK' ? 'outline' : 'primary'}
                disabled={transition.isPending}
                onClick={() => runAction(to)}
              >
                {TO_LABEL[to] ?? to}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-subtle">No actions — this case is closed.</p>
        )}
      </div>

      <Section title="Patient">
        <button
          type="button"
          onClick={() => router.push(`/patients/${c.patientId}`)}
          className="text-left text-sm font-medium underline-offset-2 hover:underline"
        >
          {c.patientName}
        </button>
      </Section>

      <Section title="Case details">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-text-subtle">Type</dt>
          <dd>{labCaseTypeLabel(c.type)}</dd>
          <dt className="text-text-subtle">Material</dt>
          <dd>{c.material ?? '—'}</dd>
          <dt className="text-text-subtle">Shade</dt>
          <dd>{c.shade ?? '—'}</dd>
          <dt className="text-text-subtle">Teeth</dt>
          <dd>{c.teeth.length ? c.teeth.join(', ') : '—'}</dd>
        </dl>
        {c.description ? <p className="text-sm text-muted-foreground">{c.description}</p> : null}
      </Section>

      <Section title="Vendor">
        <p className="text-sm font-medium">{c.vendorName ?? '—'}</p>
        <button
          type="button"
          onClick={() => setRevealVendor(true)}
          className="flex items-center gap-1.5 text-xs text-text-subtle"
        >
          <Phone className="size-3.5" />
          {revealVendor && vendorDetail.data?.contactPhone
            ? vendorDetail.data.contactPhone
            : revealVendor
              ? 'Revealing…'
              : 'Tap to reveal contact'}
          {!revealVendor ? <Eye className="size-3.5" /> : null}
        </button>
        {!revealVendor ? <span className="text-xs text-text-subtle">{maskPhone('0000000000')}</span> : null}
      </Section>

      <Section title="Timeline">
        {c.events.length === 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            <li>{fmt(c.impressionTakenAt)} · Impression taken</li>
            <li>{fmt(c.sentAt)} · Sent to vendor</li>
          </ul>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {c.events.map((e) => {
              const style = labStatusStyle(e.toStatus as LabCaseStatus);
              return (
                <li key={e.id} className={cn('flex gap-3 text-sm', e.undoneAt && 'opacity-45 line-through')}>
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-pill', style.bar)} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {fmtDateTime(e.createdAt)} · {style.label}
                    </p>
                    <p className="text-xs text-text-muted">
                      {labTriggerLabel(e.trigger)}
                      {e.note ? ` · “${e.note}”` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {c.costPaise != null || c.patientChargePaise != null ? (
        <Section title="Cost">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-text-subtle">Lab cost</dt>
            <dd>{c.costPaise != null ? rupees(c.costPaise) : '—'}</dd>
            <dt className="text-text-subtle">Patient charge</dt>
            <dd>{c.patientChargePaise != null ? rupees(c.patientChargePaise) : '—'}</dd>
            {margin != null ? (
              <>
                <dt className="text-text-subtle">Margin</dt>
                <dd className="font-medium text-sage-deep">{rupees(margin)}</dd>
              </>
            ) : null}
          </dl>
        </Section>
      ) : null}

      <Section title={`Photos · ${photos.data?.items.length ?? 0}`}>
        <div className="flex flex-wrap gap-2">
          {photos.data?.items.map((p) =>
            p.url ? (
              <img key={p.id} src={p.url} alt="Lab" className="size-20 rounded-lg border border-border object-cover" />
            ) : null,
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-text-subtle"
          >
            <ImagePlus className="size-5" />
            <span className="text-[10px]">Add</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files)} />
        </div>
      </Section>

      {c.notes ? (
        <Section title="Notes">
          <p className="text-sm text-muted-foreground">{c.notes}</p>
        </Section>
      ) : null}

      {photos.data && photos.data.items.length === 0 ? null : null}

      <BottomSheet
        open={reasonFor !== null}
        onClose={() => setReasonFor(null)}
        title={reasonFor === 'CANCELLED' ? 'Cancel case' : reasonFor === 'ISSUE_RAISED' ? 'Raise issue' : 'Send for rework'}
      >
        <div className="flex flex-col gap-3 p-5">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            rows={3}
            className="w-full rounded-lg border border-border bg-paper-warm px-3 py-2 text-sm outline-none focus:border-border-strong"
          />
          <Button disabled={reason.trim().length === 0 || transition.isPending} onClick={() => reasonFor && void move(reasonFor, reason.trim())}>
            Confirm
          </Button>
        </div>
      </BottomSheet>

      {/* §2.11 blocking consent modal — shown when Send hits LAB_SEND_NO_CONSENT. */}
      <BottomSheet open={consentModal} onClose={() => setConsentModal(false)} title="Lab hasn’t opted in">
        <div className="flex flex-col gap-3 p-5">
          <p className="text-sm text-text-muted">
            {c.vendorName ?? 'This lab'} hasn’t confirmed receiving cases on WhatsApp. Have you spoken to them about it?
          </p>
          <Button onClick={confirmConsentAndSend} loading={consent.isPending || transition.isPending}>
            Yes — confirm consent &amp; send
          </Button>
          <Button variant="outline" onClick={() => void move('SENT', undefined, true)} disabled={transition.isPending}>
            Mark sent without WhatsApp
          </Button>
        </div>
      </BottomSheet>

      {c.status === 'CANCELLED' && c.rejectionReason ? (
        <EmptyState variant="inline" title="Cancelled" body={c.rejectionReason} />
      ) : null}
    </AnimatedPage>
  );
}
