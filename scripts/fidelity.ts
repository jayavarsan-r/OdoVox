import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

/**
 * GATE B — design fidelity.
 *
 *   pnpm shots:fidelity            every mapped frame
 *   pnpm shots:fidelity v9-07      one frame
 *
 * Compares the v9 reference against the React implementation on a SHARED 370x824
 * canvas, and emits four things per frame: a pixel diff, a side-by-side composite,
 * a structural criteria report, and the frame's deviations.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE:
 *   A low pixel-diff percentage is NOT an acceptance criterion. A screen can be 2%
 *   different and still carry the wrong interaction model — that is exactly what
 *   happened to /role, which was called "frame 07" while having a mascot the frame
 *   lacks and tap-to-navigate where the frame has select-then-confirm.
 *
 *   So every criterion below starts UNREVIEWED, and UNREVIEWED blocks. The pixel diff
 *   informs the review; it never substitutes for it.
 */

const ROOT = process.cwd();
const SHOTS = join(ROOT, "docs", "migration", "screenshots");
const REF = join(SHOTS, "v9-reference");
const IMPL = join(SHOTS, "impl");
const OUT = join(SHOTS, "fidelity");

/** The v9 `.screen` content box. Both sides must render at exactly this. */
const CANVAS = { width: 370, height: 824 };

/**
 * The v9 `.sb` status bar, 54px, excluded from the pixel diff.
 *
 * The frames draw a phone status bar — "9:41", a notch pill, the battery. The app never
 * draws one; the OS does. The capture already emulates the band's HEIGHT so the layouts
 * below it line up (see `SAFE_TOP` in screenshots.ts), but its CONTENT is mockup
 * furniture, and counting it would put a fixed ~6.5% of the canvas into every frame's
 * diff — noise that would then have to be explained away on every single frame.
 *
 * Excluded from the pixel count only. The side-by-side keeps the full frames, so the
 * band stays visible to a human reviewer.
 */
const STATUS_BAR = 54;

/** Rows [top, height) of a PNG, as a new PNG. */
function cropBelow(src: PNG, top: number): PNG {
  const out = new PNG({ width: src.width, height: src.height - top });
  PNG.bitblt(src, out, 0, top, src.width, src.height - top, 0, 0);
  return out;
}

/** The eight things a frame must be judged on. Pixel diff is evidence for these. */
const CRITERIA = [
  "layout",
  "typography",
  "colors",
  "component anatomy",
  "content",
  "interaction/state",
  "functionality",
  "canvas geometry",
] as const;

type Verdict = "PASS" | "FAIL" | "UNREVIEWED";

interface FrameRow {
  frame: string;
  name: string;
  section: string;
  source: string;
  reference: string;
  shot: string | null;
  route: string | null;
  task: number | null;
  accounting:
    | "MAPPED"
    | "PLANNED"
    | "CROSS-CUTTING"
    | "OUT-OF-SCOPE"
    | "UNASSIGNED";
  note: string | null;
}

/**
 * Every difference lands in exactly one class, and the class decides what may be done
 * about it. This exists so the classification is ENFORCED rather than remembered:
 *
 *   MUST-FIX            implement v9 exactly. No approval needed — fixing toward the
 *                       design is the mandate. Blocks its frame until closed.
 *   APPROVED-DEVIATION  functionality or accessibility requires something else.
 *   PRODUCT-DECISION    v9 specifies a different workflow or copy; the owner chooses.
 *   NOT-BUILT           surface or server support absent; leave until its task runs.
 *
 * The last three MUST NOT BE MODIFIED without the owner's explicit approval. That is the
 * rule that stops a migration from gradually reinterpreting its own design.
 */
type DeviationClass =
  | "MUST-FIX"
  | "APPROVED-DEVIATION"
  | "PRODUCT-DECISION"
  | "NOT-BUILT";

interface Deviation {
  id: number;
  class: DeviationClass;
  frames: string[];
  summary: string;
  /** approved / pending / revisit = owner state. open / fixed / reverted = work state. */
  status: string;
}

/**
 * Every canonical frame ends in exactly one of these. `NOT-BUILT` is deliberately a
 * REPORTED status, not an omission: the 49 state and sheet frames are product states,
 * and completion means 86 frames accounted for — never "36 routes shipped".
 */
type FrameVerdict =
  | "MATCHED"
  | "MISMATCHED"
  | "APPROVED-DEVIATION"
  | "OUT-OF-SCOPE"
  | "CROSS-CUTTING"
  | "NOT-BUILT"
  | "NOT-CAPTURED";

interface Result {
  frame: string;
  name: string;
  task: number | null;
  verdict: FrameVerdict;
  changedPct: number | null;
  geometry: string;
  criteria: Record<string, Verdict>;
  deviations: {
    id: number;
    class: DeviationClass;
    summary: string;
    status: string;
  }[];
  blockers: string[];
}

async function loadPng(path: string): Promise<PNG | null> {
  try {
    return PNG.sync.read(await readFile(path));
  } catch {
    return null;
  }
}

/** Reference | implementation, side by side, so a human can actually judge them. */
function composite(a: PNG, b: PNG): PNG {
  const gap = 24;
  const w = a.width + gap + b.width;
  const h = Math.max(a.height, b.height);
  const out = new PNG({ width: w, height: h });
  out.data.fill(0xff);
  const blit = (src: PNG, dx: number) => {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const s = (src.width * y + x) << 2;
        const d = (w * y + (x + dx)) << 2;
        out.data[d] = src.data[s]!;
        out.data[d + 1] = src.data[s + 1]!;
        out.data[d + 2] = src.data[s + 2]!;
        out.data[d + 3] = 255;
      }
    }
  };
  blit(a, 0);
  blit(b, a.width + gap);
  return out;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const filters = process.argv.slice(2);

  const frames: FrameRow[] = JSON.parse(
    await readFile(join(SHOTS, "frame-map.json"), "utf8"),
  );
  const registry: { deviations: Deviation[] } = JSON.parse(
    await readFile(join(ROOT, "docs", "migration", "deviations.json"), "utf8"),
  );

  /** Previously recorded criteria verdicts, so a review survives a re-run. */
  let prior: Record<string, Record<string, Verdict>> = {};
  try {
    prior = JSON.parse(await readFile(join(OUT, "criteria.json"), "utf8"));
  } catch {
    /* first run */
  }

  /** Why each criterion failed. A verdict letter with no reason is not a review. */
  let findings: Record<string, Record<string, string>> = {};
  try {
    findings = JSON.parse(await readFile(join(OUT, "findings.json"), "utf8"));
  } catch {
    /* optional */
  }

  const selected = filters.length
    ? frames.filter((f) => filters.some((x) => f.frame.startsWith(x)))
    : frames;

  const results: Result[] = [];

  for (const f of selected) {
    const devs = registry.deviations
      .filter((d) => d.frames.includes(f.frame) || d.frames.includes("*"))
      .map((d) => ({
        id: d.id,
        class: d.class,
        summary: d.summary,
        status: d.status,
      }));

    /** MUST-FIX items still open. These need no ruling — they need doing. */
    const openMustFix = devs.filter(
      (d) => d.class === "MUST-FIX" && d.status === "open",
    );
    /**
     * Departures awaiting the owner. Explicitly NOT to be modified meanwhile — that is
     * the whole point of the class, so the gate reports them and stops.
     */
    const awaitingRuling = devs.filter(
      (d) =>
        (d.class === "APPROVED-DEVIATION" || d.class === "PRODUCT-DECISION") &&
        (d.status === "pending" || d.status === "revisit"),
    );
    /** Absent surfaces. Not a defect the frame can be blamed for today. */
    const notBuilt = devs.filter(
      (d) => d.class === "NOT-BUILT" && d.status === "open",
    );

    const base: Omit<Result, "verdict"> = {
      frame: f.frame,
      name: f.name,
      task: f.task,
      changedPct: null,
      geometry: "—",
      criteria: Object.fromEntries(
        CRITERIA.map((c) => [c, "UNREVIEWED" as Verdict]),
      ),
      deviations: devs,
      blockers: [],
    };

    if (f.accounting === "OUT-OF-SCOPE") {
      results.push({ ...base, verdict: "OUT-OF-SCOPE" });
      continue;
    }
    if (f.accounting === "CROSS-CUTTING") {
      // A rule, not a screen. Accounted for by the tests the frame map cites.
      results.push({ ...base, verdict: "CROSS-CUTTING" });
      continue;
    }
    if (!f.shot) {
      // A product state with no way to reach it. Reported, never hidden.
      results.push({
        ...base,
        verdict: "NOT-BUILT",
        blockers: [
          f.accounting === "UNASSIGNED"
            ? "NO TASK OWNS THIS FRAME — needs an owner or an out-of-scope ruling"
            : `Task ${f.task} owns this; no route or state driver reaches it yet`,
        ],
      });
      continue;
    }

    const ref = await loadPng(join(REF, `${f.frame}.png`));
    const impl = await loadPng(join(IMPL, `${f.shot}.png`));

    if (!ref || !impl) {
      results.push({
        ...base,
        verdict: "NOT-CAPTURED",
        blockers: [
          !ref
            ? "missing reference png"
            : "missing implementation png — run pnpm shots:impl",
        ],
      });
      continue;
    }

    const geomOk =
      ref.width === CANVAS.width &&
      ref.height === CANVAS.height &&
      impl.width === CANVAS.width &&
      impl.height === CANVAS.height;
    const geometry = `ref ${ref.width}x${ref.height} · impl ${impl.width}x${impl.height}`;

    let changedPct: number | null = null;
    if (ref.width === impl.width && ref.height === impl.height) {
      const a = cropBelow(ref, STATUS_BAR);
      const b = cropBelow(impl, STATUS_BAR);
      const diff = new PNG({ width: a.width, height: a.height });
      const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
        threshold: 0.12,
        includeAA: false,
      });
      changedPct = (changed / (a.width * a.height)) * 100;
      await writeFile(join(OUT, `${f.frame}-diff.png`), PNG.sync.write(diff));
      // Side by side keeps the FULL frames, status bar included — the exclusion is a
      // measurement choice, not something to hide from the person reviewing.
      await writeFile(
        join(OUT, `${f.frame}-sbs.png`),
        PNG.sync.write(composite(ref, impl)),
      );
    }

    const criteria = { ...base.criteria, ...(prior[f.frame] ?? {}) };
    // Canvas geometry is the one criterion that IS mechanically decidable.
    criteria["canvas geometry"] = geomOk ? "PASS" : "FAIL";

    const blockers: string[] = [];
    if (!geomOk)
      blockers.push(
        `canvas mismatch (${geometry}); both sides must be 370x824`,
      );
    // MUST-FIX first: these are work, not questions, so they lead the list.
    for (const d of openMustFix)
      blockers.push(`MUST-FIX #${d.id}: ${d.summary}`);
    for (const d of awaitingRuling)
      blockers.push(`${d.class} #${d.id} — awaiting ruling: ${d.summary}`);
    for (const c of CRITERIA) {
      if (criteria[c] === "UNREVIEWED")
        blockers.push(`criterion "${c}" unreviewed`);
      if (criteria[c] === "FAIL") blockers.push(`criterion "${c}" FAILED`);
    }
    // NOT-BUILT is reported so the frame is never silently "fine", but it does not
    // block: there is no defect to fix until the surface exists.
    for (const d of notBuilt) blockers.push(`NOT-BUILT #${d.id}: ${d.summary}`);

    const blocking = blockers.filter((b) => !b.startsWith("NOT-BUILT"));

    const verdict: FrameVerdict = blocking.length
      ? "MISMATCHED"
      : devs.some(
            (d) =>
              d.status === "approved" &&
              (d.class === "APPROVED-DEVIATION" ||
                d.class === "PRODUCT-DECISION"),
          )
        ? "APPROVED-DEVIATION"
        : "MATCHED";

    results.push({
      ...base,
      verdict,
      changedPct,
      geometry,
      criteria,
      blockers,
    });
  }

  // Persist criteria so a human review survives the next run.
  const toPersist: Record<string, Record<string, Verdict>> = { ...prior };
  for (const r of results) if (r.criteria) toPersist[r.frame] = r.criteria;
  await writeFile(
    join(OUT, "criteria.json"),
    JSON.stringify(toPersist, null, 2),
  );
  await writeFile(join(OUT, "results.json"), JSON.stringify(results, null, 2));

  // ── report ────────────────────────────────────────────────────────────────
  const tally = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
    return acc;
  }, {});

  const lines: string[] = [
    "# Gate B — design fidelity report",
    "",
    "Generated by `pnpm shots:fidelity`. The v9 HTML is the visual source of truth;",
    "`screenshots/baseline/` is only the regression baseline and has no vote here.",
    "",
    "**A low pixel-diff percentage is not an acceptance criterion.** Every criterion",
    "starts UNREVIEWED and UNREVIEWED blocks. Completion is measured in FRAMES",
    `ACCOUNTED FOR (${results.length}), never in routes shipped.`,
    "",
    "| Verdict | Count |",
    "| --- | --- |",
    ...Object.entries(tally).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Classification",
    "",
    "Every difference lands in exactly one class, and the class decides what may be done",
    "about it. **PRODUCT-DECISION and APPROVED-DEVIATION items are not to be modified",
    "until the owner approves them** — that rule is what stops the migration from",
    "gradually reinterpreting its own design.",
    "",
    "| Class | Action | Blocks? |",
    "| --- | --- | --- |",
    "| MUST-FIX | implement the v9 design exactly; no approval needed | yes, until closed |",
    "| APPROVED-DEVIATION | functionality or accessibility requires it — leave alone | yes, while pending |",
    "| PRODUCT-DECISION | v9 specifies a different workflow or copy — owner chooses | yes, while pending |",
    "| NOT-BUILT | surface or server support absent — leave until its task | no |",
    "",
    "### Open MUST-FIX — work, not questions",
    "",
    ...(() => {
      const open = registry.deviations.filter(
        (d) => d.class === "MUST-FIX" && d.status === "open",
      );
      return open.length
        ? open.map(
            (d) => `- **#${d.id}** ${d.frames.join(", ")} — ${d.summary}`,
          )
        : ["_None. Every MUST-FIX item is closed._"];
    })(),
    "",
    "### Awaiting your ruling — untouched by design",
    "",
    ...registry.deviations
      .filter(
        (d) =>
          (d.class === "APPROVED-DEVIATION" ||
            d.class === "PRODUCT-DECISION") &&
          (d.status === "pending" || d.status === "revisit"),
      )
      .map(
        (d) =>
          `- **#${d.id}** \`${d.class}\` ${d.frames.join(", ")} — ${d.summary}`,
      ),
    "",
    "| Frame | Name | Task | Verdict | Pixel Δ | Blockers |",
    "| --- | --- | --- | --- | --- | --- |",
    ...results.map(
      (r) =>
        `| \`${r.frame}\` | ${r.name} | ${r.task ?? "—"} | ${r.verdict} | ${r.changedPct === null ? "—" : `${r.changedPct.toFixed(1)}%`} | ${r.blockers[0] ?? "—"} |`,
    ),
    "",
    "## Per-frame criteria",
    "",
    "Each judged frame, with its side-by-side at `screenshots/fidelity/<frame>-sbs.png`.",
    "",
    ...results
      .filter(
        (r) =>
          r.verdict === "MISMATCHED" ||
          r.verdict === "MATCHED" ||
          r.verdict === "APPROVED-DEVIATION",
      )
      .flatMap((r) => [
        `### \`${r.frame}\` — ${r.name} · ${r.verdict}`,
        "",
        `geometry: ${r.geometry} · pixel Δ ${r.changedPct === null ? "—" : `${r.changedPct.toFixed(1)}%`}`,
        "",
        ...CRITERIA.map((c) => {
          const why = findings[r.frame]?.[c];
          return `- ${c}: **${r.criteria[c]}**${why ? ` — ${why}` : ""}`;
        }),
        ...(r.deviations.length
          ? [
              "",
              ...r.deviations.map(
                (d) => `- \`${d.class}\` #${d.id} (${d.status}): ${d.summary}`,
              ),
            ]
          : []),
        "",
      ]),
  ];

  await writeFile(
    join(ROOT, "docs", "migration", "gate-b-report.md"),
    lines.join("\n"),
  );

  console.log(`\nGate B — ${results.length} frames`);
  for (const [k, v] of Object.entries(tally))
    console.log(`  ${k.padEnd(20)} ${v}`);
  const blocked = results.filter(
    (r) => r.blockers.length && r.verdict === "MISMATCHED",
  );
  if (blocked.length) {
    console.log(`\nBlocked frames (${blocked.length}):`);
    for (const r of blocked.slice(0, 12)) {
      console.log(`  ${r.frame}  ${r.blockers[0]}`);
    }
  }
  console.log(`\nReport: docs/migration/gate-b-report.md`);
  console.log(`Side-by-side + diffs: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
