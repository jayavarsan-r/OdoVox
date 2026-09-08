import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/** Recursive file walk — Node 20 has no fs.globSync. */
async function walk(
  dir: string,
  match: (f: string) => boolean,
): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === ".turbo")
      continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, match)));
    else if (match(e.name)) out.push(p);
  }
  return out;
}

/**
 * GATE C — does the screen actually work?
 *
 * Gate A asks whether we lost anything. Gate B asks whether it matches the design. Neither
 * asks whether the thing DOES anything, and a migration that restyles surfaces can pass both
 * while shipping a button wired to nothing. This is the third gate:
 *
 *   1. DEAD CONTROLS   a <button> with no handler, an <a href="#">, a link to nowhere
 *   2. PLACEHOLDERS    "Coming soon", TODO surfaces, lorem
 *   3. ORPHAN ROUTES   a page nothing in the app links to — built, correct, unreachable
 *
 * (3) is the one that actually bit us: #81 shipped a Cases heading that named a case screen
 * and did not link to it. The screen was finished and no user could reach it.
 *
 *   pnpm gate:c
 *
 * This audit is STATIC — it reads the source. The dynamic half (a flow completes end to end
 * against the live API) lives in the Playwright journey specs, because only a running app can
 * answer it.
 */

const ROOT = process.cwd();
const WEB = join(ROOT, "apps", "web");
const APP = join(WEB, "app");

interface Finding {
  file: string;
  line: number;
  rule: string;
  detail: string;
}

/** Entry points nothing links to by design — the app opens on them. */
const ENTRY_ROUTES = new Set(["/", "/welcome", "/phone", "/otp", "/home"]);

/**
 * Copy that means "this screen isn't finished". Deliberately NOT `/placeholder/` — the
 * HTML `placeholder=` attribute is a legitimate, ubiquitous input hint, and matching it
 * produced 90 false positives on the first run. The word only counts as prose.
 */
const PLACEHOLDER = [
  /\bcoming soon\b/i,
  /\bnot implemented\b/i,
  /\bto ?do:/i,
  /\blorem ipsum\b/i,
  /\bunder construction\b/i,
  /["'>]\s*placeholder\s*[<"']/i,
];

/**
 * A <button> is alive if it handles a click, submits a form, delegates to a parent via
 * spread props, or renders as something else entirely (asChild). Component DEFINITIONS
 * legitimately have none of these — they take the handler as a prop — so a button whose
 * attributes include a spread is trusted.
 */
const ALIVE = [
  /onClick=/,
  /onPointerDown=/,
  /onMouseDown=/,
  /type=["']submit["']/,
  /formAction=/,
  /\{\.\.\./,
  /asChild/,
  /onSubmit=/,
];

function scanSource(src: string, file: string): Finding[] {
  const out: Finding[] = [];
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    const n = i + 1;

    // A link that goes nowhere.
    const href = line.match(/href=\{?["'`](#|)["'`]\}?/);
    if (href && !line.includes("aria-hidden")) {
      out.push({
        file,
        line: n,
        rule: "dead-link",
        detail: `href="${href[1]}" — a link that navigates nowhere`,
      });
    }

    for (const p of PLACEHOLDER) {
      if (p.test(line) && !line.trimStart().startsWith("*")) {
        out.push({
          file,
          line: n,
          rule: "placeholder",
          detail: `placeholder copy: ${line.trim().slice(0, 80)}`,
        });
        break;
      }
    }
  });

  // Buttons: read the whole opening tag, which routinely spans several lines.
  //
  // A naive /<button[^>]*>/ is WRONG and this audit shipped with that bug for one run: JSX
  // attribute expressions contain `>` themselves (`disabled={value >= max}`), so the match
  // truncated mid-tag and reported a live button as dead. Scan forward instead, tracking
  // brace depth, and stop only at a `>` that is not inside an expression or a string.
  for (const m of src.matchAll(/<button\b/g)) {
    const start = m.index;
    let depth = 0;
    let quote: string | null = null;
    let end = -1;

    for (let i = start; i < src.length; i++) {
      const c = src[i]!;
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) continue;

    const tag = src.slice(start, end + 1);
    if (ALIVE.some((r) => r.test(tag))) continue;
    out.push({
      file,
      line: src.slice(0, start).split("\n").length,
      rule: "dead-button",
      detail: `<button> with no handler, submit or spread: ${tag.replace(/\s+/g, " ").slice(0, 90)}`,
    });
  }

  return out;
}

/** `apps/web/app/(app)/patients/[id]/page.tsx` -> `/patients/[id]` */
function routeOf(pageFile: string): string {
  const rel = relative(APP, pageFile).split(sep).slice(0, -1);
  const segs = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segs.join("/");
}

async function main() {
  const sources = await walk(
    WEB,
    (f) =>
      (f.endsWith(".ts") || f.endsWith(".tsx")) &&
      !f.endsWith(".test.ts") &&
      !f.endsWith(".test.tsx"),
  );

  const findings: Finding[] = [];
  const corpus = new Map<string, string>();

  for (const abs of sources) {
    const f = relative(WEB, abs);
    const src = await readFile(abs, "utf8");
    corpus.set(f, src);
    findings.push(...scanSource(src, f));
  }

  // Orphan routes: a page nothing else navigates to.
  const pages = await walk(APP, (f) => f === "page.tsx");
  const orphans: string[] = [];

  for (const pageFile of pages) {
    const route = routeOf(pageFile);
    if (ENTRY_ROUTES.has(route)) continue;

    // Match the literal prefix before any dynamic segment: /patients/[id]/plans/[planId]
    // is reached by a template string, so we can only look for `/patients/`.
    const dyn = route.indexOf("/[");
    const needle = dyn === -1 ? route : route.slice(0, dyn + 1);
    const self = relative(WEB, pageFile);

    const linked = [...corpus].some(
      ([f, src]) =>
        f !== self &&
        (src.includes(`"${needle}`) ||
          src.includes(`'${needle}`) ||
          src.includes(`\`${needle}`)),
    );
    if (!linked) orphans.push(route);
  }

  // Report.
  const byRule = new Map<string, Finding[]>();
  for (const f of findings)
    byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);

  for (const [rule, rows] of [...byRule].sort()) {
    process.stdout.write(`\n${rule} — ${rows.length}\n`);
    for (const r of rows.slice(0, 40))
      process.stdout.write(`  ${r.file}:${r.line}  ${r.detail}\n`);
    if (rows.length > 40)
      process.stdout.write(`  … ${rows.length - 40} more\n`);
  }

  if (orphans.length > 0) {
    process.stdout.write(`\norphan-route — ${orphans.length}\n`);
    for (const r of orphans)
      process.stdout.write(
        `  ${r}  — built, but nothing in the app links to it\n`,
      );
  }

  const total = findings.length + orphans.length;
  process.stdout.write(
    total === 0
      ? `\n✓ GATE C: no dead controls, placeholders or orphan routes\n`
      : `\n✗ GATE C: ${total} finding(s)\n`,
  );
  process.exit(total === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
