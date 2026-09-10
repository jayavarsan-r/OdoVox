import type { CreatePatientInput } from '@odovox/types';

/**
 * Which required fields are still empty, in the order the form asks for them.
 *
 * Frame 35 puts a static line under a disabled CTA: "Name + phone unlock the button ·
 * everything else can wait". That is not true here — the API requires name, phone, age AND
 * gender, so a button enabled on name + phone would let the receptionist tap Create and
 * collect a validation error instead. Global Constraint 1 says a disabled CTA always says
 * WHY; the honest version of that names what is actually missing, and shrinks as they fill
 * the form in.
 */
export function missingRequired(v: Partial<CreatePatientInput>): string[] {
  const out: string[] = [];
  if (!v.name?.trim()) out.push('name');
  // A 10-digit Indian mobile. Anything shorter is still being typed, not missing.
  if (!v.phone || String(v.phone).replace(/\D/g, '').replace(/^91/, '').length < 10) out.push('phone');
  if (v.age == null || Number.isNaN(v.age)) out.push('age');
  if (!v.gender) out.push('gender');
  return out;
}

/** "Name and phone still needed" · "Age still needed" · "" when nothing is. */
export function ctaHint(missing: string[]): string {
  if (missing.length === 0) return 'Everything else can wait — you can fill it in later';
  const list =
    missing.length === 1
      ? missing[0]!
      : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]!}`;
  return `${list[0]!.toUpperCase()}${list.slice(1)} still needed`;
}
