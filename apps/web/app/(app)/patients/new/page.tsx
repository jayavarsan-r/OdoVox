'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, RefreshCw, Mic, Square } from 'lucide-react';
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
import { useDictation } from '@/lib/voice/use-dictation';
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

  // Stub swap (Phase 3): "Speak patient details" → real intake extraction. Prefills the form,
  // which is itself the review surface — the doctor edits any field before Create.
  const intake = useDictation<{
    intake: {
      name: string | null;
      phone: string | null;
      age: number | null;
      gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
      medicalFlags: string[];
    };
  }>('/patients/intake/dictate', ({ intake: i }) => {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    if (i.name) setValue('name', i.name, opts);
    if (i.phone) setValue('phone', i.phone, opts);
    if (i.age) setValue('age', i.age, opts);
    if (i.gender) setValue('gender', i.gender, opts);
    if (i.medicalFlags.length) setValue('medicalFlags', i.medicalFlags, opts);
    toast.info('Filled from your voice — review and edit before saving.');
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const patient = await createPatient.mutateAsync({ ...values, patientCode: code });
      toast.success('Patient created.');
      router.replace(`/patients/${patient.id}`);
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

          {/* Speak hero — single-shot intake dictation (Phase 3) */}
          <HeroCard
            variant="dark"
            icon={<Mic />}
            title={intake.state.kind === 'recording' ? 'Listening…' : intake.state.kind === 'processing' ? 'Processing…' : 'Speak patient details'}
            subtitle={
              intake.state.kind === 'recording'
                ? 'Tap Stop when you’re done'
                : intake.state.kind === 'processing'
                  ? 'Filling the form…'
                  : 'Name · phone · age · complaint'
            }
            onClick={() => intake.state.kind === 'idle' && void intake.start()}
          />
          {intake.state.kind === 'recording' && (
            <button
              type="button"
              onClick={() => intake.stop()}
              className="flex w-full items-center justify-center gap-2 rounded-pill bg-ink py-3 text-sm font-semibold text-paper"
            >
              <Square className="size-4 fill-current" /> Stop recording
            </button>
          )}

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
                <Select defaultValue="" {...register('bloodGroup')}>
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
    </AnimatedPage>
  );
}
