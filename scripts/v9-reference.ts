import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * GATE B — design-fidelity reference capture.
 *
 * Renders every canonical frame from the two design specs and writes one PNG per
 * frame. These are the VISUAL SOURCE OF TRUTH. They are not screenshots of the app
 * and must never be confused with `screenshots/baseline/`, which is the OLD APP and
 * exists only for regression protection (Gate A).
 *
 *   Gate A  old app  -> baseline/   vs  new app -> current/     "did we lose anything?"
 *   Gate B  v9 HTML  -> v9-reference/ vs new app -> impl/       "does it match the design?"
 *
 * GEOMETRY, MEASURED — this is the load-bearing detail:
 *   `.phone` is 390x844 INCLUDING a 10px bezel (box-sizing: border-box), so the real
 *   screen content is 370x824. The app renders at a 390x844 viewport. Reference and
 *   implementation therefore do NOT share a canvas, and a naive pixel diff between
 *   them is meaningless. We capture the `.screen` element — the true design pixels —
 *   and record the mismatch for an explicit decision rather than silently scaling.
 *
 *   pnpm shots:v9        capture every frame from both specs
 */

const ROOT = process.cwd();
const OUT = join(ROOT, "docs", "migration", "screenshots", "v9-reference");

/** The `.screen` content box: `.phone` 390x844 minus its 10px bezel. */
const CANVAS = { width: 370, height: 824 };

interface SpecFile {
  /** Short id used in the frame slug: v9-13, v10-02. */
  prefix: string;
  file: string;
}

const SPECS: SpecFile[] = [
  { prefix: "v9", file: "odovox-v9-master.html" },
  { prefix: "v10", file: "odovox-v10-talk.html" },
];

export interface ReferenceFrame {
  /** e.g. "v9-13" */
  id: string;
  /** The frame's own number as printed in the spec, e.g. "13". */
  number: string;
  /** e.g. "Home — calm, glanceable, habit-forming" */
  name: string;
  /** Section heading it sits under, e.g. "C · Home · Flow & habit". */
  section: string;
  /** The spec file it came from. */
  source: string;
  /** Rendered content size, in the design's own pixels. */
  width: number;
  height: number;
  png: string;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const manifest: ReferenceFrame[] = [];

  for (const spec of SPECS) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto(pathToFileURL(join(ROOT, spec.file)).href, {
      waitUntil: "networkidle",
    });

    // Freeze anything that could differ between runs. The specs are static HTML, but
    // they do carry CSS animation on a few decorative elements.
    await page.addStyleTag({
      content: `*,*::before,*::after{animation:none!important;transition:none!important}`,
    });

    const frames = await page.evaluate(() => {
      const out: {
        index: number;
        number: string;
        name: string;
        section: string;
      }[] = [];
      let section = "";
      // Walk the document in order so each frame picks up the section it sits under.
      document.querySelectorAll(".sect h2, .frame-card").forEach((el) => {
        if (el.tagName === "H2") {
          section = (el.textContent ?? "").trim();
          return;
        }
        const number = (el.querySelector(".f-num")?.textContent ?? "").trim();
        const name = (el.querySelector(".f-name")?.textContent ?? "").trim();
        out.push({ index: out.length, number, name, section });
      });
      return out;
    });

    const cards = page.locator(".frame-card");
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const meta = frames[i]!;
      // The `.screen` is the content area inside the bezel — the true design canvas.
      const screen = cards.nth(i).locator(".screen");
      // `page.screenshot`'s clip is viewport-relative, so the frame must be on screen
      // before its box is read.
      await screen.scrollIntoViewIfNeeded();
      const box = await screen.boundingBox();
      const id = `${spec.prefix}-${meta.number.padStart(2, "0")}`;
      const png = `${id}.png`;

      // Clip to the exact integer canvas rather than taking an element screenshot.
      // `.screen` lands on a fractional x, so Playwright rounded its box outward and
      // wrote 371x824 — one pixel wider than the implementation, which is enough for
      // the comparator to declare a size mismatch and skip the diff entirely.
      await page.screenshot({
        path: join(OUT, png),
        clip: {
          x: Math.round(box?.x ?? 0),
          y: Math.round(box?.y ?? 0),
          width: CANVAS.width,
          height: CANVAS.height,
        },
      });

      manifest.push({
        id,
        number: meta.number,
        name: meta.name,
        section: meta.section,
        source: spec.file,
        width: CANVAS.width,
        height: CANVAS.height,
        png,
      });
      process.stdout.write(`  ✓ ${id}  ${meta.name}\n`);
    }
    await page.close();
  }

  await browser.close();
  await writeFile(
    join(OUT, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  const sizes = new Set(manifest.map((f) => `${f.width}x${f.height}`));
  console.log(`\n${manifest.length} reference frames -> ${OUT}`);
  console.log(`Rendered canvas size(s): ${[...sizes].join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
