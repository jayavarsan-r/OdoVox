'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/toast';
import { useLabCase, useLabVendors, useUpdateLabCase } from '@/lib/lab-queries';

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-border-strong';

export default function EditLabCasePage() {
  const router = useRouter();
  const { caseId } = useParams<{ caseId: string }>();
  const toast = useToast();
  const { data: c } = useLabCase(caseId);
  const vendors = useLabVendors();
  const update = useUpdateLabCase(caseId);

  const [vendorId, setVendorId] = useState('');
  const [material, setMaterial] = useState('');
  const [shade, setShade] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (c) {
      setVendorId(c.vendorId);
      setMaterial(c.material ?? '');
      setShade(c.shade ?? '');
      setDescription(c.description ?? '');
    }
  }, [c]);

  if (!c) return <AnimatedPage className="flex flex-1 items-center justify-center px-5">Loading…</AnimatedPage>;

  const editable = c.status === 'DRAFT' || c.status === 'SENT';

  async function save() {
    try {
      await update.mutateAsync({ vendorId, material: material || null, shade: shade || null, description: description || null });
      toast.success('Saved');
      router.replace(`/lab/${caseId}`);
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
        <h1 className="text-lg font-semibold">Edit {c.caseNumber}</h1>
      </div>

      {!editable ? (
        <p className="rounded-lg bg-paper-warm p-3 text-sm text-text-subtle">Only draft or sent cases can be edited.</p>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-subtle">Vendor</span>
            <select className={inputCls} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              {vendors.data?.items.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-subtle">Material</span>
            <input className={inputCls} value={material} onChange={(e) => setMaterial(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-subtle">Shade</span>
            <input className={inputCls} value={shade} onChange={(e) => setShade(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-subtle">Description</span>
            <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <Button disabled={update.isPending} onClick={save}>
            Save changes
          </Button>
        </>
      )}
    </AnimatedPage>
  );
}
