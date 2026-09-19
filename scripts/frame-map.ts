import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SHOTS } from "./screenshot-routes.js";
import type { ReferenceFrame } from "./v9-reference.js";

/**
 * Builds the canonical frame map:
 *
 *   Frame ID -> HTML source -> owning task -> React route -> reference png -> impl png
 *
 * Every one of the 86 design frames appears exactly once and carries an ACCOUNTING —
 * there is no "unmapped" bucket, because "unmapped" reads as "optional" and these are
 * real product states. A frame is one of:
 *
 *   MAPPED        a shot renders it; Gate B can judge it
 *   PLANNED       a plan task owns it, but nothing captures it yet
 *   CROSS-CUTTING a contract frame (orb, toasts, tap rules) validated by unit tests
 *                 and by the frames that embody it, not by one screenshot
 *   OUT-OF-SCOPE  explicitly ruled out by the owner
 *   UNASSIGNED    no shot AND no task owns it — a hole in the PLAN, not just the code
 *
 * UNASSIGNED is the status this rewrite exists to surface. Ownership is parsed from
 * the plan's own task headings rather than hand-listed here, so a frame cannot be
 * quietly dropped by editing a table in this file.
 *
 *   pnpm shots:map
 */

const ROOT = process.cwd();
const SHOTS_DIR = join(ROOT, "docs", "migration", "screenshots");
const PLAN = join(
  ROOT,
  "docs",
  "superpowers",
  "plans",
  "2026-08-08-ui-migration-v9-v10-plan.md",
);

/**
 * Frame -> shot slug. Only records mappings that are REAL: a frame is mapped when a
 * route exists that is meant to render it. Frames whose surface does not exist yet
 * are deliberately absent, so the generated map accounts for them as PLANNED.
 */
const FRAME_TO_SHOT: Record<string, string> = {
  "v9-01": "A1-splash",
  "v9-02": "A2-welcome",
  "v9-03": "A3-phone",
  "v9-04": "A4-otp",
  "v9-05": "A5-otp-error",
  "v9-07": "B1-role",
  "v9-08": "B3-create-1",
  "v9-09": "B6-join",
  "v9-11": "B7-done",
  "v9-13": "C1-home-inchair",
  "v9-21": "D1-consult",
  "v9-23": "D2-recording",
  "v9-24": "D3-paused",
  "v9-25": "D4-processing",
  "v9-26": "D5-failed",
  // 30 is the clean verification state — the one the harness reaches with ordinary seed
  // data. 27/28 (allergy conflict, then resolved) needed clinical data that only existed if
  // the doctor dictated it; the seeded demo recordings supply it now, so both are reached
  // through the real pipeline (deviation #55, resolved). 29 (seven medicines) still needs
  // its demo patient put in the chair by the driver.
  "v9-27": "D9-verify-conflict",
  "v9-28": "D10-verify-resolved",
  "v9-30": "D6-verify",
  "v9-31": "D7-saved",
  "v9-32": "E1-patients",
  "v9-33": "E2-search",
  "v9-34": "E3-search-no-match",
  "v9-35": "E4-new-patient",
  "v9-36": "E5-new-patient-voiced",
  "v9-37": "E6-patient-overview",
  "v9-38": "E7-patient-cases",
  "v9-39": "E11-case-detail",
  "v9-40": "E8-patient-teeth",
  "v9-41": "E10-patient-billing",
  "v9-42": "E12-patient-history",
  "v9-46": "G1-schedule-day",
  "v9-47": "G2-schedule-multi",
  "v9-50": "H1-today",
  "v9-54": "H5-billing",
  "v9-55": "H6-outstanding",
  "v9-56": "I1-lab",
  "v9-58": "I3-lab-case",
  "v9-59": "I4-lab-new",
  "v9-61": "I6-vendors",
  "v9-62": "J1-messages",
  "v9-65": "J4-lab-inbox",
  "v9-67": "K1-inventory",
  "v9-68": "K2-item",
  "v9-70": "L1-more",
  "v9-72": "L3-whatsapp",
  "v9-73": "L4-availability",
  "v9-74": "L5-dayoff",
  "v9-75": "L6-templates",
};

/** Explicitly ruled out by the owner. */
const OUT_OF_SCOPE: Record<string, string> = {
  "v9-06": "Device unlock — WebAuthn descoped by the owner; PIN deferred",
};

/**
 * Contract frames. These document a RULE that applies across the app rather than one
 * screen, so a single screenshot cannot validate them — the rule is validated by the
 * cited tests plus every frame that obeys it.
 */
const CROSS_CUTTING: Record<string, string> = {
  "v9-78":
    "Orb tap/hold contract — validated by lib/ds/orb.ts tests + every frame carrying the dock",
  "v9-79":
    "The three toast voices — validated by lib/ds/toast-voice.ts tests + lib/toast.ts",
  "v9-81":
    "The tap contract (what tap / hold / long-press mean) — validated by the interaction criterion on every frame",
};

/**
 * Parses `## Task 14: Home / Flow states — frames 14–18` into frame ownership.
 * Handles `frames 14–18`, `frames 62–65, 67–69`, `frame 70`, `frames v10-01 … v10-05`.
 */
function parsePlanOwnership(plan: string): Record<string, number> {
  const owner: Record<string, number> = {};
  const heading = /^## Task (\d+):.*?(?:—|-)\s*(frames?\s+.*)$/gim;

  for (const m of plan.matchAll(heading)) {
    const task = Number(m[1]);
    const spec = m[2]!;
    // Normalise the three dash characters the plan mixes, then read ranges and singles.
    const norm = spec.replace(/[–—…]/g, "-").replace(/\s*-\s*/g, "-");
    const token = /(v10-)?(\d{2})(?:-(?:v10-)?(\d{2}))?/g;
    for (const t of norm.matchAll(token)) {
      const prefix = t[1] ? "v10" : "v9";
      const from = Number(t[2]);
      const to = t[3] ? Number(t[3]) : from;
      if (to < from) continue;
      for (let n = from; n <= to; n++) {
        owner[`${prefix}-${String(n).padStart(2, "0")}`] ??= task;
      }
    }
  }
  return owner;
}

type Accounting =
  | "MAPPED"
  | "PLANNED"
  | "CROSS-CUTTING"
  | "OUT-OF-SCOPE"
  | "UNASSIGNED";

interface Row {
  frame: string;
  name: string;
  section: string;
  source: string;
  reference: string;
  shot: string | null;
  route: string | null;
  role: string | null;
  state: string;
  task: number | null;
  accounting: Accounting;
  note: string | null;
  /** Kept for consumers written against the first version of this map. */
  status: "mapped" | "out-of-scope" | "cross-cutting" | "pending";
}

async function main() {
  const manifest: ReferenceFrame[] = JSON.parse(
    await readFile(join(SHOTS_DIR, "v9-reference", "manifest.json"), "utf8"),
  );
  const ownership = parsePlanOwnership(await readFile(PLAN, "utf8"));

  const rows: Row[] = manifest.map((f) => {
    const slug = FRAME_TO_SHOT[f.id] ?? null;
    const shot = slug ? SHOTS.find((s) => s.slug === slug) : undefined;
    const task = ownership[f.id] ?? null;

    let accounting: Accounting;
    let note: string | null = null;
    if (OUT_OF_SCOPE[f.id]) {
      accounting = "OUT-OF-SCOPE";
      note = OUT_OF_SCOPE[f.id]!;
    } else if (CROSS_CUTTING[f.id]) {
      accounting = "CROSS-CUTTING";
      note = CROSS_CUTTING[f.id]!;
    } else if (slug) {
      accounting = "MAPPED";
    } else if (task !== null) {
      accounting = "PLANNED";
      note = `Task ${task} builds and captures this`;
    } else {
      accounting = "UNASSIGNED";
      note = "NO TASK OWNS THIS FRAME — the plan has a hole here";
    }

    return {
      frame: f.id,
      name: f.name,
      section: f.section,
      source: f.source,
      reference: `v9-reference/${f.png}`,
      shot: slug,
      route: shot?.path ?? null,
      role: shot?.role ?? null,
      // v9 draws each state as its OWN frame, so the frame IS the state. What varies
      // is whether the React side can be driven into it.
      state: shot?.prepare ? "driven (prepare step)" : shot ? "default" : "—",
      task,
      accounting,
      note,
      status:
        accounting === "MAPPED"
          ? "mapped"
          : accounting === "OUT-OF-SCOPE"
            ? "out-of-scope"
            : accounting === "CROSS-CUTTING"
              ? "cross-cutting"
              : "pending",
    };
  });

  await writeFile(
    join(SHOTS_DIR, "frame-map.json"),
    JSON.stringify(rows, null, 2),
  );

  const by = (a: Accounting) => rows.filter((r) => r.accounting === a);
  const unassigned = by("UNASSIGNED");

  const md = [
    "# Frame map — design frame → owning task → implementation",
    "",
    "Generated by `pnpm shots:map`. Do not edit by hand.",
    "",
    `**${manifest.length} canonical frames, each accounted for.** There is no "unmapped"`,
    'bucket: "unmapped" reads as "optional", and these are real product states.',
    "",
    "| Accounting | Meaning | Count |",
    "| --- | --- | --- |",
    `| MAPPED | a shot renders it; Gate B can judge it | ${by("MAPPED").length} |`,
    `| PLANNED | a plan task owns it; nothing captures it yet | ${by("PLANNED").length} |`,
    `| CROSS-CUTTING | a contract validated by tests, not one screenshot | ${by("CROSS-CUTTING").length} |`,
    `| OUT-OF-SCOPE | explicitly ruled out by the owner | ${by("OUT-OF-SCOPE").length} |`,
    `| **UNASSIGNED** | **no shot and no task — a hole in the plan** | **${unassigned.length}** |`,
    "",
    ...(unassigned.length
      ? [
          "## ⚠ Unassigned frames",
          "",
          "No task in the plan builds these. They are product states, so they need either",
          "an owning task or an explicit out-of-scope ruling — not silence.",
          "",
          ...unassigned.map(
            (r) => `- \`${r.frame}\` — ${r.name} (${r.section})`,
          ),
          "",
        ]
      : []),
    "| Frame | Name | Source | Task | Route | Role | Accounting |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| \`${r.frame}\` | ${r.name} | ${r.source.replace("odovox-", "").replace(".html", "")} | ${r.task ?? "—"} | ${r.route ? `\`${r.route}\`` : "—"} | ${r.role ?? "—"} | ${r.accounting} |`,
    ),
  ].join("\n");

  await writeFile(join(ROOT, "docs", "migration", "frame-map.md"), md);

  console.log(`${manifest.length} frames, all accounted for:`);
  for (const a of [
    "MAPPED",
    "PLANNED",
    "CROSS-CUTTING",
    "OUT-OF-SCOPE",
    "UNASSIGNED",
  ] as const) {
    console.log(`  ${a.padEnd(14)} ${by(a).length}`);
  }
  if (unassigned.length) {
    console.log(`\n⚠ No task owns these frames:`);
    for (const r of unassigned) console.log(`  ${r.frame}  ${r.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
