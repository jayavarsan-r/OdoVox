'use client';

import { Check, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One label/value line of the verification card, with an optional inline editor beneath.
 *
 * `invalid` is the red state: a field carrying an unresolved BLOCKING safety warning. It
 * is deliberately loud — the card cannot be confirmed while one is showing, so a doctor
 * must be able to find it without hunting.
 */
export function FieldRow({
  label,
  value,
  confirmed,
  invalid,
  onEdit,
  children,
}: {
  label: string;
  value: string;
  confirmed?: boolean;
  invalid?: boolean;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'border-b border-border/60 py-3 last:border-0',
        invalid && 'rounded-xl border border-danger/40 bg-danger/5 px-3',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-[13px] text-text-muted">{label}</span>
        <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', invalid ? 'text-danger' : 'text-ink')}>
          {value}
        </span>
        {confirmed ? <Check className="size-4 text-sage-deep" /> : null}
        {onEdit ? (
          <button type="button" onClick={onEdit} aria-label={`Edit ${label}`} className="text-text-subtle">
            <Pencil className="size-4" />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** The inline editor input, shared by every row that edits a single value. */
export const FIELD_INPUT = 'mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm';
/** The narrow variant, for numbers that should not span the card. */
export const FIELD_INPUT_SM = 'w-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm';
