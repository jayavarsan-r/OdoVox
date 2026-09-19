/**
 * The 81-frame ledger.
 *
 * Gate B reports on 86 frames: the 81 canonical v9 frames plus 5 `v10-*` screens that
 * exist in the implementation with no v9 counterpart. Completion is measured against the
 * 81 — every one of them accounted for, none silently "unmapped" — so this narrows the
 * Gate B results to exactly those and writes the per-frame ledger.
 *
 * "Mapped" is not "completed". A frame counts as done only when Gate B calls it MATCHED,
 * or APPROVED-DEVIATION with the deviation recorded and accepted. Anything still carrying
 * an open MUST-FIX or an unreviewed criterion is blocked, and says so here.
 *
 * Run: pnpm shots:frame-status   (after pnpm shots:fidelity, which writes results.json)
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const RESULTS = join(ROOT, "docs/migration/screenshots/fidelity/results.json");
const OUT = join(ROOT, "docs/migration/frame-status.json");

const CANONICAL = 81;

interface GateBResult {
  frame: string;
  name: string;
  task: number | null;
  changedPct: number | null;
  verdict: string;
  criteria: Record<string, string>;
  deviations: { id: number; class: string; status: string; summary: string }[];
  blockers: string[];
}

interface FrameStatus {
  frame: string;
  name: string;
  status: string;
  changedPct: number | null;
  gateB: string;
  openMustFix: string[];
  openDecisions: string[];
}

async function main(): Promise<void> {
  const results: GateBResult[] = JSON.parse(await readFile(RESULTS, "utf8"));

  // v10-* screens have no v9 frame to be faithful to; they are not part of the count.
  const v9 = results.filter((r) => r.frame.startsWith("v9-"));
  if (v9.length !== CANONICAL) {
    throw new Error(
      `expected ${CANONICAL} canonical v9 frames, found ${v9.length}. The frame set is ` +
        `fixed — a change here means a frame was added or dropped, not that this number ` +
        `should be edited.`,
    );
  }

  const status: FrameStatus[] = v9.map((r) => {
    const openMustFix = r.deviations.filter(
      (d) => d.class === "MUST-FIX" && d.status !== "fixed",
    );
    const openDecisions = r.deviations.filter(
      (d) =>
        (d.class === "PRODUCT-DECISION" || d.class === "APPROVED-DEVIATION") &&
        d.status === "open",
    );

    /**
     * BLOCKED is not a Gate B verdict — it is a reading of one.
     *
     * A frame carrying an unresolved PRODUCT-DECISION is not finished, whatever the pixel
     * comparison says, and it is not MISMATCHED either: the implementation may be perfect
     * and someone still has to choose between two defensible answers. BLOCKED means the
     * ball is with the owner.
     *
     * It deliberately outranks APPROVED-DEVIATION. Gate B can pass every criterion while a
     * product question on that same frame is open — which is how a frame gets counted
     * COMPLETE on the strength of a judgement nobody with the authority to make it ever
     * made. An open MUST-FIX still wins, because then the code is simply wrong.
     */
    const blocked =
      openMustFix.length === 0 &&
      openDecisions.some((d) => d.class === "PRODUCT-DECISION");

    return {
      frame: r.frame,
      name: r.name,
      status: blocked ? "BLOCKED" : r.verdict,
      changedPct: r.changedPct,
      gateB: r.verdict,
      openMustFix: openMustFix.map((d) => `#${d.id}: ${d.summary}`),
      openDecisions: openDecisions.map((d) => `#${d.id}: ${d.summary}`),
    };
  });

  await writeFile(OUT, `${JSON.stringify(status, null, 2)}\n`);

  const tally = new Map<string, number>();
  for (const s of status) tally.set(s.status, (tally.get(s.status) ?? 0) + 1);

  const done =
    (tally.get("MATCHED") ?? 0) + (tally.get("APPROVED-DEVIATION") ?? 0);

  /** Fixed order, and every bucket printed even at zero — a missing line reads as an
   *  oversight, and the counts have to be seen to sum to 81. */
  const ORDER = [
    "MATCHED",
    "APPROVED-DEVIATION",
    "MISMATCHED",
    "BLOCKED",
    "NOT-BUILT",
    "NOT-CAPTURED",
    "CROSS-CUTTING",
    "OUT-OF-SCOPE",
  ];
  for (const k of ORDER) if (!tally.has(k)) tally.set(k, 0);

  console.log(`\n81-frame ledger → ${OUT}\n`);
  for (const [k, v] of [...tally].sort(
    (a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]),
  )) {
    console.log(`  ${k.padEnd(20)} ${String(v).padStart(3)}`);
  }
  const total = [...tally.values()].reduce((a, b) => a + b, 0);
  console.log(`  ${"—".padEnd(20)} ${String(total).padStart(3)}`);
  console.log(
    `\n  COMPLETED (matched or approved-deviation): ${done} / ${CANONICAL}`,
  );
}

void main();
