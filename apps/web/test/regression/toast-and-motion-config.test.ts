import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

/** Phase 9.7 §3.3/§3.4 cross-cutting: toast discipline + reduced-motion respect, set app-wide. */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const providers = readFileSync(join(webRoot, "app", "providers.tsx"), "utf8");
const toastLib = readFileSync(join(webRoot, "lib", "toast.ts"), "utf8");

describe("toast configuration", () => {
  it("bottom of screen, ONE at a time, safe-area aware", () => {
    expect(providers).toContain('position="bottom-center"');
    expect(providers).toContain("visibleToasts={1}");
    expect(providers).toContain("safe-area-inset-bottom");
  });

  /**
   * Repointed in Phase 10 Task 4 (v9 frame 79).
   *
   * Was: a global `duration: 3000` on <Toaster/>. That is now a DEFECT, not a
   * requirement — frame 79 makes the problem and offline voices sticky, and a global
   * duration would auto-dismiss a failure nobody had acted on. Duration is chosen
   * per-voice by lib/toast.ts (see lib/ds/toast-voice.ts, unit-tested).
   */
  it("sets no global duration — duration is per-voice", () => {
    expect(providers).not.toContain("duration: 3000");
    expect(toastLib).toContain("toastDuration");
  });

  it("exposes exactly the three v9 voices", () => {
    expect(toastLib).toMatch(/success:/);
    expect(toastLib).toMatch(/problem:/);
    expect(toastLib).toMatch(/offline:/);
  });

  it("success carries an Undo affordance for reversible actions", () => {
    expect(toastLib).toMatch(/label:\s*["']Undo["']/);
  });

  it("problem carries a Retry affordance", () => {
    expect(toastLib).toMatch(/label:\s*["']Retry["']/);
  });
});

describe("motion respects prefers-reduced-motion", () => {
  it('MotionConfig reducedMotion="user" wraps the app', () => {
    expect(providers).toContain("MotionConfig");
    expect(providers).toContain('reducedMotion="user"');
  });
});

describe("skeletons during load (priority screens)", () => {
  it("priority screens render skeletons, not blank screens or spinners-as-pages", () => {
    for (const path of [
      ["app", "(app)", "home", "page.tsx"],
      ["app", "(app)", "inventory", "page.tsx"],
      ["app", "(app)", "lab", "[caseId]", "page.tsx"],
      ["app", "(app)", "messages", "lab", "page.tsx"],
      ["app", "(app)", "schedule", "page.tsx"],
    ]) {
      const src = readFileSync(join(webRoot, ...path), "utf8");
      expect(src, path.join("/")).toMatch(/Skeleton|ListSkeleton/);
    }
  });
});
