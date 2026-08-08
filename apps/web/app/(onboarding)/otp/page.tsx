'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/mobile-shell';
import { AnimatedPage } from '@/components/animated-page';
import { DecorativeFooter, IconCircle } from '@/components/ds';
import { AlertTriangle, ChevronLeft, MessageSquare } from 'lucide-react';
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
      // Frame 05: "Resend unlocks immediately on a failed attempt." A wrong code often
      // means the SMS never arrived, so making the user wait out the original
      // countdown strands them on a screen with no way forward.
      setSecondsLeft(0);
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

  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

  /**
   * Frames 04 and 05. The `.ob` layout, with the error state doing real work:
   * crit outlines on every box, a factual line, and resend unlocked at once.
   */
  return (
    <MobileShell className="bg-paper">
      <AnimatedPage className="flex flex-1 flex-col px-gutter-onboarding">
        <div className="flex pt-0.5">
          <IconCircle size="md" aria-label="Back" onClick={() => router.replace('/phone')}>
            <ChevronLeft />
          </IconCircle>
        </div>

        <div className="mt-6">
          <h1 className="text-question font-heavy leading-[1.15] tracking-tight text-pine">
            Enter the code
          </h1>
          <p className="mt-2 text-sm leading-[1.5] text-pine-2">
            Sent to {masked} ·{' '}
            <button
              type="button"
              onClick={() => router.replace('/phone')}
              className="font-heavy text-pine underline underline-offset-2"
            >
              Edit
            </button>
          </p>
        </div>

        <div className="mt-5">
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

        {invalid ? (
          <p className="mt-3.5 flex items-center gap-2 text-body font-heavy text-crit" role="alert">
            <AlertTriangle className="size-[15px] shrink-0" />
            That code didn&apos;t match — try again
          </p>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-body font-medium text-pine-2">
            <MessageSquare className="size-[15px] shrink-0 text-live" />
            Reading SMS automatically…
          </p>
        )}

        <Button
          size="lg"
          block
          className="mt-6"
          disabled={otp.length !== 6}
          loading={loading}
          onClick={() => verify(otp)}
        >
          Verify
        </Button>

        <div className="mt-auto pb-6 text-center">
          {secondsLeft > 0 ? (
            <p className="text-body font-semibold text-pine-3">
              Resend in{' '}
              <b className="font-heavy tabular-nums text-pine">{countdown}</b>
            </p>
          ) : (
            <button
              type="button"
              onClick={resend}
              className="text-body font-heavy text-pine underline underline-offset-2"
            >
              Resend code
            </button>
          )}
          {isDev ? (
            <p className="mt-3 font-mono text-xs text-pine-3">Dev mode: use 123456</p>
          ) : null}
        </div>
      </AnimatedPage>
      <DecorativeFooter variant="dots" className="pb-6" />
    </MobileShell>
  );
}
