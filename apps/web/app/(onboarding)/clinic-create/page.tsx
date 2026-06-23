'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ClinicCreateInput, INDIAN_STATES } from '@odovox/types';
import type { ClinicMemberResponse } from '@odovox/types';
import { MobileShell } from '@/components/mobile-shell';
import { BackHeader } from '@/components/onboarding/back-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FormField } from '@/components/forms/FormField';
import { Select } from '@/components/forms/Select';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { TimeInput } from '@/components/forms/TimeInput';
import { ChipMultiSelect } from '@/components/forms/ChipMultiSelect';
import { Stepper } from '@/components/forms/Stepper';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { useOnboarding } from '@/lib/onboarding-store';
import { useClinicResult } from '@/lib/clinic-result-store';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, value) => ({
  label,
  value,
}));
const SPECIALIZATIONS = [
  'General',
  'Endodontics',
  'Orthodontics',
  'Prosthodontics',
  'Periodontics',
  'Oral Surgery',
  'Pediatric Dentistry',
  'Oral Pathology',
  'Public Health',
].map((s) => ({ label: s, value: s }));
const QUALIFICATIONS = ['BDS', 'MDS', 'BDS + MDS', 'Other'];

type FormValues = ClinicCreateInput;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-subtle">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

export default function ClinicCreatePage() {
  const router = useRouter();
  const signupPhone = useAuth((s) => s.user?.phone) ?? useOnboarding.getState().phone ?? '';
  const setMembership = useAuth((s) => s.setMembership);
  const currentUser = useAuth((s) => s.user);
  const resetOnboarding = useOnboarding((s) => s.reset);
  const setResult = useClinicResult((s) => s.set);

  const [lunchEnabled, setLunchEnabled] = useState(false);
  const [qualMode, setQualMode] = useState<'preset' | 'other'>('preset');

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(ClinicCreateInput),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      addressLine: '',
      city: '',
      state: '',
      pincode: '',
      contactPhone: signupPhone,
      gstNumber: '',
      openingTime: '09:00',
      closingTime: '18:00',
      lunchStart: '13:00',
      lunchEnd: '14:00',
      weeklyOffDays: [0],
      chairsCount: 2,
      doctorName: '',
      qualification: 'BDS',
      registrationNumber: '',
      specialization: [],
    },
  });

  const chairs = watch('chairsCount');

  const onSubmit = handleSubmit(async (values) => {
    const payload: FormValues = { ...values };
    if (!lunchEnabled) {
      delete payload.lunchStart;
      delete payload.lunchEnd;
    }
    try {
      const data = await api.post<{
        clinic: { id: string; name: string; city: string; state: string };
        membership: ClinicMemberResponse;
        joinCode: string;
      }>('/clinics', payload);
      setMembership(data.membership, {
        id: data.clinic.id,
        name: data.clinic.name,
        city: data.clinic.city,
        state: data.clinic.state,
      });
      setResult({ clinicName: data.clinic.name, city: data.clinic.city, joinCode: data.joinCode });
      resetOnboarding();
      router.replace('/done');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the clinic.');
    }
  });

  return (
    <MobileShell>
      <BackHeader title="Create clinic" />
      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="space-y-4 px-5 pb-28 pt-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Set up your clinic</h1>
            <p className="mt-1 text-sm text-muted-foreground">A few details to get you running.</p>
          </div>

          {/* Section 1 — basics */}
          <SectionCard title="Clinic basics">
            <FormField label="Clinic name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" placeholder="Smile Dental Care" {...register('name')} />
            </FormField>
            <FormField label="Contact phone" required error={errors.contactPhone?.message}>
              <Controller
                control={control}
                name="contactPhone"
                render={({ field }) => (
                  <PhoneInput value={field.value ?? ''} onChange={field.onChange} invalid={!!errors.contactPhone} />
                )}
              />
            </FormField>
            <FormField label="Address" htmlFor="addressLine" required error={errors.addressLine?.message}>
              <Input id="addressLine" placeholder="12 MG Road, Indiranagar" {...register('addressLine')} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="City" htmlFor="city" required error={errors.city?.message}>
                <Input id="city" placeholder="Bengaluru" {...register('city')} />
              </FormField>
              <FormField label="State" required error={errors.state?.message}>
                <Select invalid={!!errors.state} defaultValue="" {...register('state')}>
                  <option value="" disabled>
                    Select
                  </option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Pincode" htmlFor="pincode" required error={errors.pincode?.message}>
                <Input id="pincode" inputMode="numeric" maxLength={6} placeholder="560001" {...register('pincode')} />
              </FormField>
              <FormField label="GST number" htmlFor="gstNumber" error={errors.gstNumber?.message}>
                <Input id="gstNumber" placeholder="Optional" {...register('gstNumber')} />
              </FormField>
            </div>
          </SectionCard>

          {/* Section 2 — hours */}
          <SectionCard title="Hours">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Opens at" error={errors.openingTime?.message}>
                <Controller
                  control={control}
                  name="openingTime"
                  render={({ field }) => <TimeInput value={field.value} onChange={field.onChange} />}
                />
              </FormField>
              <FormField label="Closes at" error={errors.closingTime?.message}>
                <Controller
                  control={control}
                  name="closingTime"
                  render={({ field }) => <TimeInput value={field.value} onChange={field.onChange} />}
                />
              </FormField>
            </div>

            <label className="flex items-center justify-between rounded-md border border-border bg-paper-warm px-3 py-2.5">
              <span className="text-sm font-medium">Lunch break</span>
              <input
                type="checkbox"
                checked={lunchEnabled}
                onChange={(e) => setLunchEnabled(e.target.checked)}
                className="size-4 accent-ink"
              />
            </label>
            {lunchEnabled ? (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Lunch start">
                  <Controller
                    control={control}
                    name="lunchStart"
                    render={({ field }) => <TimeInput value={field.value ?? '13:00'} onChange={field.onChange} />}
                  />
                </FormField>
                <FormField label="Lunch end">
                  <Controller
                    control={control}
                    name="lunchEnd"
                    render={({ field }) => <TimeInput value={field.value ?? '14:00'} onChange={field.onChange} />}
                  />
                </FormField>
              </div>
            ) : null}

            <FormField label="Weekly off">
              <Controller
                control={control}
                name="weeklyOffDays"
                render={({ field }) => (
                  <ChipMultiSelect options={WEEKDAYS} selected={field.value ?? []} onChange={field.onChange} />
                )}
              />
            </FormField>
          </SectionCard>

          {/* Section 3 — rooms */}
          <SectionCard title="Rooms">
            <FormField label="Number of chairs" hint="We'll create one room per chair.">
              <Controller
                control={control}
                name="chairsCount"
                render={({ field }) => (
                  <Stepper value={field.value} onChange={field.onChange} min={1} max={20} />
                )}
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: chairs || 0 }, (_, i) => (
                <span
                  key={i}
                  className="rounded-md border border-border bg-paper-warm px-2.5 py-1 text-xs font-medium"
                >
                  Room {i + 1}
                </span>
              ))}
            </div>
          </SectionCard>

          {/* Section 4 — doctor profile */}
          <SectionCard title="Your profile">
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-pill bg-paper-warm text-lg font-semibold text-muted-foreground">
                {(currentUser?.name || 'Dr').slice(0, 2).toUpperCase()}
              </span>
              {/* TODO(Phase 2): wire S3 photo upload. Placeholder only in Phase 1. */}
              <button type="button" className="text-sm font-medium text-muted-foreground underline underline-offset-2">
                Add photo
              </button>
            </div>
            <FormField label="Your name" htmlFor="doctorName" required error={errors.doctorName?.message}>
              <Input id="doctorName" placeholder="Dr. Asha Menon" {...register('doctorName')} />
            </FormField>

            <FormField label="Qualification" required error={errors.qualification?.message}>
              <Controller
                control={control}
                name="qualification"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Select
                      value={qualMode === 'other' ? 'Other' : field.value}
                      onChange={(e) => {
                        if (e.target.value === 'Other') {
                          setQualMode('other');
                          field.onChange('');
                        } else {
                          setQualMode('preset');
                          field.onChange(e.target.value);
                        }
                      }}
                    >
                      {QUALIFICATIONS.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </Select>
                    {qualMode === 'other' ? (
                      <Input
                        placeholder="e.g. MDS Endodontics"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    ) : null}
                  </div>
                )}
              />
            </FormField>

            <FormField
              label="Registration number"
              htmlFor="registrationNumber"
              required
              error={errors.registrationNumber?.message}
              hint="Encrypted and stored securely."
            >
              <Input id="registrationNumber" placeholder="KA-DENT-12345" {...register('registrationNumber')} />
            </FormField>

            <FormField label="Specialization" hint="Optional — pick any that apply.">
              <Controller
                control={control}
                name="specialization"
                render={({ field }) => (
                  <ChipMultiSelect
                    options={SPECIALIZATIONS}
                    selected={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
          </SectionCard>
        </div>

        {/* Sticky submit */}
        <div className="sticky bottom-0 mt-auto border-t border-border bg-background/90 px-5 py-3 backdrop-blur" style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            Create clinic
          </Button>
        </div>
      </form>
    </MobileShell>
  );
}
