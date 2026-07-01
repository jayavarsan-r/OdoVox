'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useUpdateBudget, useToggleTemplate, useWhatsAppSettings } from '@/lib/whatsapp-queries';
import { budgetPercent, rupees } from '@/lib/whatsapp-ui';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const query = useWhatsAppSettings();
  const toggle = useToggleTemplate();
  const updateBudget = useUpdateBudget();
  const toast = useToast();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetRupees, setBudgetRupees] = useState('');

  const s = query.data;
  const pct = s ? budgetPercent(s.spentThisMonthPaise, s.budgetPaise) : null;
  const maxCost = s ? Math.max(1, ...s.costHistory.map((c) => c.totalCostPaise)) : 1;

  async function saveBudget() {
    const val = budgetRupees.trim() === '' ? null : Math.round(Number(budgetRupees) * 100);
    if (val !== null && (Number.isNaN(val) || val < 0)) {
      toast.error('Enter a valid amount');
      return;
    }
    await updateBudget.mutateAsync({ budgetPaise: val });
    setEditingBudget(false);
    toast.success('Budget updated');
  }

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-5 bg-paper px-5 pt-6 pb-28">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push('/clinic')} aria-label="Back" className="rounded-full p-1">
          <ArrowLeft className="size-5" />
        </button>
        <EditorialHeading title="WhatsApp" />
      </div>

      {query.isLoading || !s ? (
        <ListSkeleton />
      ) : (
        <>
          {/* Account */}
          <section className="space-y-2 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">Account</p>
            <div className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', s.accountStatus === 'connected' ? 'bg-sage-deep' : 'bg-border-strong')} />
              <span className="text-sm font-semibold capitalize">{s.accountStatus ?? 'not connected'}</span>
            </div>
            {s.accountPhoneNumber ? <p className="text-sm text-text-subtle">Business number: {s.accountPhoneNumber}</p> : null}
            <p className="text-sm text-text-subtle">Provider: {s.provider}</p>
          </section>

          {/* Templates */}
          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">
              Templates ({s.templates.filter((t) => t.isEnabled).length} active)
            </p>
            <div className="flex flex-col gap-2">
              {s.templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-elev-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.templateKey}</p>
                    <p className="text-xs text-text-subtle">
                      {t.category} · {t.approvalStatus} · {t.sentThisMonth ?? 0} sent this month
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.isEnabled}
                    aria-label={`Toggle ${t.templateKey}`}
                    onClick={() => toggle.mutate({ templateKey: t.templateKey, isEnabled: !t.isEnabled })}
                    className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', t.isEnabled ? 'bg-lime' : 'bg-border-strong')}
                  >
                    <span className={cn('absolute top-0.5 size-5 rounded-full bg-paper transition-all', t.isEnabled ? 'left-[22px]' : 'left-0.5')} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Budget */}
          <section className="space-y-2 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">Budget</p>
            {editingBudget ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={budgetRupees}
                  onChange={(e) => setBudgetRupees(e.target.value)}
                  placeholder="₹ per month (blank = unlimited)"
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-border-strong"
                />
                <button type="button" onClick={saveBudget} className="rounded-pill bg-lime px-4 py-2 text-sm font-semibold text-ink">
                  Save
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm">
                  This month: <span className="font-semibold">{rupees(s.spentThisMonthPaise)}</span>
                  {s.budgetPaise != null ? <> / {rupees(s.budgetPaise)} budget</> : <> · no cap</>}
                </p>
                {pct != null ? (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
                    <div className={cn('h-full rounded-full', pct >= s.warningThreshold * 100 ? 'bg-peach-deep' : 'bg-sage')} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setBudgetRupees(s.budgetPaise != null ? String(s.budgetPaise / 100) : '');
                    setEditingBudget(true);
                  }}
                  className="text-xs font-medium text-text-subtle underline"
                >
                  Edit budget
                </button>
              </>
            )}
          </section>

          {/* Cost history */}
          <section className="space-y-3 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">Costs (last 6 months)</p>
            {s.costHistory.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-text-subtle">
                <MessageSquare className="size-4" /> No conversations billed yet.
              </p>
            ) : (
              <div className="flex h-28 items-end justify-between gap-2">
                {s.costHistory.map((c) => (
                  <div key={`${c.year}-${c.month}`} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-sage"
                      style={{ height: `${Math.max(4, (c.totalCostPaise / maxCost) * 88)}px` }}
                      title={rupees(c.totalCostPaise)}
                    />
                    <span className="text-[10px] text-text-subtle">{MONTHS[c.month - 1]}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AnimatedPage>
  );
}
