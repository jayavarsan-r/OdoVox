import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

/**
 * Diff current/ against baseline/ and write diff/ + a summary.
 *
 *   pnpm shots:compare             all captured slugs
 *   pnpm shots:compare E1 C1       only slugs starting with E1 / C1
 *
 * IMPORTANT — read the output, don't just check the exit code. A large diff is the
 * expected outcome of a visual migration. What this is hunting is STRUCTURAL LOSS:
 * a control, row or section that vanished. The "content height" delta is the signal
 * for that — a page that got materially shorter probably lost something.
 */

const ROOT = join(process.cwd(), "docs", "migration", "screenshots");
const BASE = join(ROOT, "baseline");
const CUR = join(ROOT, "current");
const DIFF = join(ROOT, "diff");

const filters = process.argv.slice(2);

interface Row {
  slug: string;
  status:
    | "identical"
    | "changed"
    | "missing-baseline"
    | "missing-current"
    | "size-mismatch";
  changedPct?: number;
  baseline?: { w: number; h: number };
  current?: { w: number; h: number };
}

async function load(dir: string, slug: string): Promise<PNG | null> {
  try {
    return PNG.sync.read(await readFile(join(dir, `${slug}.png`)));
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(DIFF, { recursive: true });

  let slugs: string[];
  try {
    slugs = (await readdir(BASE))
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.slice(0, -4));
  } catch {
    console.error(
      `No baseline at ${BASE}.\nRun \`pnpm shots:baseline\` first — nothing may be`,
    );
    console.error(`migrated before a baseline exists (governance §7).`);
    process.exit(1);
  }
  if (filters.length)
    slugs = slugs.filter((s) => filters.some((f) => s.startsWith(f)));

  const rows: Row[] = [];

  for (const slug of slugs.sort()) {
    const a = await load(BASE, slug);
    const b = await load(CUR, slug);
    if (!a) {
      rows.push({ slug, status: "missing-baseline" });
      continue;
    }
    if (!b) {
      rows.push({ slug, status: "missing-current" });
      continue;
    }

    const base = { w: a.width, h: a.height };
    const cur = { w: b.width, h: b.height };

    if (a.width !== b.width || a.height !== b.height) {
      rows.push({
        slug,
        status: "size-mismatch",
        baseline: base,
        current: cur,
      });
      continue;
    }

    const out = new PNG({ width: a.width, height: a.height });
    const changed = pixelmatch(a.data, b.data, out.data, a.width, a.height, {
      threshold: 0.12,
      includeAA: false,
    });
    const pct = (changed / (a.width * a.height)) * 100;

    if (changed === 0) {
      rows.push({
        slug,
        status: "identical",
        changedPct: 0,
        baseline: base,
        current: cur,
      });
    } else {
      await writeFile(join(DIFF, `${slug}.png`), PNG.sync.write(out));
      rows.push({
        slug,
        status: "changed",
        changedPct: pct,
        baseline: base,
        current: cur,
      });
    }
  }

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(`\n${pad("SLUG", 26)}${pad("STATUS", 18)}CHANGED`);
  console.log("─".repeat(60));
  for (const r of rows) {
    const pct = r.changedPct === undefined ? "" : `${r.changedPct.toFixed(1)}%`;
    console.log(`${pad(r.slug, 26)}${pad(r.status, 18)}${pct}`);
  }

  const identical = rows.filter((r) => r.status === "identical").length;
  const changed = rows.filter((r) => r.status === "changed").length;
  const problems = rows.filter(
    (r) => r.status === "missing-baseline" || r.status === "missing-current",
  );

  console.log("─".repeat(60));
  console.log(
    `${identical} identical · ${changed} changed · ${problems.length} problems`,
  );

  await writeFile(
    join(ROOT, "compare.json"),
    JSON.stringify({ at: new Date().toISOString(), rows }, null, 2),
  );

  if (changed) {
    console.log(`\nDiffs written to ${DIFF}`);
    console.log(`\n⚠ REVIEW REQUIRED — for each changed slug confirm:`);
    console.log(`   · every control present in baseline is still present`);
    console.log(`   · no section collapsed or disappeared`);
    console.log(`   · the change matches the target frame, not an accident`);
  }
  if (problems.length) {
    console.error(
      `\n✗ ${problems.length} slug(s) missing a side — capture before comparing.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
