import { describe, expect, it } from "vitest";
import {
  DECORATIVE_OBJECTS,
  MASCOT_POSES,
  decorativeAssetPath,
  decorativeAssetVar,
  mascotAssetPath,
  mascotAssetVar,
  mascotSizePx,
} from "./mascot";

describe("mascot pose → asset mapping", () => {
  it("maps every pose to its CSS variable", () => {
    expect(mascotAssetVar("hero")).toBe("var(--illu-mascot-hero)");
    expect(mascotAssetVar("celebrate")).toBe("var(--illu-mascot-celebrate)");
    expect(mascotAssetVar("sleeping")).toBe("var(--illu-mascot-sleeping)");
  });

  // Six since frame 26. "concerned" was added for the processing-failure screen, which
  // was wearing "thinking" — the same face as the processing screen it had just left, so
  // a doctor glancing at the phone read "still working" on a screen that had given up.
  // The list is asserted exactly so a seventh pose is a decision, not a drive-by import.
  it("has exactly the six approved poses", () => {
    expect([...MASCOT_POSES].sort()).toEqual(
      ["celebrate", "concerned", "hero", "sleeping", "smile", "thinking"].sort(),
    );
  });

  it("maps each pose to a public PNG path", () => {
    for (const pose of MASCOT_POSES) {
      expect(mascotAssetPath(pose)).toBe(`/illu/mascot/odo-${pose}.png`);
    }
  });

  it("resolves size tokens to the v9 spec own Odo diameters", () => {
    expect(mascotSizePx("sm")).toBe(34);
    expect(mascotSizePx("md")).toBe(64);
    expect(mascotSizePx("lg")).toBe(120);
    expect(mascotSizePx("xl")).toBe(140);
  });

  it("never draws Odo larger than the spec ever does", () => {
    // Measured from every <svg viewBox="0 0 64 64"> in odovox-v9-master.html.
    const SPEC_MAX = 140;
    for (const size of ["sm", "md", "lg", "xl"] as const) {
      expect(mascotSizePx(size)).toBeLessThanOrEqual(SPEC_MAX);
    }
  });
});

describe("decorative object → asset mapping", () => {
  it("maps object keys to CSS variables", () => {
    expect(decorativeAssetVar("tooth")).toBe("var(--illu-object-tooth)");
    expect(decorativeAssetVar("xray")).toBe("var(--illu-object-xray)");
  });

  it("maps object keys to their (sometimes-renamed) file paths", () => {
    expect(decorativeAssetPath("tooth")).toBe("/illu/objects/tooth.png");
    expect(decorativeAssetPath("xray")).toBe("/illu/objects/xray-film.png");
    expect(decorativeAssetPath("mirror")).toBe(
      "/illu/objects/dental-mirror.png",
    );
    expect(decorativeAssetPath("pills")).toBe("/illu/objects/pill-bottle.png");
  });

  it("has exactly the five approved objects", () => {
    expect(DECORATIVE_OBJECTS).toHaveLength(5);
  });
});
