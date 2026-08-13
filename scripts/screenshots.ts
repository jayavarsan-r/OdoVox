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

/**
 * baseline / current -> GATE A (regression), 390x844, the real device viewport.
 * fidelity           -> GATE B (design), 370x824, the v9 `.screen` canvas.
 *
 * 370x824 is a TEST FIXTURE ONLY. Production ships at 390x844; the v9 tokens are
 * never scaled to compensate. The fixture exists so reference and implementation
 * share a canvas and a pixel diff means something.
 */
const mode = (process.argv[2] ?? "current") as
  | "baseline"
  | "current"
  | "fidelity";

/** The v9 `.screen` content box, measured: .phone 390x844 minus its 10px bezel. */
const FIDELITY_VIEWPORT = { width: 370, height: 824 };
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
  /** Skip the cache — used when a rotated token has invalidated the cached session. */
  force = false,
): Promise<Cookies> {
  const cache = await readCache();
  const cached = cache[role];
  if (cached?.length && !force) return cached;

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

  // Merge into whatever is on disk rather than into readCache()'s result: under
  // SHOTS_RELOGIN that returns {}, so writing it back would evict the OTHER role's
  // still-valid session and force an unnecessary login (and OTP spend) next run.
  let onDisk: Record<string, Cookies> = {};
  try {
    onDisk = JSON.parse(await readFile(SESSION_CACHE, "utf8"));
  } catch {
    /* first run */
  }
  onDisk[role] = cookies;
  await writeFile(SESSION_CACHE, JSON.stringify(onDisk, null, 2));
  return cookies;
}

/**
 * The v9 `.sb` status bar, measured from the spec: `.sb{height:54px}`.
 *
 * The app already reserves this space — `MobileShell` pads by `--safe-top`, which is
 * `env(safe-area-inset-top)`. On a phone that is ~54px; in a desktop browser it is 0.
 * So the frames draw a band the app also has on device but not under test, and without
 * emulating it every element sits 54px higher than the frame it is being judged against.
 * Emulating it makes the fixture behave like the device the frames depict — it is not a
 * change to the design system, and production is untouched.
 */
const SAFE_TOP = 54;

/**
 * Freeze anything that would make two captures of an unchanged page differ.
 *
 * Passed as SOURCE TEXT, not as a function. tsx compiles this file with esbuild, and a
 * `class PinnedDate extends Date` in a function handed to `addInitScript` came back
 * downlevelled to a helper that does not exist in the browser — so the whole script threw
 * on its first line and silently did nothing. Every screenshot ever taken therefore ran
 * with a LIVE clock, animations enabled, and the dev banner showing. A string cannot be
 * rewritten on the way out, which is the point.
 */
function stabiliseSource(): string {
  return `
(function () {
  // Pin the clock so relative times ("2m ago") don't drift between runs.
  var FIXED = new Date("2026-07-13T09:41:00+05:30").getTime();
  var RealDate = Date;
  function PinnedDate() {
    if (arguments.length === 0) return new RealDate(FIXED);
    return new (Function.prototype.bind.apply(RealDate, [null].concat([].slice.call(arguments))))();
  }
  PinnedDate.prototype = RealDate.prototype;
  PinnedDate.now = function () { return FIXED; };
  PinnedDate.parse = RealDate.parse;
  PinnedDate.UTC = RealDate.UTC;
  window.Date = PinnedDate;

  // The banner's own dismissal key. Belt to the stylesheet's braces: this stops it ever
  // rendering, the CSS stops it showing if this fails.
  try { sessionStorage.setItem("odovox-dev-banner-dismissed", "1"); } catch (e) {}
})();
`;
}

/**
 * The stylesheet, applied AFTER navigation rather than at init.
 *
 * Next replaces `<head>` during hydration in dev, which silently deleted a style tag
 * injected at document-start — the probe found two style tags left, neither of them ours.
 * `addStyleTag` runs post-hydration, so it survives.
 */
function stabiliseCss(emulateSafeArea: boolean): string {
  return [
    // Never capture mid-transition.
    `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`,
    // Dev-only chrome. `nextjs-portal` is a custom element with a shadow root; hiding the
    // host hides the indicator inside it.
    `[data-dev-chrome],nextjs-portal,#__next-build-watcher{display:none!important}`,
    ...(emulateSafeArea ? [`:root{--safe-top:${SAFE_TOP}px!important}`] : []),
  ].join("\n");
}

async function stabilise(ctx: BrowserContext) {
  await ctx.addInitScript({ content: stabiliseSource() });
}

/**
 * Console noise that is the app working as designed, not a defect.
 * api-client fires a request, takes a 401, silently refreshes and retries — so every
 * authenticated page load logs exactly one 401. Reporting it would bury real errors.
 */
const BENIGN = [/Failed to load resource.*401 \(Unauthorized\)/];

async function capture(
  ctx: BrowserContext,
  shot: Shot,
  outDir: string,
  css: string,
) {
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (!BENIGN.some((re) => re.test(text))) {
      consoleErrors.push(text);
      if (process.env.SHOTS_VERBOSE) console.log(`    [console] ${text.slice(0, 300)}`);
    }
  });
  try {
    if (shot.transient) {
      // Hold the screen still. The splash routes away the moment /auth/refresh settles —
      // either outcome redirects — so neither fulfilling nor aborting the call keeps it
      // on screen. Leaving the request hanging does, and the hanging state IS the state
      // frame 01 draws: Odo plus the progress hairline, mid-token-exchange.
      await page.route(`${API}/auth/**`, () => {});
    }
    await page.goto(`${WEB}${shot.path}`, {
      // A transient screen redirects the instant its network settles, so waiting for
      // networkidle guarantees capturing the NEXT screen instead.
      waitUntil: shot.transient ? "domcontentloaded" : "networkidle",
      timeout: 30_000,
    });
    // Landing somewhere other than the requested path means a redirect happened, and
    // the shot is now of a different screen than its slug claims. This applies to
    // ANON shots too: /otp reads its number from the onboarding store, not the URL,
    // so visiting it directly bounces to /phone — which silently produced a "phone"
    // screenshot labelled A4-otp for the entire baseline before this check existed.
    //
    // `prepare` steps are allowed to navigate deliberately, so only the pre-prepare
    // landing is checked.
    const landed = new URL(page.url()).pathname;
    const wanted = new URL(shot.path, WEB).pathname;
    if (!shot.transient && landed !== wanted) {
      throw new Error(
        `redirected ${wanted} -> ${landed}. The shot would not be of the screen its ` +
          `slug names.` +
          (shot.role !== "anon"
            ? " If the session expired, re-run with SHOTS_RELOGIN=1."
            : ""),
      );
    }
    await page.addStyleTag({ content: css });
    if (shot.prepare) await shot.prepare(page);
    // A prepare step can navigate, and a client-side route change re-renders the head —
    // so re-apply rather than assume the first tag survived.
    await page.addStyleTag({ content: css });
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
  const outDir = join(OUT_ROOT, mode === "fidelity" ? "impl" : mode);
  await mkdir(outDir, { recursive: true });

  let shots = active();
  if (filters.length)
    shots = shots.filter((s) => filters.some((f) => s.slug.startsWith(f)));
  if (!shots.length) {
    console.error(`No shots matched ${filters.join(", ")}`);
    process.exit(1);
  }

  /**
   * Fake media so the recording states (frames 23-26) can be driven through the REAL
   * application rather than mocked. Chromium synthesises a microphone, `getUserMedia`
   * resolves, MediaRecorder runs, and the consult store walks its actual state machine.
   *
   * This is a HARNESS capability only — no production code is aware of it, and no state
   * is faked: the screenshots show the app's own states, reached the way a doctor
   * reaches them.
   */
  const browser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-capture",
    ],
  });
  const results: Awaited<ReturnType<typeof capture>>[] = [];
  const css = stabiliseCss(mode === "fidelity");

  for (const role of ["anon", "doctor", "receptionist"] as const) {
    const group = shots.filter((s) => s.role === role);
    if (!group.length) continue;

    const ctx = await browser.newContext({
      ...devices["iPhone 13"],
      permissions: ["microphone"],
      ...(mode === "fidelity"
        ? { viewport: FIDELITY_VIEWPORT, deviceScaleFactor: 1 }
        : {}),
      baseURL: WEB,
    });
    await stabilise(ctx);
    if (role !== "anon") await ctx.addCookies(await login(role));

    let reloggedIn = false;

    for (const shot of group) {
      let r = await capture(ctx, shot, outDir, css);

      // The app ROTATES its refresh token on every /auth/refresh, so a cached cookie
      // dies as soon as a previous run used it. That is inherent to the auth design,
      // not an anomaly — so heal instead of failing: drop the cached session, log in
      // once more, and retry. Only once per role, so a genuinely broken login still
      // surfaces as a failure rather than looping.
      //
      // An expired session shows up as a BOUNCE TO /welcome, not as the words "session
      // invalid" — the heal condition only matched the latter, so a whole authenticated
      // run once burned 29 minutes retrying a login it never attempted. Match both.
      if (
        !r.ok &&
        role !== "anon" &&
        !reloggedIn &&
        /session invalid|-> \/welcome/.test(r.error ?? "")
      ) {
        console.log(
          `  … ${shot.slug}: session rotated, re-authenticating ${role}`,
        );
        reloggedIn = true;
        await ctx.clearCookies();
        await ctx.addCookies(await login(role, 0, true));
        r = await capture(ctx, shot, outDir, css);
      }

      // The API allows 100 req/min per IP (plugins/rate-limit.ts) and each page load
      // costs several calls, so a full run WILL trip the limiter. Rather than weaken
      // the app's limiter for a dev tool, wait out the window and retry once.
      const rateLimited =
        !r.ok || r.consoleErrors.some((e) => e.includes("429"));
      if (rateLimited) {
        console.log(`  … ${shot.slug} rate-limited, waiting out the window`);
        await new Promise((res) => setTimeout(res, RATE_WINDOW_MS));
        r = await capture(ctx, shot, outDir, css);
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
