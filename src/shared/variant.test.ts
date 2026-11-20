// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { parseVariantMode2, variantMode2 } from "./variant";

describe("variantMode2", () => {
  it("leaves plain test key unchanged", () => {
    expect(variantMode2("time", "60", false, false)).toBe("60");
  });
  it("separates punctuation and numbers into distinct keys", () => {
    expect(variantMode2("time", "60", true, false)).toBe("60:p");
    expect(variantMode2("words", "25", false, true)).toBe("25:n");
    expect(variantMode2("time", "15", true, true)).toBe("15:pn");
  });
  it("ignores modifiers for quote and race modes", () => {
    expect(variantMode2("quote", "tr-3", true, true)).toBe("tr-3");
    expect(variantMode2("race", "60", true, false)).toBe("60");
  });
  it("parses variant keys back into components", () => {
    expect(parseVariantMode2("60:pn")).toEqual({ base: "60", punctuation: true, numbers: true });
    expect(parseVariantMode2("25")).toEqual({ base: "25", punctuation: false, numbers: false });
  });
});
