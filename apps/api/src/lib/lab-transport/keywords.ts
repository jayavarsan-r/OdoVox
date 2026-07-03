import type { LabCaseStatus } from '@odovox/types';
import { CASE_CODE_RE } from '../lab/case-code.js';

/**
 * Phase 9.7 §2.9 tier 2 — case code + keyword parsing. Deterministic, per-language, and strict:
 * exactly ONE status may match, or the message falls through to the next tier. Labs text in
 * English, Tamil (incl. romanized "aachu"), and Hindi (incl. "ho gaya").
 */

type KeywordTable = Partial<Record<LabCaseStatus, RegExp>>;

const KEYWORDS: Record<'en' | 'ta' | 'hi', KeywordTable> = {
  en: {
    READY: /\b(ready|done|complete|completed|finish|finished)\b/i,
    IN_PROGRESS: /\b(working|start|starting|started|in progress|received impression)\b/i,
    ISSUE_RAISED: /\b(problem|issue|remake|error|broken|break|damage|damaged|crack|cracked)\b/i,
    DISPATCHED: /\b(sent|dispatch|dispatched|shipping|shipped|courier|pickup|on the way)\b/i,
    ACKNOWLEDGED: /\b(received|got it|noted|ok(?:ay)? (?:received|got))\b/i,
  },
  ta: {
    READY: /(முடிந்தது|ரெடி|ஆச்சு|aachu|mudinchu|mudinthathu|redi)/i,
    IN_PROGRESS: /(ஆரம்பம்|வேலை நடக்குது|பண்ணிட்டு இருக்கோம்|aarambam|pannitu irukkom)/i,
    ISSUE_RAISED: /(பிரச்சனை|உடைஞ்சது|problem|prachanai|odanjuthu)/i,
    DISPATCHED: /(அனுப்பிட்டோம்|கிளம்பிச்சு|anupitom|kilambichchu)/i,
    ACKNOWLEDGED: /(கிடைத்தது|வந்தது|kedaichathu|vanthathu)/i,
  },
  hi: {
    READY: /(तैयार|हो गया|ho gaya|taiyar|ready)/i,
    IN_PROGRESS: /(काम चालू|शुरू|shuru|kaam chalu)/i,
    ISSUE_RAISED: /(समस्या|टूट|problem|samasya|toot gaya)/i,
    DISPATCHED: /(भेज दिया|bhej diya|courier)/i,
    ACKNOWLEDGED: /(मिल गया|mil gaya)/i,
  },
};

export interface KeywordMatch {
  status: LabCaseStatus;
  language: 'en' | 'ta' | 'hi';
}

/**
 * One clear status across all languages, or null. Two DIFFERENT statuses matching means the
 * message is ambiguous ("started but there's a problem") — tiers 3/4 handle it.
 */
export function matchStatusKeyword(text: string): KeywordMatch | null {
  const hits = new Map<LabCaseStatus, KeywordMatch>();
  for (const language of ['en', 'ta', 'hi'] as const) {
    for (const [status, re] of Object.entries(KEYWORDS[language]) as Array<[LabCaseStatus, RegExp]>) {
      if (re.test(text) && !hits.has(status)) hits.set(status, { status, language });
    }
  }
  // ISSUE keywords dominate: "crown broke while finishing" is an issue, not READY.
  if (hits.has('ISSUE_RAISED') && hits.size <= 2) return hits.get('ISSUE_RAISED')!;
  if (hits.size === 1) return [...hits.values()][0]!;
  return null;
}

/** Extract the first case code (DK-0042) from a message, uppercased. */
export function extractCaseCode(text: string): string | null {
  const m = text.toUpperCase().match(CASE_CODE_RE);
  return m ? m[0] : null;
}

/** YES/NO consent replies (T-consent text fallback when the lab types instead of tapping). */
export function matchConsentReply(text: string): 'yes' | 'no' | null {
  const t = text.trim().toLowerCase();
  if (/^(yes|ok(?:ay)?|confirm(?:ed)?|sure|ஆம்|சரி|haan|हाँ|ஓகே)\b/i.test(t)) return 'yes';
  if (/^(no|stop|don'?t|வேண்டாம்|nahi|नहीं)\b/i.test(t)) return 'no';
  return null;
}
