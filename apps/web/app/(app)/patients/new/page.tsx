'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, RefreshCw, Mic } from 'lucide-react';
import { CreatePatientInput } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { HeroCard } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/forms/FormField';
import { Select } from '@/components/forms/Select';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { ChipMultiSelect } from '@/components/forms/ChipMultiSelect';
import { useToast } from '@/lib/toast';
import { useCreatePatient } from '@/lib/queries';
import { VoiceInput } from '@/components/voice/voice-input';
import { AddToQueueSheet } from '@/components/queue/add-to-queue-sheet';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const GENDERS = [
  { label: 'M', value: 'MALE' },
  { label: 'F', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
] as const;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const FLAGS = ['Blood thinner', 'Diabetes', 'Heart condition', 'Pregnant', 'Hypertension', 'Asthma'].map(
  (f) => ({ label: f, value: f }),
);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () =>
  'PT-' + Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

type FormValues = CreatePatientInput;

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

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    // CreatePatientInput's medicalFlags has a Zod default → input/output types diverge; the
    // cast aligns the resolver, and defaultValues keep medicalFlags defined.
    resolver: zodResolver(CreatePatientInput) as unknown as Resolver<FormValues>,
    mode: 'onChange',
    defaultValues: { name: '', phone: '', age: 0, gender: 'MALE', medicalFlags: [] },
  });

  // Home voice command "new patient …" routes here with ?voice=1 → start listening immediately.
  const searchParams = useSearchParams();
  const voiceParam = searchParams.get('voice') === '1';
  // "+ walk-in" entry (?walkin=1/true) — force the add-to-queue step even for doctors' view.
  const walkinParam = searchParams.get('walkin') === '1' || searchParams.get('walkin') === 'true';
  const offerQueue = walkinParam || role === 'RECEPTIONIST' || role === 'ADMIN';

  // "Speak patient details" → intake extraction prefills the form, which is itself the review
  // surface — the doctor edits any field before Create.
  const onIntake = ({ intake: i }: {
    intake: {
      name: string | null;
      phone: string | null;
      age: number | null;
      gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
      medicalFlags: string[];
    };
  }) => {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    if (i.name) setValue('name', i.name, opts);
    if (i.phone) setValue('phone', i.phone, opts);
    if (i.age) setValue('age', i.age, opts);
    if (i.gender) setValue('gender', i.gender, opts);
    if (i.medicalFlags.length) setValue('medicalFlags', i.medicalFlags, opts);
    toast.info('Filled from your voice — review and edit before saving.');
  };

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
      <header className="flex items-center justify-between px-5 pt-4">
        <h1 className="text-xl font-semibold tracking-tight">New patient</h1>
        <button type="button" aria-label="Close" onClick={() => router.back()} className="flex size-9 items-center justify-center rounded-pill hover:bg-muted">
          <X className="size-5" />
        </button>
      </header>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="space-y-4 px-5 pb-28 pt-3">
          {/* Patient code chip */}
          <div className="flex items-center gap-2">
            <span className="rounded-pill bg-lime-soft px-3 py-1 font-mono text-sm font-semibold text-ink">{code}</span>
            <button type="button" aria-label="Regenerate code" onClick={() => setCode(genCode())} className="flex size-8 items-center justify-center rounded-pill hover:bg-muted">
              <RefreshCw className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Speak hero — intake dictation via the shared <VoiceInput> (Phase 9.7 W1.1) */}
          <HeroCard
            variant="dark"
            icon={<Mic />}
            title="Speak patient details"
            subtitle="Name · phone · age · complaint"
          >
            <VoiceInput
              mode="extraction"
              endpoint="/patients/intake/dictate"
              placement="sheet"
              label="Speak patient details"
              hint="Tap Stop when you’re done"
              autoStart={voiceParam}
              onExtraction={onIntake}
              className="mt-3"
            />
          </HeroCard>

          {/* Identity */}
          <div className="space-y-4 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <FormField label="Full name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" placeholder="Patient name" {...register('name')} />
            </FormField>

            <FormField label="Phone number" required error={errors.phone?.message}>
              <Controller control={control} name="phone" render={({ field }) => (
                <PhoneInput value={field.value} onChange={field.onChange} invalid={!!errors.phone} />
              )} />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Age" htmlFor="age" required error={errors.age?.message}>
                <Input id="age" type="number" inputMode="numeric" {...register('age', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Blood group" error={errors.bloodGroup?.message}>
                {/* '' (untouched select) fails the BloodGroup enum and used to block Create —
                    coerce to undefined so an empty pick never invalidates the form (Issue 3). */}
                <Select defaultValue="" {...register('bloodGroup', { setValueAs: (v) => (v === '' ? undefined : v) })}>
                  <option value="">—</option>
                  {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </FormField>
            </div>

            <FormField label="Gender" required error={errors.gender?.message}>
              <Controller control={control} name="gender" render={({ field }) => (
                <div className="flex gap-2">
                  {GENDERS.map((g) => (
                    <button key={g.value} type="button" onClick={() => field.onChange(g.value)} className={cn(
                      'flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors',
                      field.value === g.value ? 'border-ink bg-ink text-paper' : 'border-border bg-surface',
                    )}>{g.label}</button>
                  ))}
                </div>
              )} />
            </FormField>
          </div>

          {/* Address & complaint */}
          <div className="space-y-4 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <FormField label="Address" htmlFor="address" hint="Encrypted at rest." error={errors.address?.message}>
              <Input id="address" placeholder="Area, city" {...register('address')} />
            </FormField>

            <FormField label="Chief complaint" htmlFor="chiefComplaint" error={errors.chiefComplaint?.message}>
              <Input id="chiefComplaint" placeholder="What brings the patient in?" {...register('chiefComplaint')} />
            </FormField>
          </div>

          {/* Medical flags & allergies */}
          <div className="space-y-4 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <FormField label="Medical flags">
              <Controller control={control} name="medicalFlags" render={({ field }) => (
                <ChipMultiSelect options={FLAGS} selected={field.value ?? []} onChange={field.onChange} />
              )} />
            </FormField>

            <FormField label="Allergies" htmlFor="allergies" hint="Encrypted at rest." error={errors.allergies?.message}>
              <Input id="allergies" placeholder="e.g. Penicillin, Latex" {...register('allergies')} />
            </FormField>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-border bg-background/90 px-5 py-3 backdrop-blur" style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}>
          <Button type="submit" size="lg" className="w-full" disabled={!isValid} loading={createPatient.isPending}>
            Create patient · {code}
          </Button>
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
