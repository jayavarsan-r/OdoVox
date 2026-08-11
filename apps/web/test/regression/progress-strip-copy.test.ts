import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

/**
 * Regression (Phase 9.5 P1.7, Issue 5): the pipeline strip read like a machine console —
 * "Transcribing (Sarvam · saarika:v2.5)", "Understanding (Gemini Flash)" — and the recorder
 * CTA said "Send for review". Users get friendly language; provider brand names never render.
 *
 * The original test pinned three specific step labels ("Sent", "Listening…", "Making sense
 * of it…"). Frame 25 DELETES those chips on purpose — its own note says three visible steps
 * "made 15 seconds feel like three waits" — so pinning them would now fail for an approved
 * design change.
 *
 * What the test was actually protecting is unchanged and still pinned below: the processing
 * screen speaks to a dentist, not to an engineer, and no vendor name ever reaches the UI.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const strip = readFileSync(
  join(webRoot, "components", "voice", "progress-strip.tsx"),
  "utf8",
);
const recorder = readFileSync(
  join(webRoot, "components", "voice", "recorder.tsx"),
  "utf8",
);

describe("processing copy", () => {
  it("speaks to a dentist: plain state and an honest time expectation", () => {
    expect(strip).toMatch(/Processing/);
    expect(strip).toMatch(/Usually under 20 seconds/);
  });

  it("never leaks pipeline vocabulary into what the user reads", () => {
    // The words below are how the SERVER names its stages. They are fine in code and
    // comments; they must never be rendered text. Checked against JSX text nodes only.
    const rendered = [
      ...strip.matchAll(/>\s*\{?['"`]?([^<>{}'"`]{3,})['"`]?\}?\s*</g),
    ]
      .map((m) => m[1]!.trim())
      .join(" | ");
    expect(rendered).not.toMatch(/transcrib|extract|stt|upload|pipeline/i);
  });

  it("never shows provider brand names", () => {
    for (const source of [strip, recorder]) {
      expect(source).not.toMatch(/Sarvam|saarika|Gemini/i);
    }
  });
});

describe("recorder CTA copy", () => {
  it('says "Save findings", not "Send for review"', () => {
    expect(recorder).toMatch(/Save findings/);
    expect(recorder).not.toMatch(/Send for review/);
  });
});
