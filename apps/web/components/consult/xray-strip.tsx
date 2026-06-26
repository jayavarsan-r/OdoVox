'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Image as ImageIcon, X } from 'lucide-react';
import type { ConsultationContext } from '@odovox/types';
import { fetchMediaUrl } from '@/lib/queries';

type Xray = ConsultationContext['xrays'][number];

function XrayThumb({ xray, onOpen }: { xray: Xray; onOpen: (url: string, isPdf: boolean) => void }) {
  const { data: url } = useQuery({ queryKey: ['media-url', xray.id], queryFn: () => fetchMediaUrl(xray.id) });
  const isPdf = xray.mimeType.includes('pdf');
  return (
    <button
      type="button"
      onClick={() => url && onOpen(url, isPdf)}
      className="size-[120px] shrink-0 overflow-hidden rounded-lg border border-border bg-paper-warm shadow-elev-1"
    >
      {isPdf || !url ? (
        <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-text-muted">
          <FileText className="size-6" /> {isPdf ? 'PDF' : '…'}
        </span>
      ) : (
        <img src={url} alt="x-ray" className="size-full object-cover" />
      )}
    </button>
  );
}

/** X-ray thumbnails with a tap-to-fullscreen viewer (native pinch-zoom via touch-action). */
export function XrayStrip({ xrays }: { xrays: Xray[] }) {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  if (xrays.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-subtle">
        Attached x-rays · {xrays.length}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {xrays.map((x) => (
          <XrayThumb key={x.id} xray={x} onOpen={(url, isPdf) => (isPdf ? window.open(url, '_blank') : setViewerUrl(url))} />
        ))}
      </div>
      <AnimatePresence>
        {viewerUrl ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewerUrl(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-4"
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute right-4 top-4 rounded-pill bg-paper/20 p-2 text-paper"
            >
              <X className="size-5" />
            </button>
            <img
              src={viewerUrl}
              alt="x-ray"
              className="max-h-full max-w-full object-contain"
              style={{ touchAction: 'pinch-zoom' }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Compact "📷 N" indicator for the recording state — tap to expand back to the strip is on IDLE. */
export function XrayCountChip({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
      <ImageIcon className="size-3.5" /> {count}
    </span>
  );
}
