import { chromium } from "@playwright/test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Split the design specs into ONE SELF-CONTAINED HTML FILE PER FRAME.
 *
 * The masters are 3,689 and 1,100 lines. An implementer working on frame 58 had to scan the
 * whole file to find it, and carried the other eighty frames in context for the rest of its
 * run. This writes `docs/migration/v9-frames/v9-58.html` — the frame's own markup plus the
 * shared <style> and <symbol> defs it references, and nothing else. It opens in a browser and
 * renders identically to its card in the master.
 *
 * These files are a DESIGN SPECIFICATION, exactly as the masters are. Nothing here is pasted
 * into the app: the app is React with a Tailwind preset, and copying spec markup would import
 * the spec's own hardcoded values in place of the design system's tokens. Read them, measure
 * them, then build the screen properly.
 *
 * Regenerate with `pnpm shots:extract`. Never hand-edit the output — it is derived.
 */

const ROOT = process.cwd();
const OUT = join(ROOT, "docs", "migration", "v9-frames");

interface SpecFile {
  /** Short id used in the frame slug: v9-13, v10-02. */
  prefix: string;
  file: string;
}

const SPECS: SpecFile[] = [
  { prefix: "v9", file: "odovox-v9-master.html" },
  { prefix: "v10", file: "odovox-v10-talk.html" },
];

/** The `.screen` content box: `.phone` 390x844 minus its 10px bezel. */
const CANVAS = { width: 370, height: 824 };

function page(frame: {
  id: string;
  number: string;
  name: string;
  section: string;
  source: string;
  css: string;
  defs: string;
  card: string;
  notes: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${frame.id} — ${frame.name}</title>
<!--
  DESIGN SPECIFICATION — ${frame.id} · ${frame.name}
  Section: ${frame.section}
  Extracted from ${frame.source} by scripts/extract-v9-frames.ts. Do not hand-edit.

  The screen canvas is ${CANVAS.width}x${CANVAS.height} design pixels (the .phone is 390x844
  including a 10px bezel). Measure against that, not against the bezel.

  THIS IS NOT CODE TO PASTE. Build the screen in React against the design system's tokens.
-->
<style>
${frame.css}
</style>
</head>
<body style="background:#0E120F;display:flex;align-items:flex-start;justify-content:center;padding:24px">
${frame.defs}
${frame.card}
</body>
</html>
`;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const index: {
    id: string;
    number: string;
    name: string;
    section: string;
    source: string;
    file: string;
    notes: string;
  }[] = [];

  for (const spec of SPECS) {
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await p.goto(pathToFileURL(join(ROOT, spec.file)).href, {
      waitUntil: "domcontentloaded",
    });

    const extracted = await p.evaluate(() => {
      // Everything every frame depends on: the whole stylesheet, and the hidden <svg> that
      // holds the <symbol> icon defs each card references with <use href="#i-…">.
      const css = [...document.querySelectorAll("style")]
        .map((s) => s.textContent ?? "")
        .join("\n");
      const defs = [...document.querySelectorAll("svg")]
        .filter((s) =>
          s.querySelector("symbol, linearGradient, radialGradient"),
        )
        .map((s) => s.outerHTML)
        .join("\n");

      const out: {
        number: string;
        name: string;
        section: string;
        card: string;
        notes: string;
      }[] = [];
      let section = "";
      // Walk in document order so each frame picks up the section heading above it.
      document.querySelectorAll(".sect h2, .frame-card").forEach((el) => {
        if (el.tagName === "H2") {
          section = (el.textContent ?? "").trim();
          return;
        }
        out.push({
          number: (el.querySelector(".f-num")?.textContent ?? "").trim(),
          name: (el.querySelector(".f-name")?.textContent ?? "").trim(),
          section,
          card: el.outerHTML,
          notes: (el.querySelector(".f-notes")?.textContent ?? "").trim(),
        });
      });
      return { css, defs, frames: out };
    });

    // The stylesheet and icon defs are identical for every frame in a spec. Write them
    // ONCE so a reader can consult the tokens without paying for them 81 times.
    await writeFile(
      join(OUT, `_${spec.prefix}-tokens.css`),
      extracted.css,
      "utf8",
    );

    for (const f of extracted.frames) {
      const id = `${spec.prefix}-${f.number.padStart(2, "0")}`;
      const file = `${id}.html`;
      await writeFile(
        join(OUT, file),
        page({
          id,
          number: f.number,
          name: f.name,
          section: f.section,
          source: spec.file,
          css: extracted.css,
          defs: extracted.defs,
          card: f.card,
          notes: f.notes,
        }),
        "utf8",
      );

      // The digest: what an implementer actually reads. Same markup, none of the 40KB of
      // shared CSS and icon defs that the renderable .html has to carry.
      await writeFile(
        join(OUT, `${id}.md`),
        [
          `# ${id} — ${f.name}`,
          ``,
          `**Section:** ${f.section}`,
          `**Canvas:** ${CANVAS.width}x${CANVAS.height} design px`,
          `**Renders at:** \`docs/migration/v9-frames/${file}\` · **PNG:** \`docs/migration/screenshots/v9-reference/${id}.png\``,
          `**Tokens:** \`docs/migration/v9-frames/_${spec.prefix}-tokens.css\``,
          ``,
          f.notes ? `## Designer's note\n\n${f.notes}\n` : ``,
          `## Specification markup`,
          ``,
          `This is a DESIGN SPECIFICATION. Do not paste it into the app — build the screen`,
          `in React against the design system's tokens. Read it for structure, spacing,`,
          `type scale and copy.`,
          ``,
          "```html",
          f.card,
          "```",
          ``,
        ].join("\n"),
        "utf8",
      );
      index.push({
        id,
        number: f.number,
        name: f.name,
        section: f.section,
        source: spec.file,
        file,
        notes: f.notes,
      });
      process.stdout.write(`  ✓ ${id}  ${f.name}\n`);
    }
    await p.close();
  }

  await browser.close();
  await writeFile(
    join(OUT, "index.json"),
    JSON.stringify(index, null, 2) + "\n",
    "utf8",
  );
  process.stdout.write(
    `\n${index.length} frames → docs/migration/v9-frames/\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
