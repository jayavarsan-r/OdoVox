import { describe, expect, it } from "vitest";
import { failureMessage } from "./failure-copy";

/**
 * The rule this file exists to hold: nothing a machine wrote reaches the dentist.
 *
 * Frame 26 reads "The network dropped." The screen was rendering "Failed to fetch" — the
 * literal browser exception. #43's ruling forbids exposing the internal pipeline, and a
 * raw fetch/provider error is exactly that, with the added problem that it means nothing
 * to a dentist standing over a patient.
 */
describe("failureMessage", () => {
  it("turns browser and transport errors into the frame-26 sentence", () => {
    for (const raw of [
      "Failed to fetch",
      "TypeError: NetworkError when attempting to fetch resource.",
      "connect ECONNREFUSED 127.0.0.1:4000",
      "Network request failed",
    ]) {
      expect(failureMessage(raw)).toBe("The network dropped.");
    }
  });

  it("separates a timeout from a dropped connection — different waits, different sentences", () => {
    expect(failureMessage("The operation timed out")).toBe(
      "That took too long to reach us.",
    );
    expect(failureMessage("AbortError: The user aborted a request")).toBe(
      "That took too long to reach us.",
    );
  });

  it("names an expired session, because that one has a different fix", () => {
    expect(failureMessage("401 Unauthorized")).toBe("Your session expired.");
    expect(failureMessage("session invalid")).toBe("Your session expired.");
  });

  it("owns server-side failures rather than blaming the doctor", () => {
    expect(failureMessage("503 Service Unavailable")).toBe(
      "Odovox couldn't take the recording just now.",
    );
  });

  it("falls back to something vague rather than guessing a cause", () => {
    expect(failureMessage("EPIPE broken pipe")).toBe("That didn't go through.");
    expect(failureMessage(undefined)).toBe("That didn't go through.");
    expect(failureMessage("")).toBe("That didn't go through.");
  });

  it("never leaks provider names, stage vocabulary or raw exception text", () => {
    const leaky = [
      "Sarvam STT returned 500",
      "gemini-2.0-flash: quota exceeded",
      "extraction-queue job failed",
      "SSE stream closed during TRANSCRIBING",
      "Failed to fetch",
    ];
    const banned =
      /sarvam|gemini|stt|extract|transcrib|upload|sse|queue|fetch|http|\bapi\b|json|stack/i;
    for (const raw of leaky) {
      expect(failureMessage(raw)).not.toMatch(banned);
    }
  });
});
