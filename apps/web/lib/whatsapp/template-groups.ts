/**
 * Frame 72 groups WhatsApp templates into the four things a clinic owner actually decides.
 *
 * The settings screen listed the raw template keys — `appointment_reminder_1h`,
 * `outstanding_balance_reminder` — which are Meta's identifiers, not decisions. A dentist
 * choosing whether to nag patients about money should not have to know that the nag is
 * called `outstanding_balance_reminder`, nor that "remind them about their appointment" is
 * two separate approved templates that both have to be on.
 *
 * So the screen shows GROUPS: one switch per intent, with the timing it implies as a quiet
 * hint ("24h + 1h"). Toggling a group toggles every template in it, which is what the switch
 * appeared to promise anyway.
 *
 * The mapping is by key prefix rather than a hardcoded list, so a new approved template
 * lands in the right group without a code change — and anything unrecognised gets its own
 * group under its own key rather than disappearing, because a template nobody can see is a
 * message nobody knows is being sent.
 */

export interface TemplateLike {
  templateKey: string;
  isEnabled: boolean;
}

export interface TemplateGroup {
  id: string;
  label: string;
  /** The quiet right-aligned hint, e.g. "24h + 1h". Absent when it would add nothing. */
  hint?: string;
  /** Every template key this switch controls. */
  keys: string[];
  /** On when ANY member is on — so a half-on group reads as on, and one tap turns it off. */
  enabled: boolean;
}

const GROUPS: { id: string; label: string; match: (key: string) => boolean }[] = [
  {
    id: 'appointments',
    label: 'Appointment reminders',
    match: (k) => k.startsWith('appointment_'),
  },
  { id: 'lab', label: 'Lab updates to patients', match: (k) => k.startsWith('lab_') },
  {
    id: 'payments',
    label: 'Payment reminders',
    match: (k) => k.startsWith('payment_') || k.startsWith('outstanding_') || k.startsWith('bill_'),
  },
  {
    id: 'prescriptions',
    label: 'Prescription ready',
    match: (k) => k.startsWith('prescription_'),
  },
];

/** "appointment_reminder_24h" → "24h". Null when the key carries no timing. */
export function timingOf(templateKey: string): string | null {
  const m = templateKey.match(/_(\d+)(h|d)$/i);
  if (!m) return null;
  return `${m[1]}${m[2]!.toLowerCase()}`;
}

/** A readable label for a key nothing recognises: "review_request" → "Review request". */
function humanise(templateKey: string): string {
  const words = templateKey.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Sort the timings the way a person reads them — longest lead time first, so appointment
 * reminders read "24h + 1h" rather than "1h + 24h". Hours and days are compared in hours.
 */
function byLeadTime(a: string, b: string): number {
  const hours = (t: string) => {
    const n = Number(t.slice(0, -1));
    return t.endsWith('d') ? n * 24 : n;
  };
  return hours(b) - hours(a);
}

export function templateGroups(templates: TemplateLike[]): TemplateGroup[] {
  const out: TemplateGroup[] = [];

  for (const g of GROUPS) {
    const members = templates.filter((t) => g.match(t.templateKey));
    if (members.length === 0) continue;

    const timings = members
      .map((t) => timingOf(t.templateKey))
      .filter((t): t is string => t !== null)
      .sort(byLeadTime);

    out.push({
      id: g.id,
      label: g.label,
      // One timing is not a comparison and reads as noise beside a single switch.
      hint: timings.length > 1 ? timings.join(' + ') : undefined,
      keys: members.map((t) => t.templateKey),
      enabled: members.some((t) => t.isEnabled),
    });
  }

  // Anything the prefixes do not claim keeps its own row. Silently dropping it would hide a
  // message the clinic is sending to its patients.
  const claimed = new Set(out.flatMap((g) => g.keys));
  for (const t of templates) {
    if (claimed.has(t.templateKey)) continue;
    out.push({
      id: t.templateKey,
      label: humanise(t.templateKey),
      keys: [t.templateKey],
      enabled: t.isEnabled,
    });
  }

  return out;
}

/**
 * Mask a business phone number for display: "+918000000000" → "+91 80····0000".
 *
 * Frame 72 shows it masked, and it is right to. This screen is readable by any clinic role
 * and is often the one on screen when a rep is being shown around; the number identifies the
 * clinic's WhatsApp Business account, and the full value serves no purpose here — the
 * question this card answers is "are we connected", not "what is the number".
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 6) return phone;
  const cc = phone.trim().startsWith('+') ? `+${digits.slice(0, 2)} ` : '';
  const body = cc ? digits.slice(2) : digits;
  return `${cc}${body.slice(0, 2)}····${body.slice(-4)}`;
}

export interface CostPoint {
  year: number;
  month: number;
  totalCostPaise: number;
}

/**
 * Pad the cost history to a fixed six-month axis ending at `now`.
 *
 * The chart plotted whatever the API returned, so a clinic in its first month got ONE bar
 * stretched across the full width — a single data point drawn as if it were a trend. Frame 72
 * shows six labelled months whether or not each has spend, which is the honest shape: it says
 * "this is six months" and lets the empty ones read as empty.
 *
 * Months with no billed conversations come back as zero rather than being skipped, so the
 * axis stays evenly spaced and a gap is visible as a gap.
 */
export function lastSixMonths(history: CostPoint[], now = new Date()): CostPoint[] {
  const found = new Map(history.map((c) => [`${c.year}-${c.month}`, c.totalCostPaise]));
  const out: CostPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    out.push({ year, month, totalCostPaise: found.get(`${year}-${month}`) ?? 0 });
  }
  return out;
}
