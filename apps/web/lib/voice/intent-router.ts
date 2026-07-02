/**
 * Home voice-command routing (Phase 9.7 W1.3). Classifies a spoken command by its leading verb and
 * returns the route to open. Deliberately dumb-and-deterministic — no LLM: the transcript is already
 * text, and a first-word table is predictable, instant, and testable. Anything unclear falls back to
 * the patient search with the raw transcript, so a command never dead-ends.
 */

export type VoiceIntent =
  | 'consult'
  | 'book'
  | 'inventory-purchase'
  | 'inventory-consume'
  | 'new-patient'
  | 'search'
  | 'unclear';

export interface VoiceCommandRoute {
  intent: VoiceIntent;
  href: string;
  /** The residual query (verb stripped) that the destination can prefill from. */
  query: string;
}

/** Strip the matched leading phrase + filler words ("for", "a", "an", "the") from the front. */
function residual(transcript: string, matched: RegExp): string {
  return transcript
    .replace(matched, '')
    .replace(/^\s*(for|a|an|the)\s+/i, '')
    .trim()
    .replace(/[.?!,;\s]+$/, '');
}

const RULES: Array<{ intent: VoiceIntent; match: RegExp; href: (q: string) => string }> = [
  {
    intent: 'consult',
    match: /^\s*(start|begin)\s+(a\s+)?consult(ation)?\b|^\s*record\s+(my\s+)?findings\b/i,
    href: (q) => (q ? `/consult?patient=${encodeURIComponent(q)}` : '/consult'),
  },
  {
    intent: 'new-patient',
    match: /^\s*new\s+patient\b/i,
    href: () => '/patients/new?voice=1',
  },
  {
    intent: 'book',
    match: /^\s*(book|schedule)\b/i,
    href: (q) => `/schedule?dictate=1${q ? `&q=${encodeURIComponent(q)}` : ''}`,
  },
  {
    intent: 'inventory-purchase',
    match: /^\s*(add|bought|received|purchased?)\b/i,
    href: (q) => `/inventory?dictate=purchase${q ? `&q=${encodeURIComponent(q)}` : ''}`,
  },
  {
    intent: 'inventory-consume',
    match: /^\s*(used|consumed?)\b/i,
    href: (q) => `/inventory?dictate=consume${q ? `&q=${encodeURIComponent(q)}` : ''}`,
  },
  {
    intent: 'search',
    match: /^\s*(search|find|show)\b/i,
    href: (q) => `/patients${q ? `?search=${encodeURIComponent(q)}` : ''}`,
  },
];

export function routeVoiceCommand(transcript: string): VoiceCommandRoute {
  const text = transcript.trim();
  for (const rule of RULES) {
    if (rule.match.test(text)) {
      const query = residual(text, rule.match);
      return { intent: rule.intent, href: rule.href(query), query };
    }
  }
  // Unclear → the transcript becomes a patient search, never a dead end.
  const query = text.replace(/[.?!,;\s]+$/, '');
  return { intent: 'unclear', href: query ? `/patients?search=${encodeURIComponent(query)}` : '/patients', query };
}
