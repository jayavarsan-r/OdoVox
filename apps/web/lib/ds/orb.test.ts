import { describe, expect, it } from "vitest";
import {
  HOLD_MS,
  holdFired,
  initialPress,
  pressCancel,
  pressDown,
  pressUp,
} from "./orb";

describe("orb press/hold", () => {
  it("a quick press resolves as a tap", () => {
    const down = pressDown(1000);
    expect(pressUp(down, 1000 + 100).resolution).toBe("tap");
  });

  it("a press promoted by the hold timer resolves as a hold", () => {
    const held = holdFired(pressDown(1000));
    expect(held.state).toBe("held");
    expect(pressUp(held, 1000 + 400).resolution).toBe("hold");
  });

  it("a hold NEVER also fires the tap", () => {
    // A double-fire would open the voice menu AND start a recording behind it —
    // against whichever patient the context action defaulted to.
    const held = holdFired(pressDown(1000));
    const { resolution } = pressUp(held, 1000 + 500);
    expect(resolution).not.toBe("tap");
    expect(resolution).toBe("hold");
  });

  it("falls back to elapsed time when the hold timer was starved", () => {
    // Mid-range Android under load can delay a 350ms timer past the pointer-up.
    // Without this fallback a long press would silently become a tap — i.e. an
    // unintended recording.
    const stillPressing = pressDown(1000);
    expect(pressUp(stillPressing, 1000 + HOLD_MS).resolution).toBe("hold");
    expect(pressUp(stillPressing, 1000 + HOLD_MS - 1).resolution).toBe("tap");
  });

  it("cancellation resolves to nothing, never a tap", () => {
    // Dragging off the orb must not fire the context action.
    expect(pressCancel().resolution).toBe("none");
    expect(pressCancel().next).toEqual(initialPress);
  });

  it("a hold timer that fires after release does not promote the press", () => {
    const { next } = pressUp(pressDown(1000), 1100);
    expect(holdFired(next).state).toBe("idle");
  });

  it("pointer-up with no press resolves to nothing", () => {
    expect(pressUp(initialPress, 1000).resolution).toBe("none");
  });
});
