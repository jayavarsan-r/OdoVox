"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IndianPhone } from "@odovox/types";
import { MobileShell } from "@/components/mobile-shell";
import { AnimatedPage } from "@/components/animated-page";
import { IconCircle } from "@/components/ds";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/forms/PhoneInput";
import { api } from "@/lib/api-client";
import { useToast } from "@/lib/toast";
import { useOnboarding } from "@/lib/onboarding-store";

export default function PhonePage() {
  const router = useRouter();
  const toast = useToast();
  const setPhone = useOnboarding((s) => s.setPhone);
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = IndianPhone.safeParse(digits).success;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    try {
      await api.post(
        "/auth/otp/request",
        { phone: digits },
        { skipAuth: true },
      );
      setPhone(digits);
      router.push("/otp");
    } catch (err) {
      toast.apiError(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Frame 03. The `.ob` onboarding layout: back chevron, a 27px question, the 56px
   * `.field` with the +91 prefix, then the CTA. All auth logic, validation and
   * rate-limit handling are untouched — presentation only.
   *
   * TWO THINGS THE FRAME HAS THAT THIS PAGE DOES NOT, both recorded rather than faked:
   *
   *  - the summoned keypad (deviation 7). This page has always used the native keyboard,
   *    so building a pad ADDS a surface rather than migrating one.
   *  - the `.mic-a` affordance. `useDictation` presigns an upload and calls an
   *    authenticated transcription endpoint, and this screen is pre-login by definition.
   *    Wiring it needs an unauthenticated dictation route that does not exist — so the
   *    mic would be a button that does nothing, which is worse than its absence.
   *    `PhoneInput` carries the `onDictate` prop for frames where the user IS signed in.
   */
  return (
    <MobileShell className="bg-paper">
      <AnimatedPage className="flex flex-1 flex-col px-gutter-onboarding">
        <div className="flex pt-0.5">
          <IconCircle size="md" aria-label="Back" onClick={() => router.back()}>
            <ChevronLeft />
          </IconCircle>
        </div>

        <div className="mt-6">
          <h1 className="text-question font-heavy leading-[1.15] tracking-tight text-pine">
            What&apos;s your number?
          </h1>
          <p className="mt-2 text-sm leading-[1.5] text-pine-2">
            We&apos;ll send a 6-digit code. No passwords, ever.
          </p>
        </div>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {/* No visible label: frame 03 goes question -> field. The input carries its
              own aria-label, so the accessible name survives the label's removal. */}
          <PhoneInput
            id="phone"
            value={digits}
            onChange={setDigits}
            autoFocus
            invalid={false}
          />
          <Button
            type="submit"
            size="lg"
            block
            className="mt-4"
            disabled={!valid}
            loading={loading}
          >
            Send code
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-pine-3">
          By continuing you agree to our{" "}
          <span className="underline underline-offset-2">terms</span>.
        </p>
      </AnimatedPage>
      {/* The decorative waveform footer is gone: frame 03 has no such element, and it
          occupied the third of the canvas the frame gives to the keypad. */}
    </MobileShell>
  );
}
