import type { PatientStatus } from '@odovox/types';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'PT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export interface StatusStyle {
  bar: string; // left edge bar bg
  avatar: string; // avatar bg + text
  label: string;
}

export function statusStyle(status: PatientStatus): StatusStyle {
  switch (status) {
    case 'IN_CHAIR':
      return { bar: 'bg-lime', avatar: 'bg-lime text-ink', label: 'In chair' };
    case 'DUE_PAYMENT':
      return { bar: 'bg-peach', avatar: 'bg-peach text-ink', label: 'Due' };
    case 'LAB_PENDING':
      return { bar: 'bg-sky', avatar: 'bg-sky text-ink', label: 'Lab' };
    case 'NEW':
      return { bar: 'bg-border-strong', avatar: 'bg-paper-warm text-ink', label: 'New' };
    case 'INACTIVE':
      return { bar: 'bg-border', avatar: 'bg-paper-warm text-text-subtle', label: 'Inactive' };
    default:
      return { bar: 'bg-border-strong', avatar: 'bg-paper-warm text-ink', label: 'Active' };
  }
}

export const rupees = (paise: number): string => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
