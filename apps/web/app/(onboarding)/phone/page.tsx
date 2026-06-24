'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IndianPhone } from '@odovox/types';
import { MobileShell } from '@/components/mobile-shell';
import { AnimatedPage } from '@/components/animated-page';
import { ToothMark, Wordmark } from '@/components/ui/logo';
import { DecorativeFooter } from '@/components/ds';
import { MascotMoment } from '@/components/illustrations';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { FormField } from '@/components/forms/FormField';
import { api } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { useOnboarding } from '@/lib/onboarding-store';

export default function PhonePage() {
  const router = useRouter();
  const toast = useToast();
  const setPhone = useOnboarding((s) => s.setPhone);
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);

  const valid = IndianPhone.safeParse(digits).success;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { phone: digits }, { skipAuth: true });
      setPhone(digits);
      router.push('/otp');
    } catch (err) {
      toast.apiError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell className="bg-paper px-7">
      <AnimatedPage className="flex flex-1 flex-col">
        {/* Centered logo with glow + Odo peeking to the right */}
        <div className="flex flex-col items-center pt-20">
          <div className="relative flex size-16 items-center justify-center">
            <span className="absolute inset-0 rounded-pill bg-lime-soft blur-xl" aria-hidden />
            <span className="relative flex size-14 items-center justify-center rounded-pill bg-ink text-lime">
              <ToothMark className="size-8" />
            </span>
            <div className="absolute -right-12 -top-2 rotate-[8deg]">
              <MascotMoment pose="smile" size="sm" animation="float" />
            </div>
          </div>
          <Wordmark className="mt-3 text-[28px]" />
        </div>

        <div className="mt-12 flex flex-1 flex-col">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Odovox</h1>
          <p className="mt-1.5 text-base text-muted-foreground">
            Enter your mobile number to sign in or create an account.
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <FormField label="Mobile number" htmlFor="phone">
              <PhoneInput id="phone" value={digits} onChange={setDigits} autoFocus invalid={false} />
            </FormField>
            <Button type="submit" size="lg" className="w-full" disabled={!valid} loading={loading}>
              Continue
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <span className="underline underline-offset-2">terms</span>.
          </p>
        </div>
      </AnimatedPage>
      <DecorativeFooter variant="waveform" className="pb-6" />
    </MobileShell>
  );
}
