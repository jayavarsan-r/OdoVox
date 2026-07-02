'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { VoiceInput } from '@/components/voice/voice-input';
import { normalizeForSearch } from '@/lib/voice/single-shot';

/**
 * Search pill with a Sarvam-backed single-shot mic (Phase 9.7: migrated to the shared
 * <VoiceInput>). Record → auto-stop on silence → transcribe → fill the input. No verification card.
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
  const [listening, setListening] = useState(false);

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
        placeholder={listening ? 'Listening…' : placeholder}
        className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-text-subtle"
        aria-label={placeholder}
      />
      <VoiceInput
        mode="single-shot"
        size="sm"
        label="Search by voice"
        onTranscript={(t) => onChange(normalizeForSearch(t))}
        onStateChange={(kind) => setListening(kind === 'recording')}
      />
    </div>
  );
}
