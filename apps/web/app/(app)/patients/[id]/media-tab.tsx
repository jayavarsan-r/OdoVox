'use client';

import { useQuery } from '@tanstack/react-query';
import { Trash2, Plus, FileText, ImageIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ds';
import { useToast } from '@/lib/toast';
import { useMedia, useUploadMedia, useDeleteMedia, fetchMediaUrl } from '@/lib/queries';

export function MediaTab({ patientId }: { patientId: string }) {
  const toast = useToast();
  const media = useMedia(patientId);
  const upload = useUploadMedia(patientId);
  const del = useDeleteMedia(patientId);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const type = file.type === 'application/pdf' ? 'DOCUMENT' : 'XRAY';
    try {
      await upload.mutateAsync({ file, type });
      toast.success('Uploaded.');
    } catch (err) {
      toast.apiError(err);
    }
  };

  const items = media.data?.items ?? [];
  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface p-4 text-sm font-medium text-muted-foreground">
        {upload.isPending ? <Spinner /> : <Plus className="size-4" />}
        Upload x-ray, photo or document
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {media.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<ImageIcon />}
          iconTone="sky"
          title="No media yet"
          body="Upload x-rays, photos, or documents."
        />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((m) => (
            <MediaThumb key={m.id} id={m.id} type={m.type} onDelete={() => del.mutate(m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MediaThumb({ id, type, onDelete }: { id: string; type: string; onDelete: () => void }) {
  const { data: url } = useQuery({ queryKey: ['media-url', id], queryFn: () => fetchMediaUrl(id) });
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-paper-warm">
      {type === 'DOCUMENT' || !url ? (
        <button onClick={() => url && window.open(url, '_blank')} className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
          <FileText className="size-6" /> {type === 'DOCUMENT' ? 'PDF' : '…'}
        </button>
      ) : (
        <img src={url} alt="media" className="size-full object-cover" onClick={() => window.open(url, '_blank')} />
      )}
      <button onClick={onDelete} aria-label="Delete" className="absolute right-1 top-1 hidden rounded-pill bg-ink/70 p-1 text-paper group-hover:block">
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

