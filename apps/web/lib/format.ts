/**
 * Phase 9.7 §3.3 — the canonical display formats. One place, used everywhere:
 *   Currency  ₹1,500 · Indian lakhs/crores grouping from ₹1,00,000 up
 *   Time      hh:mm AM/PM, always
 *   Date      "Mon 23 Jun" when near (±6 months), "23 Jun 2026" when far
 * The per-domain rupees() helpers delegate here.
 */

const INR = new Intl.NumberFormat('en-IN'); // en-IN groups 1,00,000 (lakhs) natively

export function formatINR(paise: number | null | undefined): string {
  if (paise == null) return '—';
  return `₹${INR.format(Math.round(paise / 100))}`;
}

export function formatTime(d: Date | string, timeZone = 'Asia/Kolkata'): string {
  return new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone }).toUpperCase();
}

const NEAR_MS = 183 * 24 * 60 * 60 * 1000; // ~6 months

export function formatDate(d: Date | string, now: Date = new Date(), timeZone = 'Asia/Kolkata'): string {
  const date = new Date(d);
  const near = Math.abs(date.getTime() - now.getTime()) < NEAR_MS;
  return near
    ? date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone })
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone });
}
