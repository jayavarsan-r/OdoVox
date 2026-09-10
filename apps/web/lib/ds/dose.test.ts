import { describe, expect, it } from "vitest";
import { doseDotsFromFrequency, dosesPerDay } from "./dose";

describe("doseDotsFromFrequency", () => {
  it("maps the standard frequencies to three-slot patterns", () => {
    expect(doseDotsFromFrequency("OD")).toEqual([true, false, false]);
    expect(doseDotsFromFrequency("BD")).toEqual([true, false, true]);
    expect(doseDotsFromFrequency("TID")).toEqual([true, true, true]);
    expect(doseDotsFromFrequency("QID")).toEqual([true, true, true]);
  });

  it("renders SOS as no fixed slot", () => {
    expect(doseDotsFromFrequency("SOS")).toEqual([false, false, false]);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(doseDotsFromFrequency(" bd ")).toEqual([true, false, true]);
  });

  it("falls back to no-fixed-slot rather than inventing a schedule", () => {
    // A wrong dose pattern on a prescription is worse than an empty one.
    expect(doseDotsFromFrequency(null)).toEqual([false, false, false]);
    expect(doseDotsFromFrequency(undefined)).toEqual([false, false, false]);
    expect(doseDotsFromFrequency("")).toEqual([false, false, false]);
    expect(doseDotsFromFrequency("twice-ish")).toEqual([false, false, false]);
  });
});

describe("dosesPerDay", () => {
  it("counts the filled slots", () => {
    expect(dosesPerDay([true, false, true])).toBe(2);
    expect(dosesPerDay([false, false, false])).toBe(0);
  });
});
