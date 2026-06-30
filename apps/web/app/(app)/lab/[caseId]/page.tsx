'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Eye, ImagePlus, Phone } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { useToast } from '@/lib/toast';
import {
  useLabCase,
  useLabCaseAction,
  useLabPhotos,
  useLabVendorDetail,
  useUploadLabPhoto,
} from '@/lib/lab-queries';
import { expectedReturnInfo, labCaseActions, labCaseTypeLabel, labStatusStyle, maskPhone } from '@/lib/lab-ui';
import { rupees } from '@/lib/patient-ui';
import { cn } from '@/lib/utils';

const ACTION_LABEL: Record<string, string> = {
  edit: 'Edit case',
  send: 'Send to vendor',
  'confirm-received': 'Mark received',
  receive: 'Mark ready',
  deliver: 'Deliver',
  complete: 'Mark complete',
  rework: 'Send for rework',
  cancel: 'Cancel',
};

function fmt(d: string | Date | null): string {
  if (!d) return '—';
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
  const action = useLabCaseAction(caseId);
  const upload = useUploadLabPhoto(caseId);
  const [revealVendor, setRevealVendor] = useState(false);
  const vendorDetail = useLabVendorDetail(revealVendor && c ? c.vendorId : null);
  const [reasonSheet, setReasonSheet] = useState<null | 'rework' | 'cancel'>(null);
  const [reason, setReason] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading || !c) {
    return <AnimatedPage className="flex flex-1 items-center justify-center px-5">Loading…</AnimatedPage>;
  }

  const s = labStatusStyle(c.status);
  const due = expectedReturnInfo(c.expectedReturnAt);
  const actions = labCaseActions(c.status);
  const margin = c.costPaise != null && c.patientChargePaise != null ? c.patientChargePaise - c.costPaise : null;

  async function runAction(a: string) {
    if (a === 'edit') {
      router.push(`/lab/${caseId}/edit`);
      return;
    }
    if (a === 'rework' || a === 'cancel') {
      setReason('');
      setReasonSheet(a);
      return;
    }
    try {
      await action.mutateAsync({ action: a });
      toast.success('Updated');
    } catch (err) {
      toast.apiError(err);
    }
  }

  async function submitReason() {
    if (!reasonSheet || reason.trim().length === 0) return;
    try {
      await action.mutateAsync({ action: reasonSheet, body: { reason } });
      toast.success(reasonSheet === 'cancel' ? 'Case cancelled' : 'Sent for rework');
      setReasonSheet(null);
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
        <h1 className="font-mono text-sm font-semibold">Case {c.caseNumber}</h1>
      </div>

      {/* STATUS CARD */}
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
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={a === 'cancel' ? 'destructive' : a === 'rework' || a === 'edit' ? 'outline' : 'primary'}
                disabled={action.isPending}
                onClick={() => runAction(a)}
              >
                {ACTION_LABEL[a]}
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
        <ul className="flex flex-col gap-1 text-sm">
          <li>{fmt(c.impressionTakenAt)} · Impression taken</li>
          <li>{fmt(c.sentAt)} · Sent to vendor</li>
          <li>{fmt(c.returnedAt)} · Returned (ready)</li>
          <li>{fmt(c.deliveredAt)} · Delivered</li>
          <li>{fmt(c.completedAt)} · Completed</li>
        </ul>
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

      <BottomSheet open={reasonSheet !== null} onClose={() => setReasonSheet(null)} title={reasonSheet === 'cancel' ? 'Cancel case' : 'Send for rework'}>
        <div className="flex flex-col gap-3 p-5">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            rows={3}
            className="w-full rounded-lg border border-border bg-paper-warm px-3 py-2 text-sm outline-none focus:border-border-strong"
          />
          <Button disabled={reason.trim().length === 0 || action.isPending} onClick={submitReason}>
            Confirm
          </Button>
        </div>
      </BottomSheet>

      {c.status === 'CANCELLED' && c.rejectionReason ? (
        <EmptyState variant="inline" title="Cancelled" body={c.rejectionReason} />
      ) : null}
    </AnimatedPage>
  );
}
