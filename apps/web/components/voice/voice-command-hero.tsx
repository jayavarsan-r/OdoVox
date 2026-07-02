'use client';

import { useRouter } from 'next/navigation';
import { Mic } from 'lucide-react';
import { HeroCard } from '@/components/ds';
import { VoiceInput } from '@/components/voice/voice-input';
import { routeVoiceCommand } from '@/lib/voice/intent-router';
import { useToast } from '@/lib/toast';

const EXAMPLES = ['“Start consultation for…”', '“Book cleaning next Monday…”', '“Add 100 gloves to inventory…”'];

/**
 * Doctor Home voice hero (Phase 9.7 W1.3): speak a command, the intent router opens the right
 * surface. Unclear commands land in patient search with the transcript — never a dead end.
 */
export function VoiceCommandHero() {
  const router = useRouter();
  const toast = useToast();

  return (
    <HeroCard variant="light" glow="lime" icon={<Mic />} title="Speak to Odovox" subtitle="One command, straight to the right screen">
      <span className="mt-2 block space-y-0.5">
        {EXAMPLES.map((e) => (
          <span key={e} className="block truncate text-[13px] text-text-muted">
            {e}
          </span>
        ))}
      </span>
      <VoiceInput
        mode="single-shot"
        placement="sheet"
        label="Long-press to speak"
        hint="consult · book · inventory · patient"
        onTranscript={(t) => {
          if (!t) return;
          const route = routeVoiceCommand(t);
          if (route.intent === 'unclear') toast.info(`Searching for “${route.query}”…`);
          router.push(route.href);
        }}
        className="mt-3"
      />
    </HeroCard>
  );
}
