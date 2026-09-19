import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

/**
 * The verification card's source, as one string.
 *
 * These regression tests grep source text, and they used to read a single 545-line
 * `verification-card.tsx`. Task 17 split that file into `components/voice/verification/*`
 * with the DOM unchanged, which broke the greps without breaking a single behaviour.
 *
 * Widening the read rather than rewriting the assertions is the point. The assertions
 * protect BEHAVIOURS — every edit autosaves, identity never comes from the extraction,
 * saving passes through a preview — and a behaviour does not stop mattering because the
 * code that implements it moved next door. Scoping them to one filename was always an
 * accident of how the component happened to be laid out.
 *
 * It also closes a hole the split opened: `identity-from-patient-only` asserts the card
 * NEVER reads `data.name`. Against one file that guard was real; against one file out of
 * seven it would pass by simply not looking at the other six. Reading the directory keeps
 * the guard as strong as it was, which is the whole reason it exists.
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cardPath = join(webRoot, "components", "voice", "verification-card.tsx");
const partsDir = join(webRoot, "components", "voice", "verification");
// The card's pure view-model. It renders nothing itself, but it now holds content the
// component used to spell out in JSX (the preview's five lines), so a guard that ignored
// it would be grepping for text that legitimately moved one file away.
const viewModelPath = join(webRoot, "lib", "consult", "card-view.ts");

export function verificationSource(): string {
  const parts = readdirSync(partsDir)
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .sort()
    .map((f) => readFileSync(join(partsDir, f), "utf8"));
  return [
    readFileSync(cardPath, "utf8"),
    readFileSync(viewModelPath, "utf8"),
    ...parts,
  ].join("\n");
}
