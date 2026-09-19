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
import { Check, ChevronLeft } from "lucide-react";
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
  const [lookupFailed, setLookupFailed] = useState(false);
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
    watch,
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

  /**
   * Look the clinic up AS THE CODE IS TYPED, not behind a "Find clinic" button.
   *
   * Frame 09 shows the clinic the moment the code is valid — a tick on the field and a card
   * naming it — because the question this screen answers is "is this the right place", and
   * making someone press a button to find out turns one decision into two.
   *
   * Debounced, and every in-flight lookup is superseded by the next keystroke: a slow
   * response for "SMILE" must not arrive after "SMILE7" and replace the right clinic with a
   * stale one. The code is also never sent until it is long enough to be one.
   */
  const joinCode = watch("joinCode");
  const lookupSeq = useRef(0);
  useEffect(() => {
    const code = (joinCode ?? "").trim();
    if (code.length < 4) {
      setLookup(null);
      setLookupFailed(false);
      return;
    }
    const seq = ++lookupSeq.current;
    const timer = setTimeout(() => {
      void api
        .get<LookupResult>(
          `/clinics/lookup?joinCode=${encodeURIComponent(code)}`,
          { skipAuth: true },
        )
        .then((data) => {
          if (seq !== lookupSeq.current) return;
          setLookup(data);
          setLookupFailed(false);
        })
        .catch(() => {
          if (seq !== lookupSeq.current) return;
          // A code that matches nothing is the ordinary state of a half-typed one, so it is
          // not an error toast — the field simply does not confirm a clinic.
          setLookup(null);
          setLookupFailed(true);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [joinCode]);

  /** The form's submit: the code has already found the clinic, so this asks to join it. */
  const requestToJoin = handleSubmit(async () => {
    await confirmJoin();
  });

  const confirmJoin = async () => {
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

          <form onSubmit={requestToJoin} className="mt-8 space-y-4">
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
              <span className="relative block">
                <Input
                  id="joinCode"
                  placeholder="SMILE7"
                  maxLength={12}
                  className="uppercase tracking-widest"
                  {...register("joinCode")}
                />
                {/* The frame's tick. It confirms the code found a clinic — the card below
                    says WHICH — so the field itself answers the question it asked. */}
                {lookup ? (
                  <Check className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-live" />
                ) : null}
              </span>
              {lookupFailed ? (
                <p className="mt-1.5 text-3xs font-bold text-pine-3">
                  No clinic with that code yet — check it with your doctor.
                </p>
              ) : null}
            </FormField>

            {/*
              The clinic, named, the moment the code finds one — frame 09's card. It used to
              REPLACE this form behind a Find/Confirm two-step, so you could not see the code
              you had typed and the clinic it matched at the same time.
            */}
            {lookup ? (
              <Card className="flex items-center gap-[13px] p-[15px]">
                <InitialsAvatar name={lookup.name} ring="lime" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-row font-heavy text-pine">{lookup.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Mini tone="neutral">{lookup.city}</Mini>
                    <Mini tone="neutral">{lookup.state}</Mini>
                  </div>
                </div>
              </Card>
            ) : null}

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

            {/* "Request to join", as the frame has it — the code already found the clinic, so
                the only thing left to do is ask. Disabled until one is actually found, because
                there is nothing to join before that. */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!lookup}
              loading={isSubmitting}
            >
              Request to join
            </Button>
          </form>
      </div>
    </MobileShell>
  );
}
