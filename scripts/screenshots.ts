import {
  chromium,
  devices,
  request as pwRequest,
  type BrowserContext,
} from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { SESSIONS, active, type Role, type Shot } from "./screenshot-routes.js";

/**
 * Capture the UI-migration screenshot set.
 *
 *   pnpm shots:baseline            capture ALL active shots into baseline/
 *   pnpm shots:current             capture ALL active shots into current/
 *   pnpm shots:current E1 C1       capture only slugs starting with E1 / C1
 *
 * Requires the dev stack up with the mock OTP:
 *   docker compose up -d && pnpm db:migrate && pnpm db:seed
 *   OTP_PROVIDER=mock pnpm dev
 *
 * The spec's phone frame is 390x844 — identical to Playwright's iPhone 13 — so
 * captures compare 1:1 against the design frames with no scaling.
 */

const WEB = process.env.SHOTS_WEB_URL ?? "http://localhost:3000";
const API = process.env.SHOTS_API_URL ?? "http://localhost:4000";
const MOCK_OTP = process.env.SHOTS_OTP ?? "123456";
const OUT_ROOT = join(process.cwd(), "docs", "migration", "screenshots");
/** Pace requests under the API's 100 req/min per-IP limit. */
const SHOT_DELAY_MS = Number(process.env.SHOTS_DELAY_MS ?? 1500);
const RATE_WINDOW_MS = Number(process.env.SHOTS_RATE_WINDOW_MS ?? 62_000);

const mode = (process.argv[2] ?? "current") as "baseline" | "current";
const filters = process.argv.slice(3);

type Cookies = Parameters<BrowserContext["addCookies"]>[0];

const SESSION_CACHE = join(OUT_ROOT, ".sessions.json");

/**
 * Sessions are cached between runs on purpose.
 *
 * `/auth/otp/request` is capped at FIVE PER HOUR PER PHONE via a Redis counter
 * (routes/auth.ts) — a cap that a few debug runs exhaust, after which every run 429s
 * for the next hour regardless of how long you wait. Refresh tokens outlive that
 * window, so reusing them keeps the harness usable. `SHOTS_RELOGIN=1` forces fresh.
 */
async function readCache(): Promise<Record<string, Cookies>> {
  if (process.env.SHOTS_RELOGIN === "1") return {};
  try {
    return JSON.parse(await readFile(SESSION_CACHE, "utf8"));
  } catch {
    return {};
  }
}

async function login(
  role: Exclude<Role, "anon">,
  attempt = 0,
): Promise<Cookies> {
  const cache = await readCache();
  const cached = cache[role];
  if (cached?.length) return cached;

  const { phone } = SESSIONS[role];
  const ctx = await pwRequest.newContext({ baseURL: API });
  const req = await ctx.post("/auth/otp/request", { data: { phone } });
  if (req.status() === 429 && attempt < 2) {
    await ctx.dispose();
    console.log(
      `  … otp/request rate-limited for ${role} — note the cap is 5/HOUR/phone, ` +
        `so this may not clear by waiting. Retrying once.`,
    );
    await new Promise((res) => setTimeout(res, RATE_WINDOW_MS));
    return login(role, attempt + 1);
  }
  if (!req.ok())
    throw new Error(`otp/request failed for ${phone}: ${req.status()}`);
  const verify = await ctx.post("/auth/otp/verify", {
    data: { phone, otp: MOCK_OTP },
  });
  if (!verify.ok()) {
    throw new Error(
      `otp/verify failed for ${phone}: ${verify.status()} — is OTP_PROVIDER=mock set?`,
    );
  }
  const { cookies } = await ctx.storageState();
  await ctx.dispose();

  const cache2 = await readCache();
  cache2[role] = cookies;
  await writeFile(SESSION_CACHE, JSON.stringify(cache2, null, 2));
  return cookies;
}

/** Freeze anything that would make two captures of an unchanged page differ. */
async function stabilise(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    // Pin the clock so relative times ("2m ago") don't drift between runs.
    const FIXED = new Date("2026-07-13T09:41:00+05:30").getTime();
    const RealDate = Date;
    class PinnedDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        args.length ? super(...args) : super(FIXED);
      }
      static now() {
        return FIXED;
      }
    }
    globalThis.Date = PinnedDate as DateConstructor;
    // Dismiss the dev banner — it is 24px of dev-only chrome that shifts every page
    // down and would pollute every diff. Uses the component's own dismissal key, so
    // no app change is needed.
    try {
      sessionStorage.setItem("odovox-dev-banner-dismissed", "1");
    } catch {
      /* storage unavailable — banner just stays, still deterministic */
    }
    // Kill animations so a capture is never mid-transition.
    const style = document.createElement("style");
    style.textContent = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`;
    document.documentElement.appendChild(style);
  });
}

/**
 * Console noise that is the app working as designed, not a defect.
 * api-client fires a request, takes a 401, silently refreshes and retries — so every
 * authenticated page load logs exactly one 401. Reporting it would bury real errors.
 */
const BENIGN = [/Failed to load resource.*401 \(Unauthorized\)/];

async function capture(ctx: BrowserContext, shot: Shot, outDir: string) {
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (!BENIGN.some((re) => re.test(text))) consoleErrors.push(text);
  });
  try {
    await page.goto(`${WEB}${shot.path}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    // An expired session bounces to /welcome. Without this guard the run "succeeds"
    // while every authenticated shot silently captures the sign-in screen — the same
    // plausible-but-wrong failure openFirstRow guards against.
    if (
      shot.role !== "anon" &&
      /\/(welcome|phone|otp)(\?|$)/.test(page.url())
    ) {
      throw new Error(
        `bounced to ${new URL(page.url()).pathname} — session invalid. ` +
          `Re-run with SHOTS_RELOGIN=1.`,
      );
    }
    if (shot.prepare) await shot.prepare(page);
    await page.waitForTimeout(500); // let the last layout settle
    await page.screenshot({ path: join(outDir, `${shot.slug}.png`) });
    return { slug: shot.slug, ok: true as const, consoleErrors };
  } catch (err) {
    return {
      slug: shot.slug,
      ok: false as const,
      error: String(err),
      consoleErrors,
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const outDir = join(OUT_ROOT, mode);
  await mkdir(outDir, { recursive: true });

  let shots = active();
  if (filters.length)
    shots = shots.filter((s) => filters.some((f) => s.slug.startsWith(f)));
  if (!shots.length) {
    console.error(`No shots matched ${filters.join(", ")}`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const results: Awaited<ReturnType<typeof capture>>[] = [];

  for (const role of ["anon", "doctor", "receptionist"] as const) {
    const group = shots.filter((s) => s.role === role);
    if (!group.length) continue;

    const ctx = await browser.newContext({
      ...devices["iPhone 13"], // 390x844 — the spec's exact frame size
      baseURL: WEB,
    });
    await stabilise(ctx);
    if (role !== "anon") await ctx.addCookies(await login(role));

    for (const shot of group) {
      let r = await capture(ctx, shot, outDir);

      // The API allows 100 req/min per IP (plugins/rate-limit.ts) and each page load
      // costs several calls, so a full run WILL trip the limiter. Rather than weaken
      // the app's limiter for a dev tool, wait out the window and retry once.
      const rateLimited =
        !r.ok || r.consoleErrors.some((e) => e.includes("429"));
      if (rateLimited) {
        console.log(`  … ${shot.slug} rate-limited, waiting out the window`);
        await new Promise((res) => setTimeout(res, RATE_WINDOW_MS));
        r = await capture(ctx, shot, outDir);
      }

      results.push(r);
      const mark = r.ok ? "✓" : "✗";
      const noise = r.consoleErrors.length
        ? `  (${r.consoleErrors.length} console errors)`
        : "";
      console.log(`  ${mark} ${r.slug}${noise}`);
      await new Promise((res) => setTimeout(res, SHOT_DELAY_MS));
    }
    await ctx.close();
  }
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  const noisy = results.filter((r) => r.consoleErrors.length);

  await writeFile(
    join(OUT_ROOT, `${mode}-run.json`),
    JSON.stringify({ mode, at: new Date().toISOString(), results }, null, 2),
  );

  console.log(
    `\n${results.length - failed.length}/${results.length} captured → ${outDir}`,
  );
  if (noisy.length) {
    console.log(`\n⚠ console errors (governance §3 requires zero):`);
    for (const n of noisy) console.log(`  ${n.slug}: ${n.consoleErrors[0]}`);
  }
  if (failed.length) {
    console.error(`\n✗ failed:`);
    for (const f of failed)
      console.error(`  ${f.slug}: ${"error" in f ? f.error : ""}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
