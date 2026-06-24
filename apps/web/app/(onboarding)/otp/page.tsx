'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/mobile-shell';
import { AnimatedPage } from '@/components/animated-page';
import { BackHeader } from '@/components/onboarding/back-header';
import { DecorativeFooter, EditorialHeading } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/forms/OtpInput';
import { api } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { useOnboarding } from '@/lib/onboarding-store';
import { useAuth, type SessionUser } from '@/lib/auth';
import type { ClinicMemberResponse, OnboardingNextStep } from '@odovox/types';

interface VerifyResponse {
  accessToken: string;
  user: SessionUser;
  activeMembership: ClinicMemberResponse | null;
  nextStep: OnboardingNextStep;
}

const RESEND_SECONDS = 60;
const isDev = process.env.NODE_ENV !== 'production';

export default function OtpPage() {
  const router = useRouter();
  const toast = useToast();
  const phone = useOnboarding((s) => s.phone);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const submitting = useRef(false);

  useEffect(() => {
    if (!phone) router.replace('/phone');
  }, [phone, router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const masked = phone ? `+91 ${'•'.repeat(5)} ${phone.slice(6)}` : '';

  const verify = async (code: string) => {
    if (!phone || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setInvalid(false);
    try {
      const data = await api.post<VerifyResponse>(
        '/auth/otp/verify',
        { phone, otp: code },
        { skipAuth: true },
      );
      useAuth.getState().setSession({
        accessToken: data.accessToken,
        user: data.user,
        activeMembership: data.activeMembership,
      });
      router.replace(data.nextStep === 'HOME' ? '/home' : '/role');
    } catch (err) {
      setInvalid(true);
      setOtp('');
      toast.apiError(err);
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const resend = async () => {
    if (!phone || secondsLeft > 0) return;
    try {
      await api.post('/auth/otp/request', { phone }, { skipAuth: true });
      setSecondsLeft(RESEND_SECONDS);
      toast.success('A new code is on its way.');
    } catch (err) {
      toast.apiError(err);
    }
  };

  return (
    <MobileShell className="bg-paper">
      <BackHeader />
      <AnimatedPage className="flex flex-1 flex-col px-7 pt-6">
        <EditorialHeading
          title="Verify your number"
          subtitle={`We sent a 6-digit code to ${masked}`}
        />

        <div className="mt-8">
          <OtpInput
            value={otp}
            onChange={(v) => {
              setOtp(v);
              setInvalid(false);
            }}
            onComplete={verify}
            invalid={invalid}
            disabled={loading}
            autoFocus
          />
        </div>

        <div className="mt-5 flex items-center justify-between text-sm">
          {secondsLeft > 0 ? (
            <span className="text-muted-foreground">Resend in {secondsLeft}s</span>
          ) : (
            <button
              type="button"
              onClick={resend}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Resend code
            </button>
          )}
          <button
            type="button"
            onClick={() => router.replace('/phone')}
            className="font-medium text-muted-foreground"
          >
            Wrong number? Edit
          </button>
        </div>

        <Button
          size="lg"
          className="mt-8 w-full"
          disabled={otp.length !== 6}
          loading={loading}
          onClick={() => verify(otp)}
        >
          Verify
        </Button>

        {isDev ? (
          <div className="pt-6 text-center">
            <span className="rounded-pill border border-border bg-surface/70 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur">
              Dev mode: use 123456
            </span>
          </div>
        ) : null}
      </AnimatedPage>
      <DecorativeFooter variant="dots" className="pb-6" />
    </MobileShell>
  );
}
