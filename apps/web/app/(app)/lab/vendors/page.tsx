'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Store } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ds';
import { useToast } from '@/lib/toast';
import { useCreateLabVendor, useLabVendors } from '@/lib/lab-queries';

const inputCls = 'w-full rounded-lg border border-border bg-paper-warm px-3 py-2 text-sm outline-none focus:border-border-strong';

export default function LabVendorsPage() {
  const router = useRouter();
  const toast = useToast();
  const vendors = useLabVendors();
  const create = useCreateLabVendor();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [turnaround, setTurnaround] = useState('7');

  async function submit() {
    if (!name.trim() || !/^[6-9]\d{9}$/.test(phone)) {
      toast.error('Enter a name and valid 10-digit phone');
      return;
    }
    try {
      await create.mutateAsync({
        name,
        contactPhone: phone,
        contactPersonName: contactPerson || undefined,
        defaultTurnaroundDays: Number(turnaround) || 7,
        specialties: [],
      });
      toast.success('Vendor added');
      setOpen(false);
      setName('');
      setPhone('');
      setContactPerson('');
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
            <div key={v.id} className="rounded-lg border border-border bg-surface p-3 shadow-elev-1">
              <p className="text-sm font-semibold">{v.name}</p>
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
            </div>
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
          <input className={inputCls} placeholder="Contact person (optional)" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          <input className={inputCls} placeholder="Turnaround days" inputMode="numeric" value={turnaround} onChange={(e) => setTurnaround(e.target.value)} />
          <Button disabled={create.isPending} onClick={submit}>
            Save vendor
          </Button>
        </div>
      </BottomSheet>
    </AnimatedPage>
  );
}
