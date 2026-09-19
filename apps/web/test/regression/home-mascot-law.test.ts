import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

/**
 * The mascot law on Home, as v9 states it.
 *
 * This test used to assert that Home carries NO mascot at all — Phase 2.6 §12.1, written
 * after a giant sleeping tooth took over the dashboard. The v9 spec reverses that rule
 * (approved deviation #2): its own law bans Odo only from MONEY AND SAFETY surfaces, and
 * frame 16 puts him on Home explicitly, celebrating a finished day.
 *
 * So the blanket ban is gone, but the regression it was written for is not. What actually
 * went wrong was a mascot big enough to dominate the screen and empty states built around
 * one instead of around an icon. Those are what this file now pins.
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const home = readFileSync(
  join(webRoot, "app", "(app)", "home", "page.tsx"),
  "utf8",
);

describe("the mascot law on Home", () => {
  it("uses Odo only to celebrate a finished day (frame 16)", () => {
    const poses = [...home.matchAll(/<MascotMoment[^>]*pose="(\w+)"/g)].map(
      (m) => m[1],
    );
    // Any mascot on Home must be the celebration. No thinking/sleeping Odo on a
    // working screen — that is the regression the original rule was written for.
    for (const pose of poses) expect(pose).toBe("celebrate");
  });

  it("never renders Odo large enough to dominate the screen", () => {
    // `xl` is 140px, the spec's largest — reserved for /done and the welcome carousel.
    // On a working screen it is the giant-sleeping-tooth failure all over again.
    expect(home).not.toMatch(/<MascotMoment[^>]*size="xl"/);
  });

  it("still builds empty states around an icon, not a mascot", () => {
    expect(home).toMatch(/variant="inline"/);
    expect(home).not.toMatch(/<EmptyState[^>]*mascot=/);
  });
});
