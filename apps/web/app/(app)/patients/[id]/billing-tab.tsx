'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ds';
import { api } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { rupees } from '@/lib/patient-ui';
import { cn } from '@/lib/utils';
import { useBills } from '@/lib/billing/api';
import { billStatusStyle } from '@/lib/billing/format';
import { BillSheet } from '@/components/billing/bill-sheet';

interface BillingData {
  summary: { totalBilledPaise: number; totalPaidPaise: number; outstandingPaise: number };
  bills: { id: string; totalPaise: number; paidPaise: number; status: string; createdAt: string }[];
}

export function BillingTab({ patientId }: { patientId: string }) {
  const billing = useQuery({ queryKey: ['billing', patientId], queryFn: () => api.get<BillingData>(`/patients/${patientId}/billing`) });
  const bills = useBills({ patientId });
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

  if (billing.isLoading || bills.isLoading) return <Spinner />;
  const d = billing.data!;
  const rows = bills.data?.items ?? [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface p-4">
        <div><p className="text-xs text-muted-foreground">Billed</p><p className="font-semibold">{rupees(d.summary.totalBilledPaise)}</p></div>
        <div><p className="text-xs text-muted-foreground">Paid</p><p className="font-semibold">{rupees(d.summary.totalPaidPaise)}</p></div>
        <div><p className="text-xs text-muted-foreground">Due</p><p className="font-semibold text-danger">{rupees(d.summary.outstandingPaise)}</p></div>
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
              <div>
                <p className="text-sm font-medium text-ink">{b.billNumber}</p>
                <p className="text-xs text-text-subtle">{new Date(b.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm tabular-nums text-ink">{rupees(b.totalPaise)}</span>
                <span className={cn('rounded-pill px-2 py-0.5 text-xs font-medium', s.pill)}>{s.label}</span>
              </div>
            </button>
          );
        })
      )}
      <BillSheet billId={openBillId} onClose={() => setOpenBillId(null)} />
    </div>
  );
}

// ===== Shared sub-forms ======================================================
