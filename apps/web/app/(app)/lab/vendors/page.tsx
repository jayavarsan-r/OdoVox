'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, MessageCircle, Plus, Store } from 'lucide-react';
import type { LabVendorResponse } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { useToast } from '@/lib/toast';
import {
  useCreateLabVendor,
  useLabVendorAutomation,
  useLabVendorConsent,
  useLabVendors,
  useUpdateLabVendor,
} from '@/lib/lab-queries';
import { cn } from '@/lib/utils';

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
        <h1 className="text-lg font-semibold">Lab vendors</h1>
      </div>

      {vendors.data?.items.length === 0 ? (
        <EmptyState variant="inline" icon={<Store className="size-5" />} title="No vendors yet" body="Add the labs you send cases to." />
      ) : (
        <div className="flex flex-col gap-2">
          {vendors.data?.items.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelected(v)}
              className="rounded-lg border border-border bg-surface p-3 text-left shadow-elev-1 transition-shadow active:shadow-elev-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{v.name}</p>
                <WaChip v={v} />
              </div>
              <p className="text-xs text-text-subtle">
                {v.contactPersonName ? `${v.contactPersonName} · ` : ''}
                {v.defaultTurnaroundDays}-day turnaround
              </p>
              {v.specialties.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {v.specialties.map((s) => (
                    <span key={s} className="rounded-pill bg-paper-warm px-2 py-0.5 text-[10px] text-text-subtle">
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}

      <Button className="self-start" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add vendor
      </Button>

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
