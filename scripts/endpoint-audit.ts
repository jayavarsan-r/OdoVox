import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

/**
 * Which API endpoints does nothing call?
 *
 * An endpoint nobody reaches is the server-side twin of Gate C's dead button: it still has
 * to be maintained, still widens the attack surface, still has to be reasoned about when the
 * schema changes — and it earns none of that, because no client asks for it. This migration
 * has already produced one (a vendor-performance route duplicating analytics that existed),
 * which is what prompted the sweep.
 *
 * The audit is DELIBERATELY CONSERVATIVE. "Unreferenced" is a question, never a verdict:
 *
 *   - webhooks are called by providers, not by our own code;
 *   - a few routes exist for operators or future clients;
 *   - a path built at runtime (`/lab/cases/${id}/${action}`) will not match a literal grep.
 *
 * So it reports, and a human decides. Anything deleted on the strength of this file alone
 * is deleted on bad evidence.
 *
 *   pnpm audit:endpoints
 */

const ROOT = process.cwd();
const API = join(ROOT, 'apps', 'api', 'src');
const CALLERS = [
  join(ROOT, 'apps', 'web'),
  join(ROOT, 'apps', 'api', 'test'),
  join(ROOT, 'scripts'),
];

interface Route {
  method: string;
  path: string;
  file: string;
  line: number;
}

async function walk(dir: string, match: (f: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.turbo') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, match)));
    else if (match(e.name)) out.push(p);
  }
  return out;
}

/** `fastify.get('/lab/cases', …)` → one Route. */
function routesIn(src: string, file: string): Route[] {
  const out: Route[] = [];
  const re = /fastify\.(get|post|patch|put|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  for (const m of src.matchAll(re)) {
    out.push({
      method: m[1]!.toUpperCase(),
      path: m[2]!,
      file,
      line: src.slice(0, m.index).split('\n').length,
    });
  }
  return out;
}

/**
 * A pattern matching how a caller would actually WRITE this path.
 *
 * The first version of this looked for a literal fragment and was wrong about four of
 * twelve: `/bills/:id/items/:itemId` is written `/bills/${billId}/items/${itemId}`, and
 * `/lab/cases/:id/confirm-received` is assembled as `/lab/cases/${id}/${action}`. A grep for
 * the tail found neither.
 *
 * So each `:param` becomes a wildcard that matches a template expression or a literal
 * segment. A false positive is not a harmless extra row here — an audit that cries wolf is
 * one people stop reading, which is the failure it exists to prevent.
 *
 * It still cannot see a path built entirely from variables (`/lab/cases/${id}/${action}`
 * matches, but a fully dynamic base would not). That is why the output says review, not
 * delete.
 */
function callPattern(path: string): RegExp {
  const escaped = path
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith(':') ? '[^/\'"`\\s]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`/${escaped}`);
}

async function main() {
  const apiFiles = await walk(API, (f) => f.endsWith('.ts'));
  const routes: Route[] = [];
  for (const f of apiFiles) {
    routes.push(...routesIn(await readFile(f, 'utf8'), relative(ROOT, f)));
  }

  const corpus: string[] = [];
  for (const dir of CALLERS) {
    for (const f of await walk(dir, (n) => n.endsWith('.ts') || n.endsWith('.tsx'))) {
      corpus.push(await readFile(f, 'utf8'));
    }
  }
  const haystack = corpus.join('\n');

  const unreferenced = routes.filter((r) => !callPattern(r.path).test(haystack));

  process.stdout.write(`${routes.length} endpoints defined\n`);
  if (unreferenced.length === 0) {
    process.stdout.write('✓ every endpoint is referenced by web, tests or scripts\n');
    return;
  }

  process.stdout.write(
    `\n${unreferenced.length} with no literal reference — REVIEW, do not bulk-delete:\n\n`,
  );
  for (const r of unreferenced.sort((a, b) => a.path.localeCompare(b.path))) {
    process.stdout.write(`  ${r.method.padEnd(6)} ${r.path.padEnd(48)} ${r.file}:${r.line}\n`);
  }
  process.stdout.write(
    '\nA webhook, an operator route, or a path assembled at runtime will show up here and is fine.\n',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
