"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useAuth, type SessionClinic, type SessionUser } from "@/lib/auth";
import { MobileShell } from "@/components/mobile-shell";
import { GradientMesh } from "@/components/gradient-mesh";
import { MascotMoment } from "@/components/illustrations";
import type { ClinicMemberResponse } from "@odovox/types";

interface MeResponse {
  user: SessionUser;
  activeMembership: ClinicMemberResponse | null;
  clinic: SessionClinic | null;
}

/**
 * Splash router. Re-mints an access token from the refresh cookie, fetches the session, and
 * routes the user to home / role-select / welcome with no flash of unstyled content.
 *
 * (Implemented client-side rather than as a server component: the access token is held in
 * memory and the refresh cookie is scoped to /auth on the API origin, so the token exchange
 * belongs in the browser.)
 */
export default function SplashPage() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const { accessToken } = await api.post<{ accessToken: string }>(
          "/auth/refresh",
          undefined,
          { skipAuth: true },
        );
        useAuth.getState().setAccessToken(accessToken);
        const me = await api.get<MeResponse>("/auth/me");
        useAuth.getState().setSession({
          accessToken,
          user: me.user,
          activeMembership: me.activeMembership,
          clinic: me.clinic,
        });
        router.replace(me.activeMembership ? "/home" : "/role");
      } catch (err) {
        if (!(err instanceof ApiError)) {
          // Network or unexpected — still send the user somewhere usable.
        }
        useAuth.getState().clearSession();
        router.replace("/welcome");
      }
    })();
  }, [router]);

  /**
   * Frame 01. The spec is explicit that this screen has NO spinner: "Odo + a 4px
   * progress hairline." A spinner says "something is happening"; the hairline says
   * "this is nearly done", which is the honest message for a token refresh that
   * usually completes in well under a second.
   */
  return (
    // `-mt-[var(--safe-top)]` because frame 01 is the one screen the spec centres in the
    // FULL canvas: its `.ob` is `inset:0`, not the `inset:54px 0 0 0` every other
    // onboarding frame uses. MobileShell pads by the safe area on every page, which left
    // Odo sitting half an inset low here. Full-bleed splash, then normal insets after.
    <MobileShell className="-mt-[var(--safe-top)] items-center justify-center">
      <GradientMesh variant="warm" />
      <div className="flex flex-col items-center">
        <MascotMoment pose="hero" size="lg" animation="float" />
        <p className="mt-4 text-base font-heavy tracking-logo text-pine">
          ODOVOX
        </p>
        <div
          role="progressbar"
          aria-label="Signing you in"
          className="mt-[22px] h-1 w-[120px] overflow-hidden rounded-sm bg-hair-2"
        >
          <span className="block h-full w-[55%] rounded-sm bg-lime" />
        </div>
      </div>
    </MobileShell>
  );
}
