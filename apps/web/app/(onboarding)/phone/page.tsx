'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IndianPhone } from '@odovox/types';
import { MobileShell } from '@/components/mobile-shell';
import { GradientMesh } from '@/components/gradient-mesh';
import { LogoLockup } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { FormField } from '@/components/forms/FormField';
import { api, ApiError } from '@/lib/api-client';
import { useOnboarding } from '@/lib/onboarding-store';

export default function PhonePage() {
  const router = useRouter();
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
      const msg = err instanceof ApiError ? err.message : 'Could not send the code. Try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell className="px-7">
      <GradientMesh preset="two" />
      <div className="flex flex-1 flex-col justify-center">
        <LogoLockup />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Welcome to Odovox</h1>
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
            <PhoneInput id="phone" value={digits} onChange={setDigits} autoFocus />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={!valid || loading}>
            {loading ? <Spinner /> : null}
            Continue
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{' '}
          <span className="underline underline-offset-2">terms</span>.
        </p>
      </div>
    </MobileShell>
  );
}
