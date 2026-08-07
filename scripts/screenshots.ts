import {
  chromium,
  devices,
  request as pwRequest,
  type BrowserContext,
} from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
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

const mode = (process.argv[2] ?? "current") as "baseline" | "current";
const filters = process.argv.slice(3);

/** Log in over the API and return the refresh cookie the web app bootstraps from. */
async function login(role: Exclude<Role, "anon">) {
  const { phone } = SESSIONS[role];
  const ctx = await pwRequest.newContext({ baseURL: API });
  const req = await ctx.post("/auth/otp/request", { data: { phone } });
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
    // Kill animations so a capture is never mid-transition.
    const style = document.createElement("style");
    style.textContent = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`;
    document.documentElement.appendChild(style);
  });
}

async function capture(ctx: BrowserContext, shot: Shot, outDir: string) {
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  page.on(
    "console",
    (m) => m.type() === "error" && consoleErrors.push(m.text()),
  );
  try {
    await page.goto(`${WEB}${shot.path}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
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
      const r = await capture(ctx, shot, outDir);
      results.push(r);
      const mark = r.ok ? "✓" : "✗";
      const noise = r.consoleErrors.length
        ? `  (${r.consoleErrors.length} console errors)`
        : "";
      console.log(`  ${mark} ${r.slug}${noise}`);
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
