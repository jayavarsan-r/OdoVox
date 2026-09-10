import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

export const WEB_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Read a whole route directory as one string — the page plus every component co-located
 * with it.
 *
 * Several regression tests assert their invariant by grepping a route's source. That works
 * until the route is legitimately split into files, at which point the test fails while the
 * behaviour it protects is perfectly intact: the code moved next door. Task 17 hit this on
 * the verification card, Task 21 again on patient detail — both refactors the plan itself
 * asked for.
 *
 * The invariants are about a SCREEN, not a file. So the tests read the screen. Assertions
 * stay exactly as written; only their input widens, and a future split cannot break them
 * again.
 *
 * Files are concatenated in a stable order (alphabetical, page.tsx first) so that
 * assertions about ORDER within page.tsx still mean what they meant.
 */
export function readScreen(...segments: string[]): string {
  const dir = join(WEB_ROOT, ...segments);
  const files = readdirSync(dir)
    .filter(
      (f) =>
        (f.endsWith(".tsx") || f.endsWith(".ts")) &&
        statSync(join(dir, f)).isFile(),
    )
    .sort((a, b) => {
      if (a === "page.tsx") return -1;
      if (b === "page.tsx") return 1;
      return a.localeCompare(b);
    });

  return files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
}
