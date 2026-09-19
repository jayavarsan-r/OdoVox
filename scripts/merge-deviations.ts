import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Fold per-block deviation fragments into `deviations.json`.
 *
 * `deviations.json` is the migration's single ledger, and it is the one file every parallel
 * implementer wants to append to at once. Letting them do that directly produces a merge
 * conflict on every block, in a file where a botched resolution silently loses an owner
 * ruling — the worst possible place for one.
 *
 * So implementers never open it. Each writes `docs/migration/deviations.d/<block>.json`, a
 * plain array of deviation objects, and this folds them in. Fragments touch different files,
 * so they merge cleanly; the ledger is rebuilt here, once, by one process.
 *
 *   pnpm dev:merge          fold every fragment in and rewrite the ledger
 *   pnpm dev:merge --check  verify without writing (CI / pre-merge)
 */

const ROOT = process.cwd();
const LEDGER = join(ROOT, "docs", "migration", "deviations.json");
const FRAGMENTS = join(ROOT, "docs", "migration", "deviations.d");

const CLASSES = new Set([
  "MUST-FIX",
  "APPROVED-DEVIATION",
  "PRODUCT-DECISION",
  "NOT-BUILT",
  "NOT-CAPTURED",
]);

interface Deviation {
  id: number;
  class: string;
  frames: string[];
  summary: string;
  reason: string;
  status: string;
  [k: string]: unknown;
}

/** Every way a fragment can be wrong, reported together rather than one per run. */
function validate(
  rows: Deviation[],
  source: string,
  seen: Map<number, string>,
) {
  const errors: string[] = [];
  for (const r of rows) {
    const where = `${source} #${r.id ?? "?"}`;
    if (typeof r.id !== "number")
      errors.push(`${where}: missing numeric \`id\``);
    else if (seen.has(r.id))
      errors.push(
        `${where}: id already claimed by ${seen.get(r.id)}. Ids are global — ` +
          `take the next free one from the ledger, do not restart at 1 per block.`,
      );
    else seen.set(r.id, source);

    if (!CLASSES.has(r.class))
      errors.push(
        `${where}: class "${r.class}" is not one of ${[...CLASSES].join(", ")}`,
      );
    if (!Array.isArray(r.frames) || r.frames.length === 0)
      errors.push(`${where}: \`frames\` must list at least one frame`);
    if (!r.summary?.trim()) errors.push(`${where}: \`summary\` is empty`);
    if (!r.reason?.trim())
      errors.push(
        `${where}: \`reason\` is empty. A deviation without its reasoning is a ` +
          `note nobody can review or reverse.`,
      );
  }
  return errors;
}

async function main() {
  const check = process.argv.includes("--check");
  const ledger = JSON.parse(await readFile(LEDGER, "utf8")) as {
    deviations: Deviation[];
  };

  const seen = new Map<number, string>();
  for (const r of ledger.deviations) seen.set(r.id, "deviations.json");

  if (!existsSync(FRAGMENTS)) {
    process.stdout.write("no deviations.d/ — nothing to merge\n");
    return;
  }

  const files = (await readdir(FRAGMENTS)).filter((f) => f.endsWith(".json"));
  const errors: string[] = [];
  const added: Deviation[] = [];

  for (const f of files.sort()) {
    const rows = JSON.parse(
      await readFile(join(FRAGMENTS, f), "utf8"),
    ) as Deviation[];
    if (!Array.isArray(rows)) {
      errors.push(`${f}: expected a top-level array of deviations`);
      continue;
    }
    errors.push(...validate(rows, f, seen));
    added.push(...rows);
    process.stdout.write(`  ${f}: ${rows.length}\n`);
  }

  if (errors.length > 0) {
    process.stderr.write("\ndeviation fragments rejected:\n");
    for (const e of errors) process.stderr.write(`  ✗ ${e}\n`);
    process.exit(1);
  }

  if (check) {
    process.stdout.write(
      `\n✓ ${added.length} fragment deviations valid (not written)\n`,
    );
    return;
  }

  ledger.deviations.push(...added);
  ledger.deviations.sort((a, b) => a.id - b.id);
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  process.stdout.write(
    `\n✓ merged ${added.length} → deviations.json (${ledger.deviations.length} total)\n` +
      `  delete the merged fragments in the same commit.\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
