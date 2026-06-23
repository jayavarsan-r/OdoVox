'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';
import { ClinicJoinInput } from '@odovox/types';
import type { ClinicMemberResponse } from '@odovox/types';
import { MobileShell } from '@/components/mobile-shell';
import { GradientMesh } from '@/components/gradient-mesh';
import { BackHeader } from '@/components/onboarding/back-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FormField } from '@/components/forms/FormField';
import { ChipMultiSelect } from '@/components/forms/ChipMultiSelect';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { useOnboarding } from '@/lib/onboarding-store';

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

type FormValues = ClinicJoinInput;
interface LookupResult {
  name: string;
  city: string;
  state: string;
}

export default function ClinicJoinPage() {
  const router = useRouter();
  const role = useOnboarding((s) => s.role);
  const setMembership = useAuth((s) => s.setMembership);
  const resetOnboarding = useOnboarding((s) => s.reset);

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!role) router.replace('/role');
  }, [role, router]);

  const isDoctor = role === 'DOCTOR';

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(ClinicJoinInput),
    mode: 'onTouched',
    defaultValues: {
      joinCode: '',
      name: '',
      role: role ?? 'RECEPTIONIST',
      qualification: '',
      registrationNumber: '',
      specialization: [],
    },
  });

  // Step 1: validate, then look up the clinic to confirm before joining.
  const findClinic = handleSubmit(async (values) => {
    try {
      const data = await api.get<LookupResult>(
        `/clinics/lookup?joinCode=${encodeURIComponent(values.joinCode)}`,
        { skipAuth: true },
      );
      setLookup(data);
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 404
          ? 'No clinic found for that code.'
          : 'Could not look up that code.',
      );
    }
  });

  // Step 2: actually join.
  const confirmJoin = async () => {
    setJoining(true);
    try {
      const values = getValues();
      const data = await api.post<{
        clinic: { id: string; name: string; city: string; state: string };
        membership: ClinicMemberResponse;
      }>('/clinics/join', values);
      setMembership(data.membership, {
        id: data.clinic.id,
        name: data.clinic.name,
        city: data.clinic.city,
        state: data.clinic.state,
      });
      resetOnboarding();
      router.replace('/home');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not join the clinic.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <MobileShell>
      <GradientMesh preset="four" />
      <BackHeader title="Join a clinic" />
      <div className="flex flex-1 flex-col px-5 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">Join a clinic</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask your clinic admin for the join code.
        </p>

        {lookup ? (
          <Card className="mt-8">
            <CardContent className="space-y-5 p-6 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-md bg-lime-soft text-ink">
                <Building2 className="size-7" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Join</p>
                <p className="text-xl font-semibold">{lookup.name}</p>
                <p className="text-sm text-muted-foreground">
                  {lookup.city}, {lookup.state}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setLookup(null)} disabled={joining}>
                  Back
                </Button>
                <Button className="flex-1" onClick={confirmJoin} disabled={joining}>
                  {joining ? <Spinner /> : null}
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={findClinic} className="mt-8 space-y-4">
            <FormField label="Your name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" placeholder="Ravi Kumar" {...register('name')} />
            </FormField>
            <FormField label="Join code" htmlFor="joinCode" required error={errors.joinCode?.message}>
              <Input
                id="joinCode"
                placeholder="SMILE7"
                maxLength={12}
                className="uppercase tracking-widest"
                {...register('joinCode')}
              />
            </FormField>

            {isDoctor ? (
              <>
                <FormField label="Qualification" htmlFor="qualification" required error={errors.qualification?.message}>
                  <Input id="qualification" placeholder="BDS, MDS" {...register('qualification')} />
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
                <FormField label="Specialization" hint="Optional.">
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
              </>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Find clinic
            </Button>
          </form>
        )}
      </div>
    </MobileShell>
  );
}
