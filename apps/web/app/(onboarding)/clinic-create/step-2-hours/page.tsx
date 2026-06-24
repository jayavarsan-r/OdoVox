'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { WizardStepLayout } from '@/components/onboarding/wizard-shell';
import { EditorialHeading } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/forms/FormField';
import { TimeInput } from '@/components/forms/TimeInput';
import { ChipMultiSelect } from '@/components/forms/ChipMultiSelect';
import { Stepper } from '@/components/forms/Stepper';
import { stepHoursSchema, stepRoute, type StepHoursValues } from '@/lib/ds/wizard';
import { useOnboarding } from '@/lib/onboarding-store';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, value) => ({
  label,
  value,
}));

export default function ClinicHoursStep() {
  const router = useRouter();
  const clinicData = useOnboarding((s) => s.clinicData);
  const setClinicData = useOnboarding((s) => s.setClinicData);
  const [lunchEnabled, setLunchEnabled] = useState(Boolean(clinicData?.lunchStart));

  const {
    handleSubmit,
    control,
    watch,
    formState: { isValid },
  } = useForm<StepHoursValues>({
    resolver: zodResolver(stepHoursSchema),
    mode: 'onTouched',
    defaultValues: {
      openingTime: clinicData?.openingTime ?? '09:00',
      closingTime: clinicData?.closingTime ?? '18:00',
      lunchStart: clinicData?.lunchStart ?? '13:00',
      lunchEnd: clinicData?.lunchEnd ?? '14:00',
      weeklyOffDays: clinicData?.weeklyOffDays ?? [0],
      chairsCount: clinicData?.chairsCount ?? 2,
    },
  });

  const chairs = watch('chairsCount');

  const onSubmit = handleSubmit((values) => {
    const next = { ...values };
    if (!lunchEnabled) {
      next.lunchStart = undefined;
      next.lunchEnd = undefined;
    }
    setClinicData(next);
    router.push(stepRoute('profile'));
  });

  return (
    <WizardStepLayout current="hours" backHref={stepRoute('basics')}>
      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="space-y-5 px-5 pb-28 pt-4">
          <EditorialHeading eyebrow="STEP 2 OF 3" title="When you're open" subtitle="Set hours and chair count." />

          <div className="space-y-4 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Opens at">
                <Controller
                  control={control}
                  name="openingTime"
                  render={({ field }) => <TimeInput value={field.value} onChange={field.onChange} />}
                />
              </FormField>
              <FormField label="Closes at">
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
          </div>

          <div className="space-y-4 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <FormField label="Number of chairs" hint="We'll create one room per chair.">
              <Controller
                control={control}
                name="chairsCount"
                render={({ field }) => <Stepper value={field.value} onChange={field.onChange} min={1} max={20} />}
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
          </div>
        </div>

        <div
          className="sticky bottom-0 mt-auto border-t border-border bg-background/85 px-5 py-3 backdrop-blur-glass-sm"
          style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}
        >
          <Button type="submit" size="lg" className="w-full" disabled={!isValid}>
            Continue
            <ArrowRight />
          </Button>
        </div>
      </form>
    </WizardStepLayout>
  );
}
