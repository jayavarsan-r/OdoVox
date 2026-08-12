'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronLeft, RefreshCw, Mic } from 'lucide-react';
import { CreatePatientInput } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { IconCircle, Segmented } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ctaHint, missingRequired } from '@/lib/patients/new-patient-form';
import { Select } from '@/components/forms/Select';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { ChipMultiSelect } from '@/components/forms/ChipMultiSelect';
import { useToast } from '@/lib/toast';
import { useCreatePatient } from '@/lib/queries';
import { VoiceInput } from '@/components/voice/voice-input';
import { AddToQueueSheet } from '@/components/queue/add-to-queue-sheet';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const GENDERS: { label: string; value: 'MALE' | 'FEMALE' | 'OTHER' }[] = [
  { label: 'M', value: 'MALE' },
  { label: 'F', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const FLAGS = ['Blood thinner', 'Diabetes', 'Heart condition', 'Pregnant', 'Hypertension', 'Asthma'].map(
  (f) => ({ label: f, value: f }),
);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () =>
  'PT-' + Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

type FormValues = CreatePatientInput;

/**
 * A labelled form row. `.frm-lb`: 11px/800, tracking .06em, pine-3 — small and quiet, so
 * the eye lands on the value the receptionist is typing rather than the label they already
 * know. Errors sit under the field, in crit, and only after the field has been touched.
 */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-[7px] flex items-baseline gap-2">
        <span className="text-[11px] font-heavy uppercase tracking-[0.06em] text-pine-3">
          {label}
        </span>
        {hint ? <span className="text-3xs font-semibold text-pine-3">{hint}</span> : null}
      </span>
      {children}
      {error ? <p className="mt-1.5 text-3xs font-bold text-crit">{error}</p> : null}
    </div>
  );
}

export default function NewPatientPage() {
  const router = useRouter();
  const toast = useToast();
  const createPatient = useCreatePatient();
  const [code, setCode] = useState(genCode);
  // Phase 9.6 Issue 15: creation flows straight into the queue. Receptionists (and the walk-in
  // entry ?walkin=1) get an "Add to queue?" sheet after create; doctors keep the direct route
  // (POST /visits is reception-side — doctors queue via consultations).
  const role = useAuth((s) => s.activeMembership?.role);
  const [queueFor, setQueueFor] = useState<{ id: string; name: string; complaint: string | null } | null>(null);
  // Frame 36: fields that arrived by voice wear a lime spine, and it fades on first touch —
  // the form IS the review step, so the mark has to say "unreviewed", not "spoken".
  const [voiced, setVoiced] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    // CreatePatientInput's medicalFlags has a Zod default → input/output types diverge; the
    // cast aligns the resolver, and defaultValues keep medicalFlags defined.
    resolver: zodResolver(CreatePatientInput) as unknown as Resolver<FormValues>,
    mode: 'onChange',
    // No gender default: pre-selecting MALE answers a question the receptionist has not
    // been asked yet, and silently makes the "still needed" hint wrong. Age likewise —
    // 0 is a real age (infants are patients), so it cannot double as "unset".
    defaultValues: { name: '', phone: '', medicalFlags: [] },
  });

  // Home voice command "new patient …" routes here with ?voice=1 → start listening immediately.
  const searchParams = useSearchParams();
  const voiceParam = searchParams.get('voice') === '1';
  // "+ walk-in" entry (?walkin=1/true) — force the add-to-queue step even for doctors' view.
  const walkinParam = searchParams.get('walkin') === '1' || searchParams.get('walkin') === 'true';
  const offerQueue = walkinParam || role === 'RECEPTIONIST' || role === 'ADMIN';

  // "Speak patient details" → intake extraction prefills the form, which is itself the review
  // surface — the doctor edits any field before Create. Phase 9.6 Issue 2: chief complaint and
  // allergies come through too; flags not matching a known chip render as custom chips below.
  const onIntake = ({ intake: i }: {
    intake: {
      name: string | null;
      phone: string | null;
      age: number | null;
      gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
      chiefComplaint: string | null;
      medicalFlags: string[];
      allergies: string[];
    };
  }) => {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    const marked = new Set<string>();
    if (i.name) {
      setValue('name', i.name, opts);
      marked.add('name');
    }
    if (i.phone) {
      setValue('phone', i.phone, opts);
      marked.add('phone');
    }
    // `!= null`, not truthiness: age 0 is a real age, and an infant's record must not
    // silently lose it.
    if (i.age != null) {
      setValue('age', i.age, opts);
      marked.add('age');
    }
    if (i.gender) {
      setValue('gender', i.gender, opts);
      marked.add('gender');
    }
    if (i.chiefComplaint) {
      setValue('chiefComplaint', i.chiefComplaint, opts);
      marked.add('chiefComplaint');
    }
    if (i.medicalFlags.length) {
      setValue('medicalFlags', i.medicalFlags, opts);
      marked.add('medicalFlags');
    }
    if (i.allergies.length) {
      setValue('allergies', i.allergies.join(', '), opts);
      marked.add('allergies');
    }
    setVoiced(marked);

    // Nothing extracted means nothing was understood — a noisy room, a phone held wrong,
    // or a sentence the model could not parse. Saying "Filled from your voice" over an
    // untouched form tells the receptionist it worked and sends them to a Create button
    // that will reject them. Say what happened instead.
    if (marked.size === 0) {
      toast.info("Couldn't catch that — try again, or type the details in.");
      return;
    }

    // Anything spoken that lives under "More details" would otherwise be filed away
    // unreviewed behind a collapsed row — open it so the receptionist sees it.
    if (marked.has('chiefComplaint') || marked.has('allergies')) setMoreOpen(true);
    toast.info('Filled from your voice — review and edit before saving.');
  };

  // The spine marks a value as UNREVIEWED, so it clears the moment the receptionist edits
  // that field — touching it is the review.
  const clearVoiced = (field: string) =>
    setVoiced((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });

  const values = watch();
  const missing = missingRequired(values);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const patient = await createPatient.mutateAsync({ ...values, patientCode: code });
      toast.success('Patient created.');
      if (offerQueue) {
        setQueueFor({ id: patient.id, name: patient.name, complaint: values.chiefComplaint ?? null });
      } else {
        router.replace(`/patients/${patient.id}`);
      }
    } catch (err) {
      toast.apiError(err);
    }
  });

  return (
    <AnimatedPage className="flex flex-1 flex-col bg-paper-warm">
      {/* Frame 35: a back circle and the code in the title. The code is the patient's
          identity from the moment the form opens, so it belongs in the header rather than
          in a chip the receptionist has to look for. Regenerate stays available. */}
      <header className="flex items-center gap-3 px-gutter pt-2">
        <IconCircle size="md" tone="surface" aria-label="Back" onClick={() => router.back()}>
          <ChevronLeft />
        </IconCircle>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[15px] font-heavy text-pine">New patient · {code}</h1>
        </div>
        <IconCircle
          size="md"
          tone="surface"
          aria-label="Regenerate code"
          onClick={() => setCode(genCode())}
        >
          <RefreshCw />
        </IconCircle>
      </header>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="flex-1 space-y-[15px] px-gutter pb-4 pt-[13px]">
          {/* The blank state sells the voice path first — one sentence beats eleven
              fields, and the example line shows the receptionist it can be said the way
              they would say it out loud. */}
          <div className="relative overflow-hidden rounded-2xl bg-white p-[15px] shadow-elev-1">
            <span className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-lime-soft to-transparent" />
            <div className="relative flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-soft text-pine">
                <Mic className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-heavy tracking-snug text-pine">Say it in one breath</p>
                <p className="mt-[3px] text-[12.5px] font-semibold italic leading-[1.45] text-pine-2">
                  &ldquo;Ramesh Kumar, forty-two, diabetic, pain in lower left since Tuesday&rdquo;
                </p>
              </div>
            </div>
            <VoiceInput
              mode="extraction"
              endpoint="/patients/intake/dictate"
              placement="sheet"
              label="Speak patient details"
              hint="Tap Stop when you're done"
              autoStart={voiceParam}
              onExtraction={onIntake}
              className="relative mt-3"
            />
          </div>

          <Field label="NAME" error={errors.name?.message}>
            <Input
              id="name"
              placeholder="Full name"
              voiced={voiced.has('name')}
              invalid={!!errors.name}
              {...register('name', { onChange: () => clearVoiced('name') })}
            />
          </Field>

          {/* Age narrow beside phone — frame 35's proportions, and the one pairing that
              always gets filled together at a front desk. */}
          {/* `minmax(0,1fr)`, not `1fr`: a grid track's default min-width is `auto`, so a
              1fr column refuses to shrink below its content's intrinsic width and the phone
              field ran off the right edge of a 370px screen. Same trap as flex-1 without
              min-w-0, which the field itself also needed. */}
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-[11px]">
            <Field label="AGE" error={errors.age?.message}>
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                placeholder="—"
                voiced={voiced.has('age')}
                invalid={!!errors.age}
                {...register('age', { valueAsNumber: true, onChange: () => clearVoiced('age') })}
              />
            </Field>
            <Field label="PHONE" error={errors.phone?.message}>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    value={field.value}
                    onChange={(v) => {
                      clearVoiced('phone');
                      field.onChange(v);
                    }}
                    invalid={!!errors.phone}
                    voiced={voiced.has('phone')}
                  />
                )}
              />
            </Field>
          </div>

          <Field label="GENDER" error={errors.gender?.message}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Segmented
                  label="Gender"
                  options={GENDERS}
                  value={field.value}
                  onChange={(v) => {
                    clearVoiced('gender');
                    field.onChange(v);
                  }}
                />
              )}
            />
          </Field>

          <Field label="FLAGS">
            <Controller
              control={control}
              name="medicalFlags"
              render={({ field }) => (
                // Voice-extracted flags outside the standard list render as custom chips,
                // pre-selected — nothing the patient said gets silently dropped (Issue 2).
                <ChipMultiSelect
                  options={[
                    ...FLAGS,
                    ...(field.value ?? [])
                      .filter((v) => !FLAGS.some((f) => f.value === v))
                      .map((v) => ({ label: v, value: v })),
                  ]}
                  selected={field.value ?? []}
                  onChange={(v) => {
                    clearVoiced('medicalFlags');
                    field.onChange(v);
                  }}
                />
              )}
            />
          </Field>

          {/* Frame 36's collapsed "More details". Everything here is optional, and burying
              it is what lets the required four fit on one screen — but it is a disclosure,
              not a deletion: every field the form ever had is still in here. */}
          <div className="rounded-2xl bg-white shadow-elev-1">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="flex w-full items-center justify-between px-[15px] py-[13px]"
            >
              <span className="text-[13.5px] font-heavy text-pine">More details</span>
              <ChevronDown
                className={cn('size-4 text-pine-3 transition-transform', moreOpen && 'rotate-180')}
              />
            </button>
            {moreOpen ? (
              <div className="space-y-[15px] border-t border-hair px-[15px] pb-[15px] pt-[13px]">
                <Field label="CHIEF COMPLAINT" error={errors.chiefComplaint?.message}>
                  <Input
                    id="chiefComplaint"
                    placeholder="What brings the patient in?"
                    voiced={voiced.has('chiefComplaint')}
                    {...register('chiefComplaint', { onChange: () => clearVoiced('chiefComplaint') })}
                  />
                </Field>

                <Field label="ALLERGIES" hint="Encrypted at rest." error={errors.allergies?.message}>
                  <Input
                    id="allergies"
                    placeholder="e.g. Penicillin, Latex"
                    voiced={voiced.has('allergies')}
                    {...register('allergies', { onChange: () => clearVoiced('allergies') })}
                  />
                </Field>

                <Field label="BLOOD GROUP" error={errors.bloodGroup?.message}>
                  {/* '' (untouched select) fails the BloodGroup enum and used to block Create —
                      coerce to undefined so an empty pick never invalidates the form (Issue 3). */}
                  <Select
                    defaultValue=""
                    {...register('bloodGroup', { setValueAs: (v) => (v === '' ? undefined : v) })}
                  >
                    <option value="">—</option>
                    {BLOOD_GROUPS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="ADDRESS" hint="Encrypted at rest." error={errors.address?.message}>
                  <Input id="address" placeholder="Area, city" {...register('address')} />
                </Field>
              </div>
            ) : null}
          </div>
        </div>

        {/* Global Constraint 1: a disabled CTA always says why. Frame 35's static line
            claims name + phone are enough, but the API needs age and gender too — so the
            line names what is actually missing and shrinks as the form fills in. */}
        <div
          className="sticky bottom-0 bg-gradient-to-t from-paper-warm via-paper-warm to-transparent px-gutter pt-4"
          style={{ paddingBottom: 'calc(10px + var(--safe-bottom))' }}
        >
          <Button type="submit" size="lg" block disabled={!isValid} loading={createPatient.isPending}>
            Create patient
          </Button>
          <p className="mt-2.5 text-center text-[11.5px] font-semibold text-pine-3">
            {ctaHint(missing)}
          </p>
        </div>
      </form>

      <AddToQueueSheet
        open={!!queueFor}
        patient={queueFor}
        defaultComplaint={queueFor?.complaint}
        onDone={(added) => {
          const id = queueFor?.id;
          setQueueFor(null);
          router.replace(added ? '/today' : id ? `/patients/${id}` : '/patients');
        }}
      />
    </AnimatedPage>
  );
}
