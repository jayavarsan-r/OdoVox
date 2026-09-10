'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useUpdateBudget, useToggleTemplate, useWhatsAppSettings } from '@/lib/whatsapp-queries';
import { budgetPercent, rupees } from '@/lib/whatsapp-ui';
import { lastSixMonths, maskPhone, templateGroups } from '@/lib/whatsapp/template-groups';
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
  // A fixed six-month axis, so one month of spend is one bar and not a full-width block.
  const costs = lastSixMonths(s?.costHistory ?? []);
  const maxCost = Math.max(1, ...costs.map((c) => c.totalCostPaise));
  const groups = templateGroups(s?.templates ?? []);

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
        <button
          type="button"
          onClick={() => router.push('/clinic')}
          aria-label="Back"
          className="rounded-full p-1"
        >
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
              <span
                className={cn(
                  'size-2 rounded-full',
                  s.accountStatus === 'connected' ? 'bg-sage-deep' : 'bg-border-strong',
                )}
              />
              <span className="text-sm font-semibold capitalize">
                {s.accountStatus ?? 'not connected'}
              </span>
            </div>
            {/*
              MASKED, as frame 72 shows it. This screen is readable by any clinic role and is
              routinely the one on display when someone is being shown around; the number
              identifies the clinic's WhatsApp Business account, and the card's question is
              "are we connected", not "what is the number".

              The provider name is gone with it — `mock` / `aisensy` is a deployment detail
              that tells a dentist nothing and looks like a fault when it reads "mock".
            */}
            {s.accountPhoneNumber ? (
              <p className="text-sm text-text-subtle">
                Business · {maskPhone(s.accountPhoneNumber)}
              </p>
            ) : null}
          </section>

          {/*
            Frame 72's "Automatic messages": one switch per DECISION, not per Meta template.
            The list used to show raw keys — appointment_reminder_1h,
            outstanding_balance_reminder — which are identifiers, not choices. A dentist
            deciding whether to chase patients for money should not have to know the chase is
            called `outstanding_balance_reminder`, or that "remind them about the appointment"
            is two approved templates that both have to be on.

            Grouping is in lib/whatsapp/template-groups.ts with its own tests, including that
            an unrecognised template still gets a row: a message going to patients that nobody
            can see on this screen is the failure worth avoiding.
          */}
          <section className="space-y-3">
            <p className="px-1 text-2xs font-heavy tracking-[0.06em] text-pine-3">
              AUTOMATIC MESSAGES
            </p>
            <div className="rounded-2xl bg-white shadow-elev-1">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-3 px-[15px] py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair"
                >
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-heavy text-pine">
                    {g.label}
                  </span>
                  {g.hint ? (
                    <span className="shrink-0 text-xs font-semibold text-pine-3">{g.hint}</span>
                  ) : null}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={g.enabled}
                    aria-label={g.label}
                    onClick={() =>
                      // One tap sets every template in the group, which is what a single
                      // switch above several of them already appeared to promise.
                      g.keys.forEach((templateKey) =>
                        toggle.mutate({ templateKey, isEnabled: !g.enabled }),
                      )
                    }
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                      g.enabled ? 'bg-lime' : 'bg-[rgba(31,42,35,0.13)]',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 size-5 rounded-full bg-white shadow-elev-1 transition-all',
                        g.enabled ? 'left-[22px]' : 'left-0.5',
                      )}
                    />
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
                <button
                  type="button"
                  onClick={saveBudget}
                  className="rounded-pill bg-lime px-4 py-2 text-sm font-semibold text-ink"
                >
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
                    <div
                      className={cn(
                        'h-full rounded-full',
                        pct >= s.warningThreshold * 100 ? 'bg-peach-deep' : 'bg-sage',
                      )}
                      style={{ width: `${pct}%` }}
                    />
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
            <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">
              Costs (last 6 months)
            </p>
            {costs.every((c) => c.totalCostPaise === 0) ? (
              <p className="flex items-center gap-2 text-sm text-text-subtle">
                <MessageSquare className="size-4" /> No conversations billed yet.
              </p>
            ) : (
              <div className="flex h-28 items-end justify-between gap-2">
                {costs.map((c) => (
                  <div
                    key={`${c.year}-${c.month}`}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
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
