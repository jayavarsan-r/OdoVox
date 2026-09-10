import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The invariant the reducer CANNOT enforce.
 *
 * `applyServerEvent` has no notion of which run an event belongs to — a late TRANSCRIBED
 * or READY moves state whatever the app is doing. So the guard against a stale event
 * resurrecting an abandoned recording lives at the SUBSCRIPTION: `rerecord()` closes the
 * stream before it resets.
 *
 * This is asserted against the source rather than by driving the store, and that is a
 * deliberate choice: `closeStream` is only non-null once a real stream has been opened,
 * which needs getUserMedia, a live MediaRecorder and a captured blob. Mocking all three
 * would test the mocks. The invariant here is an ORDERING one — close, then await — and
 * the ordering is what the source states. The same technique already guards the home
 * hero wiring and the progress-strip copy.
 *
 * The bug this protects against: a doctor's failed consultation kept streaming, and its
 * READY event dropped a stale verification card on top of the take they had already
 * started re-recording.
 */
const store = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "store.ts"),
  "utf8",
);

/** The body of `rerecord`, from its declaration to the next top-level action. */
function rerecordBody(): string {
  const start = store.indexOf("rerecord: async");
  expect(start).toBeGreaterThan(-1);
  const end = store.indexOf("\n  teardown:", start);
  expect(end).toBeGreaterThan(start);
  return store.slice(start, end);
}

describe("rerecord tears down the abandoned run", () => {
  it("closes the event stream", () => {
    expect(rerecordBody()).toMatch(/closeStream\?\.\(\)/);
  });

  it("drops the reference too, so a later close cannot hit a dead stream", () => {
    expect(rerecordBody()).toMatch(/closeStream\s*=\s*null/);
  });

  it("closes BEFORE awaiting the server reject", () => {
    const body = rerecordBody();
    const closeAt = body.indexOf("closeStream?.()");
    const awaitAt = body.indexOf("await api.post");
    expect(closeAt).toBeGreaterThan(-1);
    expect(awaitAt).toBeGreaterThan(-1);
    // If the reject were awaited first the stream would stay live for the whole
    // round-trip — exactly the window a late READY event needs to land on the new take.
    expect(closeAt).toBeLessThan(awaitAt);
  });

  it("still rejects the old consultation — teardown did not replace that", () => {
    expect(rerecordBody()).toMatch(/reject/);
    expect(rerecordBody()).toMatch(/doctor re-recorded/);
  });

  it("teardown() closes the stream as well, for unmount", () => {
    // `teardown: () => {` — the implementation. `indexOf('teardown: ()')` alone matches
    // the interface's `teardown: () => void;` declaration first.
    const start = store.indexOf("teardown: () => {");
    const body = store.slice(start, start + 400);
    expect(body).toMatch(/closeStream\?\.\(\)/);
  });
});
