import { describe, expect, it } from "vitest";
import { pushRecent } from "./recent-searches";

describe("pushRecent", () => {
  it("puts the newest query first", () => {
    expect(pushRecent(["Meena"], "Anand")).toEqual(["Anand", "Meena"]);
  });

  it("moves a repeat to the front instead of duplicating it", () => {
    // Searching the same person twice is the COMMON case at a front desk. Two identical
    // chips would waste the row that exists to save typing.
    expect(pushRecent(["Meena", "Anand"], "Anand")).toEqual(["Anand", "Meena"]);
  });

  it("treats case as the same query", () => {
    expect(pushRecent(["Anand"], "anand")).toEqual(["anand"]);
  });

  it("caps the list so the chips never push the results off screen", () => {
    const many = ["a", "b", "c", "d", "e", "f"];
    expect(pushRecent(many, "g")).toEqual(["g", "a", "b", "c", "d", "e"]);
  });

  it("ignores an empty or whitespace query", () => {
    expect(pushRecent(["Anand"], "")).toEqual(["Anand"]);
    expect(pushRecent(["Anand"], "   ")).toEqual(["Anand"]);
  });

  it("stores the trimmed form", () => {
    expect(pushRecent([], "  Anand  ")).toEqual(["Anand"]);
  });
});
