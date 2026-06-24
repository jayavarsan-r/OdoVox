'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ClinicMemberResponse } from '@odovox/types';
import { WizardStepLayout } from '@/components/onboarding/wizard-shell';
import { EditorialHeading } from '@/components/ds';
import { MascotMoment } from '@/components/illustrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/forms/FormField';
import { Select } from '@/components/forms/Select';
import { ChipMultiSelect } from '@/components/forms/ChipMultiSelect';
import {
  mergeWizard,
  stepProfileSchema,
  stepRoute,
  validateClinicSubmission,
  type StepProfileValues,
} from '@/lib/ds/wizard';
import { api } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { useOnboarding } from '@/lib/onboarding-store';
import { useClinicResult } from '@/lib/clinic-result-store';

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

export default function ClinicProfileStep() {
  const router = useRouter();
  const toast = useToast();
  const clinicData = useOnboarding((s) => s.clinicData);
  const doctorProfile = useOnboarding((s) => s.doctorProfile);
  const setClinicData = useOnboarding((s) => s.setClinicData);
  const setDoctorProfile = useOnboarding((s) => s.setDoctorProfile);
  const resetOnboarding = useOnboarding((s) => s.reset);
  const setMembership = useAuth((s) => s.setMembership);
  const currentUser = useAuth((s) => s.user);
  const setResult = useClinicResult((s) => s.set);

  const initialQual = clinicData?.qualification ?? doctorProfile?.qualification ?? 'BDS';
  const [qualMode, setQualMode] = useState<'preset' | 'other'>(
    QUALIFICATIONS.includes(initialQual) && initialQual !== 'Other' ? 'preset' : 'other',
  );
  const [celebrating, setCelebrating] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StepProfileValues>({
    resolver: zodResolver(stepProfileSchema),
    mode: 'onTouched',
    defaultValues: {
      doctorName: clinicData?.doctorName ?? currentUser?.name ?? '',
      qualification: initialQual,
      registrationNumber: doctorProfile?.registrationNumber ?? clinicData?.registrationNumber ?? '',
      specialization: doctorProfile?.specialization ?? clinicData?.specialization ?? [],
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const profile = {
      qualification: values.qualification,
      registrationNumber: values.registrationNumber,
      specialization: values.specialization,
    };
    // Persist for refresh-safety, then merge all three steps into one payload.
    setClinicData({ doctorName: values.doctorName });
    setDoctorProfile(profile);

    const merged = mergeWizard({ ...clinicData, doctorName: values.doctorName }, profile);
    const parsed = validateClinicSubmission(merged);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? 'Some details are missing — please review the earlier steps.');
      return;
    }

    try {
      const data = await api.post<{
        clinic: { id: string; name: string; city: string; state: string };
        membership: ClinicMemberResponse;
        joinCode: string;
      }>('/clinics', parsed.data);
      setMembership(data.membership, {
        id: data.clinic.id,
        name: data.clinic.name,
        city: data.clinic.city,
        state: data.clinic.state,
      });
      setResult({ clinicName: data.clinic.name, city: data.clinic.city, joinCode: data.joinCode });
      setCelebrating(true);
      resetOnboarding();
      router.replace('/done');
    } catch (err) {
      toast.apiError(err);
    }
  });

  return (
    <WizardStepLayout current="profile" backHref={stepRoute('hours')}>
      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="space-y-5 px-5 pb-28 pt-4">
          <EditorialHeading eyebrow="STEP 3 OF 3" title="About you" subtitle="Encrypted and stored securely." />

          <div className="space-y-4 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-pill bg-paper-warm text-lg font-semibold text-muted-foreground">
                {(currentUser?.name || 'Dr').slice(0, 2).toUpperCase()}
              </span>
              {/* TODO(Phase 3): wire S3 photo upload. Placeholder only. */}
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
          </div>
        </div>

        <div
          className="sticky bottom-0 mt-auto border-t border-border bg-background/85 px-5 py-3 backdrop-blur-glass-sm"
          style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
        >
          {celebrating ? (
            <div className="pointer-events-none absolute -top-16 right-5">
              <MascotMoment pose="celebrate" size="sm" animation="bounce-in" />
            </div>
          ) : null}
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Create clinic
          </Button>
        </div>
      </form>
    </WizardStepLayout>
  );
}
