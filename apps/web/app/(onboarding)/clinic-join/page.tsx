"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClinicJoinInput } from "@odovox/types";
import type { ClinicMemberResponse } from "@odovox/types";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Mini } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/avatar";
import { IconCircle } from "@/components/ds";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/FormField";
import { ChipMultiSelect } from "@/components/forms/ChipMultiSelect";
import { api } from "@/lib/api-client";
import { landingRoute, type Role } from "@/lib/rbac";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { useOnboarding } from "@/lib/onboarding-store";

const SPECIALIZATIONS = [
  "General",
  "Endodontics",
  "Orthodontics",
  "Prosthodontics",
  "Periodontics",
  "Oral Surgery",
  "Pediatric Dentistry",
  "Oral Pathology",
  "Public Health",
].map((s) => ({ label: s, value: s }));

type FormValues = ClinicJoinInput;
interface LookupResult {
  name: string;
  city: string;
  state: string;
}

export default function ClinicJoinPage() {
  const router = useRouter();
  const toast = useToast();
  const role = useOnboarding((s) => s.role);
  const setMembership = useAuth((s) => s.setMembership);
  const setAccessToken = useAuth((s) => s.setAccessToken);
  const resetOnboarding = useOnboarding((s) => s.reset);

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [joining, setJoining] = useState(false);
  // Set on a successful join, BEFORE resetOnboarding() clears `role` — otherwise the effect below
  // re-fires on the reset and bounces the just-joined user back to /role (the P0.4 loop).
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!role && !joinedRef.current) router.replace("/role");
  }, [role, router]);

  const isDoctor = role === "DOCTOR";

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(ClinicJoinInput),
    mode: "onTouched",
    defaultValues: {
      joinCode: "",
      name: "",
      role: role ?? "RECEPTIONIST",
      qualification: "",
      registrationNumber: "",
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
      toast.apiError(err);
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
        accessToken: string;
      }>("/clinics/join", values);
      joinedRef.current = true;
      // Adopt the clinic-scoped token first: the pre-join token carries no clinicId claim, so
      // every clinic-scoped request (the entire app) would 403 until the next refresh.
      setAccessToken(data.accessToken);
      setMembership(data.membership, {
        id: data.clinic.id,
        name: data.clinic.name,
        city: data.clinic.city,
        state: data.clinic.state,
      });
      resetOnboarding();
      router.replace(landingRoute(data.membership.role as Role));
    } catch (err) {
      toast.apiError(err);
    } finally {
      setJoining(false);
    }
  };

  return (
    <MobileShell className="bg-paper">
      {/* Frame 09 opens on a bare white `.icirc` chevron — no title beside it — and has
          no mascot. Both were additions. (MUST-FIX #28) */}
      <div className="flex px-gutter-onboarding pt-0.5">
        <IconCircle size="md" aria-label="Back" onClick={() => router.back()}>
          <ChevronLeft />
        </IconCircle>
      </div>
      <div className="flex flex-1 flex-col px-gutter-onboarding pt-2">
        <div className="mt-6">
          <h1 className="text-question font-heavy leading-[1.15] tracking-question text-pine">
            Got a join code?
          </h1>
          <p className="mt-2 text-sm leading-[1.5] text-pine-2">
            Ask your doctor to share it from Team &amp; join code.
          </p>
        </div>

        {lookup ? (
          <div className="mt-8 space-y-4">
            <Card className="flex items-center gap-[13px] p-[15px]">
              <InitialsAvatar name={lookup.name} ring="lime" size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-row font-heavy text-pine">
                  {lookup.name}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Mini tone="neutral">{lookup.city}</Mini>
                  <Mini tone="neutral">{lookup.state}</Mini>
                </div>
              </div>
            </Card>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setLookup(null)}
                disabled={joining}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={confirmJoin}
                loading={joining}
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={findClinic} className="mt-8 space-y-4">
            <FormField
              label="Your name"
              htmlFor="name"
              required
              error={errors.name?.message}
            >
              <Input id="name" placeholder="Ravi Kumar" {...register("name")} />
            </FormField>
            <FormField
              label="Join code"
              htmlFor="joinCode"
              required
              error={errors.joinCode?.message}
            >
              <Input
                id="joinCode"
                placeholder="SMILE7"
                maxLength={12}
                className="uppercase tracking-widest"
                {...register("joinCode")}
              />
            </FormField>

            {isDoctor ? (
              <>
                <FormField
                  label="Qualification"
                  htmlFor="qualification"
                  required
                  error={errors.qualification?.message}
                >
                  <Input
                    id="qualification"
                    placeholder="BDS, MDS"
                    {...register("qualification")}
                  />
                </FormField>
                <FormField
                  label="Registration number"
                  htmlFor="registrationNumber"
                  required
                  error={errors.registrationNumber?.message}
                  hint="Encrypted and stored securely."
                >
                  <Input
                    id="registrationNumber"
                    placeholder="KA-DENT-12345"
                    {...register("registrationNumber")}
                  />
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

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isSubmitting}
            >
              Find clinic
            </Button>
          </form>
        )}
      </div>
    </MobileShell>
  );
}
