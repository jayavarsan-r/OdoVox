'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { BentoTile, EmptyState } from '@/components/ds';
import { api } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { rupees } from '@/lib/patient-ui';
import { cn } from '@/lib/utils';
import type { BillStatus } from '@odovox/types';
import { billStatusStyle } from '@/lib/billing/format';
import { BillSheet } from '@/components/billing/bill-sheet';

interface BillRow {
  id: string;
  billNumber: string;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  status: BillStatus;
  createdAt: string;
  /** What the bill was for, derived from its items. Null when it has none. */
  description: string | null;
  payment: { lastAt: string | null; method: string | null; mixed: boolean };
}
interface BillingData {
  summary: { totalBilledPaise: number; totalPaidPaise: number; outstandingPaise: number };
  bills: BillRow[];
}

/**
 * Frame 41's sub-line: "28 Jun · UPI". Each half is dropped when the records cannot answer
 * it, so an unpaid bill shows its raised date alone and a bill settled across two methods
 * shows "Mixed" rather than picking one.
 */
function billSubline(b: BillRow): string {
  const when = b.payment.lastAt ?? b.createdAt;
  const date = new Date(when).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
  const how = b.payment.mixed ? 'Mixed' : b.payment.method;
  return how ? `${date} · ${how}` : date;
}

export function BillingTab({ patientId }: { patientId: string }) {
  const billing = useQuery({ queryKey: ['billing', patientId], queryFn: () => api.get<BillingData>(`/patients/${patientId}/billing`) });
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

  if (billing.isLoading) return <Spinner />;
  const d = billing.data!;
  // One source. The tab used to fetch bills twice — useBills() for the rows and
  // /patients/:id/billing for the summary — so a row and the total above it could
  // disagree after a payment landed between the two responses.
  const rows = d.bills;
  return (
    <div className="space-y-4">
      {/* Frame 41's bento pair. "Billed" is dropped from the headline — a receptionist
          asks what is owed and what has come in; the gross total is the one figure that
          changes no decision, and it is still on every bill below. */}
      <div className="grid grid-cols-2 gap-gap-tight">
        <BentoTile
          tone={d.summary.outstandingPaise > 0 ? 'crit' : 'neutral'}
          label="OUTSTANDING"
          value={rupees(d.summary.outstandingPaise)}
        />
        <BentoTile label="PAID · ALL TIME" value={rupees(d.summary.totalPaidPaise)} className="[&>div:first-child]:whitespace-nowrap" />
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
              <div className="min-w-0 flex-1">
                {/* The description when the bill has items; the bill number only as the
                    fallback, never as a substitute for it. */}
                <p className="truncate text-[14px] font-heavy text-pine">
                  {b.description ?? b.billNumber}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] font-semibold text-pine-3">
                  {billSubline(b)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[14px] font-heavy tabular-nums text-pine">{rupees(b.totalPaise)}</span>
                <span className={cn('rounded-pill px-2 py-0.5 text-[11px] font-heavy', s.pill)}>{s.label}</span>
              </div>
            </button>
          );
        })
      )}
      {/* Frame 41's action row. Collect names the figure it will settle, so the
          receptionist confirms the amount before opening anything; it appears only when
          something is actually owed. Remind reuses the WhatsApp send the patient's own
          card already uses — no second messaging path. */}
      {d.summary.outstandingPaise > 0 ? (
        <div className="flex gap-2.5 pt-1">
          <Button
            className="h-12 flex-1"
            onClick={() => {
              const due = rows.find((b) => b.balancePaise > 0);
              if (due) setOpenBillId(due.id);
            }}
          >
            Collect {rupees(d.summary.outstandingPaise)}
          </Button>
          {/* Frame 41's "Remind" is NOT shipped. It needs a payment-reminder WhatsApp
              template, and the clinic has four approved templates, none of them about
              money. Templates require Meta approval before they can send, so adding one
              is a compliance step, not a UI detail — omitted rather than wired to a
              template that would fail at send time (deviation recorded). */}
        </div>
      ) : null}

      <BillSheet billId={openBillId} onClose={() => setOpenBillId(null)} />
    </div>
  );
}

// ===== Shared sub-forms ======================================================
