'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MobileShell } from '@/components/mobile-shell';
import { GradientMesh } from '@/components/gradient-mesh';
import { BackHeader } from '@/components/onboarding/back-header';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { OtpInput } from '@/components/forms/OtpInput';
import { api, ApiError } from '@/lib/api-client';
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
      if (err instanceof ApiError) {
        const remaining = (err.details as { attemptsRemaining?: number } | undefined)?.attemptsRemaining;
        toast.error(
          typeof remaining === 'number' ? `Wrong code. ${remaining} attempts left.` : err.message,
        );
      } else {
        toast.error('Something went wrong. Try again.');
      }
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
      toast.error(err instanceof ApiError ? err.message : 'Could not resend the code.');
    }
  };

  return (
    <MobileShell>
      <GradientMesh preset="two" />
      <BackHeader />
      <div className="flex flex-1 flex-col px-7 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Verify your number</h1>
        <p className="mt-1.5 text-base text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{masked}</span>
        </p>

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
          disabled={otp.length !== 6 || loading}
          onClick={() => verify(otp)}
        >
          {loading ? <Spinner /> : null}
          Verify
        </Button>

        {isDev ? (
          <div className="mt-auto pb-8 pt-6 text-center">
            <span className="rounded-pill border border-border bg-surface/70 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur">
              Dev mode: use 123456
            </span>
          </div>
        ) : null}
      </div>
    </MobileShell>
  );
}
