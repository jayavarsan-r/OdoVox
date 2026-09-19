"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { INDIAN_STATES } from "@odovox/types";
import {
  WizardStepLayout,
  VerifiedIdentityChip,
  WizardDefaultsCard,
} from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/forms/Select";
import { PhoneInput } from "@/components/forms/PhoneInput";
import {
  BASICS_QUESTIONS,
  basicsCtaLabel,
  stepBasicsSchema,
  stepRoute,
  type StepBasicsValues,
} from "@/lib/ds/wizard";
import { useOnboarding } from "@/lib/onboarding-store";
import { useAuth } from "@/lib/auth";

type Values = StepBasicsValues;

/**
 * Frame 08 — clinic basics, asked ONE QUESTION AT A TIME.
 *
 * The frame collapses clinic creation to a single conversational screen with one hero
 * field and a CTA that names the next question ("Next · City"). We keep all THREE steps
 * and every field the API requires (Global Constraint 1), so what is reproduced here is
 * the frame's PACING: five questions inside step 1, each its own screen, each CTA
 * labelled with where it goes — instead of the six-field form this used to be.
 *
 * The schema is untouched. `stepBasicsSchema` still validates the whole slice, the store
 * still receives one write, and `lib/ds/wizard` owns the question list with a test that
 * every field it covers appears exactly once — so re-pacing can never silently drop one.
 */
export default function ClinicBasicsStep() {
  const router = useRouter();
  const clinicData = useOnboarding((s) => s.clinicData);
  const setClinicData = useOnboarding((s) => s.setClinicData);
  const signupPhone =
    useAuth((s) => s.user?.phone) ?? useOnboarding.getState().phone ?? "";

  const [qIndex, setQIndex] = useState(0);
  const question = BASICS_QUESTIONS[qIndex]!;
  const isLast = qIndex === BASICS_QUESTIONS.length - 1;

  const {
    register,
    control,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(stepBasicsSchema),
    mode: "onTouched",
    defaultValues: {
      name: clinicData?.name ?? "",
      addressLine: clinicData?.addressLine ?? "",
      city: clinicData?.city ?? "",
      state: clinicData?.state ?? "",
      pincode: clinicData?.pincode ?? "",
      contactPhone: clinicData?.contactPhone ?? signupPhone,
      gstNumber: clinicData?.gstNumber ?? "",
    },
  });

  /** Validate only the fields this question owns, then advance. */
  const next = async () => {
    const ok = await trigger([...question.fields]);
    if (!ok) return;
    if (!isLast) {
      setQIndex((i) => i + 1);
      return;
    }
    setClinicData(getValues());
    router.push(stepRoute("hours"));
  };

  const back = () => setQIndex((i) => i - 1);

  return (
    <WizardStepLayout
      current="basics"
      backHref="/clinic-choice"
      onBack={qIndex > 0 ? back : undefined}
    >
      <form
        className="flex flex-1 flex-col px-gutter-onboarding"
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
      >
        {/* Frame 08 opens on the verified-identity chip — proof that the OTP-verified
            account is the one this clinic will belong to. */}
        <div className="mt-5 flex">
          <VerifiedIdentityChip />
        </div>

        <h1 className="mt-3 text-question font-heavy leading-[1.15] tracking-question text-pine">
          {question.question}
        </h1>
        <p className="mt-2 text-sm leading-[1.5] text-pine-2">
          {question.hint}
        </p>

        <div className="mt-5 space-y-3">
          {question.id === "name" ? (
            <Input
              key="name"
              autoFocus
              size="hero"
              aria-label="Clinic name"
              placeholder="Smile Dental Care"
              invalid={!!errors.name}
              {...register("name")}
            />
          ) : null}

          {question.id === "contact" ? (
            <Controller
              control={control}
              name="contactPhone"
              render={({ field }) => (
                <PhoneInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  autoFocus
                  invalid={!!errors.contactPhone}
                />
              )}
            />
          ) : null}

          {question.id === "address" ? (
            <Input
              key="addressLine"
              autoFocus
              size="hero"
              aria-label="Address"
              placeholder="12 MG Road, Indiranagar"
              invalid={!!errors.addressLine}
              {...register("addressLine")}
            />
          ) : null}

          {question.id === "city" ? (
            <>
              <Input
                key="city"
                autoFocus
                size="hero"
                aria-label="City"
                placeholder="Bengaluru"
                invalid={!!errors.city}
                {...register("city")}
              />
              <Select
                aria-label="State"
                invalid={!!errors.state}
                defaultValue=""
                {...register("state")}
              >
                <option value="" disabled>
                  Select state
                </option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </>
          ) : null}

          {question.id === "pincode" ? (
            <>
              <Input
                key="pincode"
                autoFocus
                size="hero"
                inputMode="numeric"
                maxLength={6}
                aria-label="Pincode"
                placeholder="560001"
                invalid={!!errors.pincode}
                {...register("pincode")}
              />
              <Input
                key="gstNumber"
                aria-label="GST number"
                placeholder="GST number (optional)"
                invalid={!!errors.gstNumber}
                {...register("gstNumber")}
              />
            </>
          ) : null}
        </div>

        {/* One live error line, in the frame's crit voice. */}
        {question.fields
          .map((f) => errors[f]?.message)
          .filter(Boolean)
          .slice(0, 1)
          .map((message) => (
            <p
              key={String(message)}
              role="alert"
              className="mt-2.5 text-body font-heavy text-crit"
            >
              {String(message)}
            </p>
          ))}

        <Button type="submit" size="lg" block className="mt-4">
          {basicsCtaLabel(qIndex)}
        </Button>

        {/* Frame 08 pins this to the bottom: the settings the wizard ships without
            asking, and where to change them. */}
        <WizardDefaultsCard className="mb-[14px] mt-auto" />
      </form>
    </WizardStepLayout>
  );
}
