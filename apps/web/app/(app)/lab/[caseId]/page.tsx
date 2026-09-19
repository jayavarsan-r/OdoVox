'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Eye, ImagePlus, Pencil, Phone } from 'lucide-react';
import type { LabCaseStatus } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useUndoLabEvent } from '@/lib/lab-inbox-queries';
import { expectedReturnInfo, labCaseTypeLabel, labStatusStyle, labTriggerLabel, maskPhone } from '@/lib/lab-ui';
import { canRaiseIssue, labJourney, labNextAction } from '@/lib/lab/case-journey';
import { Mini } from '@/components/ui/badge';
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
  const undoEvent = useUndoLabEvent();
  const upload = useUploadLabPhoto(caseId);
  const [revealVendor, setRevealVendor] = useState(false);
  const vendorDetail = useLabVendorDetail(revealVendor && c?.vendorId ? c.vendorId : null);
  const consent = useLabVendorConsent(c?.vendorId ?? '');
  const [reasonFor, setReasonFor] = useState<LabCaseStatus | null>(null);
  const [reason, setReason] = useState('');
  const [consentModal, setConsentModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading || !c) {
    return (
      <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </AnimatedPage>
    );
  }
  const due = expectedReturnInfo(c.expectedReturnAt);
  const next = labNextAction(c.status);
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
        <h1 className="flex-1 text-center font-mono text-sm font-semibold">
          {c.caseCode ?? c.caseNumber}
        </h1>
        {canEdit ? (
          <button type="button" aria-label="Edit case" onClick={() => router.push(`/lab/${caseId}/edit`)} className="ml-auto flex size-9 items-center justify-center rounded-pill hover:bg-muted">
            <Pencil className="size-4" />
          </button>
        ) : null}
      </div>

      {/*
        Frame 58's head: what the case IS, then who it involves, then where it has got to.

        The screen opened on a case NUMBER and a status card holding five equal-sized
        buttons — Lab confirmed, In progress, Mark ready, Raise issue and a red Cancel, all
        offered at once. That asks the doctor to know the lifecycle instead of telling them
        where the case is, and puts Cancel the same size as the thing they came to do.
      */}
      <div>
        <h2 className="text-[22px] font-black leading-tight tracking-tight text-pine">
          {[c.material, labCaseTypeLabel(c.type).toLowerCase()].filter(Boolean).join(' ')}
          {c.teeth.length ? ` · ${c.teeth.join(', ')}` : ''}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => router.push(`/patients/${c.patientId}`)}>
            <Mini tone="neutral">{c.patientName}</Mini>
          </button>
          {c.vendorName ? <Mini tone="neutral">{c.vendorName}</Mini> : null}
          {due && due.tone !== 'normal' ? (
            <Mini tone={due.tone === 'overdue' ? 'crit' : 'warn'}>{due.label}</Mini>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-elev-1">
        {/* The journey, and where this case sits on it. Statuses that are DEPARTURES from
            the line — an issue, a rework — hold their place at Prod rather than walking
            the stepper backwards; the issue itself is stated below in crit. */}
        <ol className="flex items-start justify-between">
          {labJourney(c.status).map((step, i, all) => (
            <li key={step.label} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="flex w-full items-center">
                <span className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : step.state === 'ahead' ? 'bg-hair-2' : 'bg-live')} />
                <span
                  className={cn(
                    'flex size-[26px] shrink-0 items-center justify-center rounded-pill text-3xs font-heavy',
                    step.state === 'done' && 'bg-live text-white',
                    step.state === 'now' && 'bg-lime text-pine',
                    step.state === 'ahead' && 'border border-hair-2 text-pine-3',
                  )}
                >
                  {step.state === 'done' ? '✓' : i + 1}
                </span>
                <span className={cn('h-0.5 flex-1', i === all.length - 1 ? 'opacity-0' : step.state === 'done' ? 'bg-live' : 'bg-hair-2')} />
              </span>
              <span className={cn('text-3xs font-heavy', step.state === 'ahead' ? 'text-pine-3' : 'text-pine')}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>

        {c.status === 'ISSUE_RAISED' ? (
          <p className="text-xs font-heavy text-crit">An issue is open with the lab.</p>
        ) : null}

        {/* ONE step forward. A case in production has exactly one useful next move, and
            offering "Lab confirmed" beside it invites walking the case backwards. */}
        {next ? (
          <Button block disabled={transition.isPending} onClick={() => runAction(next.to)}>
            {next.label}
          </Button>
        ) : (
          <p className="text-center text-xs font-semibold text-pine-3">
            This case is closed.
          </p>
        )}

        {/* The escapes: quieter, and text rather than buttons, so neither competes with
            the step above. Cancel is no longer a red button beside the primary action —
            it lives in Edit, which is where destroying a case belongs. */}
        <div className="flex items-center justify-center gap-5">
          {c.vendorId ? (
            <button
              type="button"
              onClick={() => router.push('/messages/lab')}
              className="text-xs font-heavy text-pine-3 hover:text-pine"
            >
              Message lab
            </button>
          ) : null}
          {canRaiseIssue(c.status) ? (
            <button
              type="button"
              onClick={() => runAction('ISSUE_RAISED')}
              className="text-xs font-heavy text-crit"
            >
              Raise issue
            </button>
          ) : null}
        </div>
      </div>

      {/* MATERIAL · SHADE and MARGIN, as the frame pairs them. Rendered only where there is
          something to say — the old CASE DETAILS list printed a row of "—" for every field
          an ordinary case simply does not carry. */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-white p-4 shadow-elev-1">
          <p className="text-2xs font-heavy tracking-[0.06em] text-pine-3">MATERIAL · SHADE</p>
          <p className="mt-1 truncate text-[15px] font-heavy text-pine">
            {[c.material, c.shade].filter(Boolean).join(' · ') || labCaseTypeLabel(c.type)}
          </p>
        </div>
        {margin !== null ? (
          <div className="rounded-2xl bg-live-soft p-4">
            <p className="text-2xs font-heavy tracking-[0.06em] text-live">MARGIN</p>
            <p className="mt-1 text-[15px] font-black text-live">
              {margin >= 0 ? '+' : ''}
              {rupees(margin)}
            </p>
            <p className="mt-0.5 text-3xs font-heavy text-live/70">
              {rupees(c.costPaise!)} → {rupees(c.patientChargePaise!)}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-4 shadow-elev-1">
            <p className="text-2xs font-heavy tracking-[0.06em] text-pine-3">DUE</p>
            <p className="mt-1 truncate text-[15px] font-heavy text-pine">
              {c.expectedReturnAt ? fmt(c.expectedReturnAt) : 'Not set'}
            </p>
          </div>
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

      {/* Type, material, shade and teeth are the TITLE and the tile above; repeating them
          as four rows here said nothing twice, and two of the four were "—". What is left
          is the clinical brief, which has nowhere else to live. */}
      <Section title="Case details">
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
              const undoable =
                e.trigger === 'llm_parse' && !e.undoneAt && Date.now() - new Date(e.createdAt).getTime() < 24 * 60 * 60 * 1000;
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
                  {undoable ? (
                    <button
                      type="button"
                      onClick={() => void undoEvent.mutateAsync(e.id).then(() => toast.success('Undone')).catch(toast.apiError)}
                      className="shrink-0 self-start text-xs font-medium text-danger underline-offset-2 hover:underline"
                    >
                      Undo
                    </button>
                  ) : null}
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
