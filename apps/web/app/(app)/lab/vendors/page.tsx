'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, MessageCircle, Plus, Store } from 'lucide-react';
import type { LabVendorResponse } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { Mini } from '@/components/ui/badge';
import { useToast } from '@/lib/toast';
import {
  useCreateLabVendor,
  useLabVendorAutomation,
  useLabVendorConsent,
  useLabVendors,
  useUpdateLabVendor,
} from '@/lib/lab-queries';
import { useLabVendorAnalytics } from '@/lib/lab-inbox-queries';
import { cn } from '@/lib/utils';

/** §2.14 — the sales-asset numbers: clinics can see which labs deliver on time. */
/**
 * Frame 61's 90-day performance: four tiles, not a list of seven rows.
 *
 * The numbers already existed behind GET /lab/vendors/:id/analytics — they were rendered as
 * a key/value table inside a vendor's sheet, so comparing two labs meant opening one,
 * remembering it, and opening the other.
 *
 * Four tiles rather than seven rows because these are the four a clinic actually chooses a
 * lab on: how long, how fast they answer, how much work and how much of it went wrong, and
 * what the messaging costs. On-time rate and turnaround average move up to the vendor's own
 * row as chips, which is where the frame puts them too — they are identity, not analysis.
 */
function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-elev-1">
      <p className="text-2xs font-heavy tracking-[0.06em] text-pine-3">{label}</p>
      <p className="mt-1 text-[19px] font-black leading-none tabular-nums text-pine">
        {value}
        {sub ? <span className="ml-1 text-xs font-bold text-pine-3">{sub}</span> : null}
      </p>
    </div>
  );
}

/**
 * The two chips beside a vendor's name: on-time rate and average turnaround.
 *
 * Falls back to the CONFIGURED target when a lab has no completed history — "7d target" is a
 * fact about the arrangement, where "—d avg" would just be a blank pretending to be data.
 */
function VendorRowStats({
  vendorId,
  fallbackTarget,
}: {
  vendorId: string;
  fallbackTarget: number;
}) {
  const { data: a } = useLabVendorAnalytics(vendorId);
  if (!a || a.volume90 === 0) return <Mini tone="neutral">{fallbackTarget}d target</Mini>;
  return (
    <>
      {a.onTimeRate !== null ? (
        <Mini tone={a.onTimeRate >= 0.8 ? 'neutral' : 'warn'}>
          On-time {Math.round(a.onTimeRate * 100)}%
        </Mini>
      ) : null}
      <Mini tone="neutral">
        {a.turnaroundDaysAvg !== null ? `${a.turnaroundDaysAvg}d avg` : `${fallbackTarget}d target`}
      </Mini>
    </>
  );
}

function VendorPerformance({ vendorId }: { vendorId: string }) {
  const { data: a } = useLabVendorAnalytics(vendorId);
  if (!a) return null;
  if (a.volume90 === 0) {
    return (
      <p className="rounded-2xl bg-white p-4 text-xs font-semibold text-pine-3 shadow-elev-1">
        No cases sent to this lab in the last 90 days.
      </p>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Tile
          label="TURNAROUND"
          value={a.turnaroundDaysAvg !== null ? `${a.turnaroundDaysAvg}d` : '—'}
          sub={`/ ${a.targetTurnaroundDays}d target`}
        />
        <Tile
          label="MEDIAN REPLY"
          // Hours below one read better as minutes — "0.3h" is a number you have to convert
          // in your head before it means anything.
          value={
            a.medianReplyHours === null
              ? '—'
              : a.medianReplyHours < 1
                ? `${Math.round(a.medianReplyHours * 60)} min`
                : `${a.medianReplyHours}h`
          }
        />
        <Tile
          label="VOLUME · ISSUES"
          value={`${a.volume90} · ${a.issuesRaised}`}
        />
        <Tile
          label="WA COST / CASE"
          value={`₹${(a.costPerCasePaise / 100).toFixed(2)}`}
        />
      </div>
      {/* Overdue is the one number here that is a thing to DO rather than a thing to know,
          so it only appears when there is something to do about it. */}
      {a.overdueOpenCount > 0 ? (
        <p className="px-1 text-xs font-heavy text-crit">
          {a.overdueOpenCount} case{a.overdueOpenCount > 1 ? 's' : ''} overdue with this lab
          right now
        </p>
      ) : null}
    </>
  );
}

/** "Sri Balaji Dental Lab" -> "SB". Two marks are easier to pick out than a line of text. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? '?').concat(words[1]?.[0] ?? '').toUpperCase();
}

const inputCls = 'w-full rounded-lg border border-border bg-paper-warm px-3 py-2 text-sm outline-none focus:border-border-strong';

/** WhatsApp status chip for a vendor row — the consent state at a glance (§2.11). */
function WaChip({ v }: { v: LabVendorResponse }) {
  if (v.whatsappPhoneNumbers.length === 0) {
    return <span className="rounded-pill bg-paper-warm px-2 py-0.5 text-[10px] text-text-subtle">No WhatsApp</span>;
  }
  if (!v.consentLoggedAt) {
    return <span className="rounded-pill bg-peach-soft px-2 py-0.5 text-[10px] font-medium text-ink">Consent pending</span>;
  }
  if (v.automationPaused) {
    return <span className="rounded-pill bg-paper-warm px-2 py-0.5 text-[10px] text-text-subtle">Automation paused</span>;
  }
  return <span className="rounded-pill bg-sage-tint px-2 py-0.5 text-[10px] font-medium text-sage-deep">WhatsApp active</span>;
}

/** Per-vendor sheet: WhatsApp numbers + language + consent actions + automation kill switch. */
function VendorSheet({ vendor, onClose }: { vendor: LabVendorResponse | null; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateLabVendor(vendor?.id ?? '');
  const consent = useLabVendorConsent(vendor?.id ?? '');
  const automation = useLabVendorAutomation(vendor?.id ?? '');
  const [numbers, setNumbers] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);
  if (vendor && seeded !== vendor.id) {
    setSeeded(vendor.id);
    setNumbers(vendor.whatsappPhoneNumbers.map((n) => n.replace(/^\+91/, '')).join(', '));
  }
  if (!vendor) return null;

  async function saveNumbers() {
    const list = numbers
      .split(/[,\s]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (list.some((n) => !/^[6-9]\d{9}$/.test(n))) {
      toast.error('Each WhatsApp number must be a valid 10-digit mobile.');
      return;
    }
    try {
      await update.mutateAsync({ whatsappPhoneNumbers: list });
      toast.success('WhatsApp numbers saved');
    } catch (err) {
      toast.apiError(err);
    }
  }

  async function doConsent(action: 'mark_confirmed' | 'send_optin') {
    try {
      const res = await consent.mutateAsync(action);
      toast.success(action === 'send_optin' ? 'Opt-in message sent — consent logs when they reply YES.' : 'Consent confirmed.');
      void res;
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={vendor.name}>
      <div className="flex flex-col gap-4 p-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">WhatsApp numbers</p>
          <p className="text-xs text-text-muted">Owner, technician, pickup — comma-separated. SIMs change; edit any time.</p>
          <input className={inputCls} placeholder="98765 43210, 98765 43211" value={numbers} onChange={(e) => setNumbers(e.target.value)} />
          <Button size="sm" variant="outline" onClick={saveNumbers} loading={update.isPending}>
            Save numbers
          </Button>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Language</p>
          <div className="flex gap-2">
            {(['en', 'ta', 'hi'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => void update.mutateAsync({ preferredLanguage: lang }).then(() => toast.success('Language updated')).catch(toast.apiError)}
                className={cn(
                  'rounded-pill px-3 py-1.5 text-xs font-medium',
                  vendor.preferredLanguage === lang ? 'bg-lime text-ink' : 'bg-paper-warm text-text-muted',
                )}
              >
                {lang === 'en' ? 'English' : lang === 'ta' ? 'தமிழ்' : 'हिंदी'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Consent</p>
          {vendor.consentLoggedAt ? (
            <p className="text-sm text-sage-deep">
              Opted in on {new Date(vendor.consentLoggedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          ) : (
            <>
              <p className="text-xs text-text-muted">Have you spoken to this lab about receiving cases via WhatsApp?</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void doConsent('send_optin')} loading={consent.isPending} disabled={vendor.whatsappPhoneNumbers.length === 0}>
                  <MessageCircle className="size-4" /> Send opt-in message
                </Button>
                <Button size="sm" variant="outline" onClick={() => void doConsent('mark_confirmed')} loading={consent.isPending}>
                  They already agreed
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Performance (last 90 days)</p>
          <VendorPerformance vendorId={vendor.id} />
        </div>

        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">Pause automation</span>
          <input
            type="checkbox"
            checked={vendor.automationPaused}
            onChange={(e) => void automation.mutateAsync(e.target.checked).then(() => toast.success(e.target.checked ? 'Automation paused' : 'Automation resumed')).catch(toast.apiError)}
            className="size-4 accent-lime"
          />
        </label>
        <p className="-mt-3 text-xs text-text-muted">Paused labs get no automated nudges — manual tracking keeps working.</p>
      </div>
    </BottomSheet>
  );
}

export default function LabVendorsPage() {
  const router = useRouter();
  const toast = useToast();
  const vendors = useLabVendors();
  const create = useCreateLabVendor();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LabVendorResponse | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [waNumbers, setWaNumbers] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [turnaround, setTurnaround] = useState('7');

  async function submit() {
    if (!name.trim() || !/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Enter a name and valid 10-digit phone');
      return;
    }
    const wa = waNumbers
      .split(/[,\s]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (wa.some((n) => !/^[6-9]\d{9}$/.test(n))) {
      toast.error('Each WhatsApp number must be a valid 10-digit mobile.');
      return;
    }
    try {
      const created = await create.mutateAsync({
        name,
        contactPhone: phone,
        contactPersonName: contactPerson || undefined,
        defaultTurnaroundDays: Number(turnaround) || 7,
        specialties: [],
        whatsappPhoneNumbers: wa,
        preferredLanguage: 'en',
      });
      toast.success('Vendor added');
      setOpen(false);
      setName('');
      setPhone('');
      setWaNumbers('');
      setContactPerson('');
      // §2.11 — the consent question comes right after adding a lab with WhatsApp numbers.
      if (wa.length > 0) setSelected(created);
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-9 items-center justify-center rounded-pill hover:bg-muted">
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="flex-1 text-lg font-semibold">Vendors</h1>
        {/* The frame's lime + circle. It replaces an "Add vendor" button that sat BELOW the
            list, so on a clinic with a dozen labs you scrolled past all of them to add one. */}
        <button
          type="button"
          aria-label="Add vendor"
          onClick={() => setOpen(true)}
          className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-lime text-pine shadow-cta"
        >
          <Plus className="size-[18px]" />
        </button>
      </div>

      {vendors.data?.items.length === 0 ? (
        <EmptyState variant="inline" icon={<Store className="size-5" />} title="No vendors yet" body="Add the labs you send cases to." />
      ) : (
        <div className="rounded-2xl bg-white shadow-elev-1">
          {vendors.data?.items.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelected(v)}
              className="flex w-full items-center gap-3 px-[15px] py-3 text-left [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair"
            >
              {/* Initials, as the frame has them. A lab is a place you picture, and three
                  rows of identical text is harder to pick from than three marks. */}
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill border border-hair-2 text-xs font-heavy text-pine-3">
                {initials(v.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-heavy text-pine">{v.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <WaChip v={v} />
                  {/* On-time and turnaround sit on the row, as the frame has them: they are
                      how you tell one lab from another, not analysis you go looking for. */}
                  <VendorRowStats vendorId={v.id} fallbackTarget={v.defaultTurnaroundDays} />
                </span>
              </span>
              <ChevronRight className="size-[15px] shrink-0 text-pine-3" />
            </button>
          ))}
        </div>
      )}

      {/*
        Frame 61's "90-day performance". The numbers already existed behind
        GET /lab/vendors/:id/analytics and were only reachable by opening a vendor's sheet —
        so comparing two labs meant opening one, remembering it, and opening the other.

        Shown for the first vendor by default, which is the one the panel names.
      */}
      {vendors.data?.items.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[13.5px] font-heavy text-pine">
            90-day performance · {(selected ?? vendors.data.items[0]!).name}
          </h2>
          <VendorPerformance vendorId={(selected ?? vendors.data.items[0]!).id} />
        </section>
      ) : null}

      <BottomSheet open={open} onClose={() => setOpen(false)} title="New lab vendor">
        <div className="flex flex-col gap-3 p-5">
          <input className={inputCls} placeholder="Lab name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Contact phone (10 digits)" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className={inputCls} placeholder="WhatsApp numbers (comma-separated, optional)" inputMode="numeric" value={waNumbers} onChange={(e) => setWaNumbers(e.target.value)} />
          <input className={inputCls} placeholder="Contact person (optional)" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          <input className={inputCls} placeholder="Turnaround days" inputMode="numeric" value={turnaround} onChange={(e) => setTurnaround(e.target.value)} />
          <Button disabled={create.isPending} onClick={submit}>
            Save vendor
          </Button>
        </div>
      </BottomSheet>

      <VendorSheet vendor={selected} onClose={() => setSelected(null)} />
    </AnimatedPage>
  );
}
