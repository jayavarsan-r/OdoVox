'use client';

import { Search, Mic } from 'lucide-react';
import { useDictation } from '@/lib/voice/use-dictation';
import { normalizeForSearch } from '@/lib/voice/single-shot';
import { cn } from '@/lib/utils';

/**
 * Search pill with a Sarvam-backed single-shot mic (Phase 3 — swapped from the Web Speech stub).
 * Record → auto-stop on silence → transcribe → fill the input. No verification card.
 */
export function VoiceSearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search a patient…',
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { state, start } = useDictation<{ transcript: string }>('/dictate/transcribe', (data) =>
    onChange(normalizeForSearch(data.transcript)),
  );
  const busy = state.kind === 'recording' || state.kind === 'processing';

  return (
    <div className="flex h-12 items-center gap-2 rounded-pill bg-paper-warm px-4 shadow-elev-1">
      <Search className="size-5 shrink-0 text-text-subtle" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.(value);
        }}
        placeholder={state.kind === 'recording' ? 'Listening…' : placeholder}
        className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-text-subtle"
        aria-label={placeholder}
      />
      <button
        type="button"
        onClick={() => !busy && void start()}
        disabled={busy}
        aria-label={busy ? 'Listening' : 'Search by voice'}
        className={cn(
          'flex size-9 items-center justify-center rounded-pill transition-colors',
          busy ? 'animate-pulse bg-ink text-lime' : 'bg-lime text-ink shadow-lime-glow',
        )}
      >
        <Mic className="size-4" />
      </button>
    </div>
  );
}
