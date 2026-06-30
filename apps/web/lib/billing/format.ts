import type { BillStatus, DailyCollectionResponse, PaymentMethod } from '@odovox/types';

/** Money at the display boundary only — paise → ₹X.XX (Indian grouping). */
export function rupees(paise: number | null | undefined): string {
  if (paise == null) return '—';
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Compact ₹ for stat tiles: ₹14.5k, ₹2.3L, ₹980. */
export function rupeesCompact(paise: number): string {
  const r = paise / 100;
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(1)}Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)}L`;
  if (r >= 1e3) return `₹${(r / 1e3).toFixed(1)}k`;
  return `₹${Math.round(r)}`;
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI_MANUAL: 'UPI',
  CARD_MANUAL: 'Card',
  BANK_TRANSFER: 'Bank',
  RAZORPAY: 'Razorpay link',
  ADJUSTMENT: 'Adjustment',
};

/** Methods a receptionist picks in the checkout sheet (Adjustment is admin-only, elsewhere). */
export const CHECKOUT_METHODS: PaymentMethod[] = ['CASH', 'UPI_MANUAL', 'CARD_MANUAL', 'RAZORPAY'];

export function methodLabel(m: PaymentMethod): string {
  return PAYMENT_METHOD_LABEL[m];
}

export interface BillStatusStyle {
  pill: string;
  label: string;
}
/** Status pill colours (design-system §4). */
export function billStatusStyle(status: BillStatus): BillStatusStyle {
  switch (status) {
    case 'DRAFT':
      return { pill: 'bg-paper-warm text-text-subtle', label: 'Draft' };
    case 'FINALIZED':
      return { pill: 'bg-sky-soft text-ink', label: 'Unpaid' };
    case 'PARTIAL':
      return { pill: 'bg-peach-soft text-ink', label: 'Partial' };
    case 'PAID':
      return { pill: 'bg-lime-soft text-ink', label: 'Paid' };
    case 'REFUNDED':
      return { pill: 'bg-lavender-soft text-ink', label: 'Refunded' };
    case 'CANCELLED':
      return { pill: 'bg-paper-warm text-text-subtle line-through', label: 'Cancelled' };
  }
}

const NON_CASH: PaymentMethod[] = ['UPI_MANUAL', 'CARD_MANUAL', 'BANK_TRANSFER', 'RAZORPAY'];

export interface StatTileData {
  value: string;
  label: string;
  variant: 'lime' | 'sage' | 'default' | 'warning';
}

/**
 * The four /today stat tiles: today's collection (big), cash, online (everything non-cash), and the
 * count of patients pending checkout (from the queue, not the collection report).
 */
export function collectionStatTiles(c: DailyCollectionResponse, pendingCount: number): StatTileData[] {
  const cash = c.byMethod.CASH ?? 0;
  const online = NON_CASH.reduce((s, m) => s + (c.byMethod[m] ?? 0), 0);
  return [
    { value: rupeesCompact(c.totalCollectedPaise), label: 'Collected', variant: 'lime' },
    { value: rupeesCompact(cash), label: 'Cash', variant: 'sage' },
    { value: rupeesCompact(online), label: 'Online', variant: 'default' },
    { value: String(pendingCount), label: 'Pending', variant: pendingCount > 0 ? 'warning' : 'default' },
  ];
}

/** A bill line's subtotal — mirrors the server (computeLineSubtotal); used for live edit previews. */
export function lineSubtotalPaise(item: { quantity: number; unitPricePaise: number; discountPaise?: number }): number {
  return Math.max(0, item.quantity * item.unitPricePaise - (item.discountPaise ?? 0));
}

/** Sum of line subtotals for a draft-edit preview (server is the source of truth on save). */
export function draftSubtotalPaise(items: { quantity: number; unitPricePaise: number; discountPaise?: number }[]): number {
  return items.reduce((s, i) => s + lineSubtotalPaise(i), 0);
}

/** Checkout sheet step from the bill status: edit items, take payment, or done. */
export function checkoutStep(status: BillStatus): 'edit' | 'pay' | 'done' {
  if (status === 'DRAFT') return 'edit';
  if (status === 'PAID' || status === 'REFUNDED' || status === 'CANCELLED') return 'done';
  return 'pay';
}

export function canAddPayment(status: BillStatus): boolean {
  return status === 'FINALIZED' || status === 'PARTIAL';
}

/** Refunds are admin-only and need a payment to refund. */
export function canRefund(bill: { paidPaise: number }, isAdmin: boolean): boolean {
  return isAdmin && bill.paidPaise > 0;
}

/** wa.me deep link (digits only) with a prefilled message — same pattern as Phase 7 lab vendor. */
export function waMeLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function daysSince(date: Date | string, now: Date = new Date()): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

/** Outstanding patients sorted oldest-first (longest overdue at the top). */
export function sortOutstanding<T extends { oldestBillDate: Date | string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => new Date(a.oldestBillDate).getTime() - new Date(b.oldestBillDate).getTime());
}

/** CSV for the daily-collection export (Phase 8 keeps it basic; Phase 10 polishes). */
export function collectionCsv(rows: { time: string; patient: string; amountPaise: number; method: PaymentMethod; doctor: string }[]): string {
  const header = 'Time,Patient,Amount,Method,Doctor';
  const body = rows.map((r) => `${r.time},${escapeCsv(r.patient)},${(r.amountPaise / 100).toFixed(2)},${methodLabel(r.method)},${escapeCsv(r.doctor)}`);
  return [header, ...body].join('\n');
}

function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
