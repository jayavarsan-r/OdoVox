import { describe, expect, it } from "vitest";
import { ctaHint, missingRequired } from "./new-patient-form";

/**
 * Global Constraint 1: a disabled CTA always says why.
 *
 * Frame 35's static line — "Name + phone unlock the button · everything else can wait" —
 * is wrong for this API, which requires name, phone, age and gender. A button enabled on
 * name + phone would hand the receptionist a validation error instead of a patient. So the
 * hint names what is actually missing.
 */
describe("missingRequired", () => {
  it("names every required field that is still empty", () => {
    expect(missingRequired({})).toEqual(["name", "phone", "age", "gender"]);
  });

  it("is empty once the API would accept the form", () => {
    expect(
      missingRequired({
        name: "Ramesh",
        phone: "+919000000001",
        age: 42,
        gender: "MALE",
      }),
    ).toEqual([]);
  });

  it("treats a half-typed phone as missing, not as present", () => {
    // The receptionist is mid-keystroke. Enabling Create on "+9190" would submit a phone
    // no clinic could ring back.
    expect(
      missingRequired({ name: "R", phone: "+9190", age: 1, gender: "MALE" }),
    ).toEqual(["phone"]);
    expect(
      missingRequired({
        name: "R",
        phone: "9000000001",
        age: 1,
        gender: "MALE",
      }),
    ).toEqual([]);
  });

  it("treats whitespace as an empty name", () => {
    expect(
      missingRequired({
        name: "   ",
        phone: "9000000001",
        age: 1,
        gender: "MALE",
      }),
    ).toEqual(["name"]);
  });

  it("accepts age 0 — infants are patients", () => {
    // `!v.age` would have rejected a newborn. Dental clinics do see them.
    expect(
      missingRequired({
        name: "R",
        phone: "9000000001",
        age: 0,
        gender: "MALE",
      }),
    ).toEqual([]);
  });
});

describe("ctaHint", () => {
  it("reads as a sentence, not a field list", () => {
    expect(ctaHint(["name"])).toBe("Name still needed");
    expect(ctaHint(["name", "phone"])).toBe("Name and phone still needed");
    expect(ctaHint(["name", "phone", "age"])).toBe(
      "Name, phone and age still needed",
    );
  });

  it("turns reassuring once nothing is missing", () => {
    expect(ctaHint([])).toBe(
      "Everything else can wait — you can fill it in later",
    );
  });
});
