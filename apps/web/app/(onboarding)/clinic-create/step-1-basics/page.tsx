"use client";

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
import { FormField } from "@/components/forms/FormField";
import { Select } from "@/components/forms/Select";
import { PhoneInput } from "@/components/forms/PhoneInput";
import {
  stepBasicsSchema,
  stepRoute,
  type StepBasicsValues,
} from "@/lib/ds/wizard";
import { useOnboarding } from "@/lib/onboarding-store";
import { useAuth } from "@/lib/auth";

type Values = StepBasicsValues;

export default function ClinicBasicsStep() {
  const router = useRouter();
  const clinicData = useOnboarding((s) => s.clinicData);
  const setClinicData = useOnboarding((s) => s.setClinicData);
  const signupPhone =
    useAuth((s) => s.user?.phone) ?? useOnboarding.getState().phone ?? "";

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
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

  const onSubmit = handleSubmit((values) => {
    setClinicData(values);
    router.push(stepRoute("hours"));
  });

  return (
    <WizardStepLayout current="basics" backHref="/clinic-choice">
      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="flex flex-col space-y-5 px-gutter-onboarding pb-28 pt-4">
          {/* Frame 08 opens on the verified-identity chip — proof that the OTP-verified
              account is the one this clinic will belong to. (MUST-FIX #27) */}
          <VerifiedIdentityChip />
          <div>
            <h1 className="text-question font-heavy leading-[1.15] tracking-question text-pine">
              What&apos;s your clinic called?
            </h1>
            <p className="mt-2 text-sm leading-[1.5] text-pine-2">
              Appears on prescriptions and WhatsApp messages.
            </p>
          </div>
          <div className="space-y-4 rounded-2xl bg-paper-warm p-5 shadow-elev-1">
            <FormField
              label="Clinic name"
              htmlFor="name"
              required
              error={errors.name?.message}
            >
              <Input
                id="name"
                placeholder="Smile Dental Care"
                {...register("name")}
              />
            </FormField>
            <FormField
              label="Contact phone"
              required
              error={errors.contactPhone?.message}
            >
              <Controller
                control={control}
                name="contactPhone"
                render={({ field }) => (
                  <PhoneInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    invalid={!!errors.contactPhone}
                  />
                )}
              />
            </FormField>
            <FormField
              label="Address"
              htmlFor="addressLine"
              required
              error={errors.addressLine?.message}
            >
              <Input
                id="addressLine"
                placeholder="12 MG Road, Indiranagar"
                {...register("addressLine")}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="City"
                htmlFor="city"
                required
                error={errors.city?.message}
              >
                <Input
                  id="city"
                  placeholder="Bengaluru"
                  {...register("city")}
                />
              </FormField>
              <FormField label="State" required error={errors.state?.message}>
                <Select
                  invalid={!!errors.state}
                  defaultValue=""
                  {...register("state")}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Pincode"
                htmlFor="pincode"
                required
                error={errors.pincode?.message}
              >
                <Input
                  id="pincode"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="560001"
                  {...register("pincode")}
                />
              </FormField>
              <FormField
                label="GST number"
                htmlFor="gstNumber"
                error={errors.gstNumber?.message}
              >
                <Input
                  id="gstNumber"
                  placeholder="Optional"
                  {...register("gstNumber")}
                />
              </FormField>
            </div>
          </div>

          {/* Frame 08 pins this to the bottom: the settings the wizard ships without
              asking, and where to change them. (MUST-FIX #27) */}
          <WizardDefaultsCard className="mt-auto" />
        </div>

        <div
          className="sticky bottom-0 mt-auto border-t border-hair bg-paper px-gutter-onboarding py-3"
          style={{ paddingBottom: "calc(0.75rem + var(--safe-bottom))" }}
        >
          {/* The frame labels its CTA with the destination ("Next · City"), never a
              generic "Continue". Ours names OUR next step — copying the frame's literal
              word would be wrong, because step 2 here is Hours, not City. */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!isValid}
          >
            Next · Hours
          </Button>
        </div>
      </form>
    </WizardStepLayout>
  );
}
