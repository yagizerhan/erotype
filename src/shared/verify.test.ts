// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { countTypedChars, sanitizeTypedWords } from "./verify";

describe("countTypedChars", () => {
  const expected = ["bir", "iki", "üç"];

  it("counts fully correct words including separating spaces", () => {
    const s = countTypedChars(expected, ["bir", "iki", "üç"]);
    expect(s).toEqual({ correct: 10, incorrect: 0, typedTotal: 10 });
  });

  it("counts only matching characters of wrong words, no space credit", () => {
    // "bur": b,r match (2), u is wrong (1) -> no space credit
    const s = countTypedChars(expected, ["bur", "iki"]);
    expect(s.correct).toBe(2 + 4);
    expect(s.incorrect).toBe(1);
  });

  it("treats missing and extra letters as incorrect", () => {
    expect(countTypedChars(expected, ["bi"]).incorrect).toBe(1);
    expect(countTypedChars(expected, ["birr"]).incorrect).toBe(1);
  });

  it("counts a partial word at time-out without penalising untyped letters", () => {
    const s = countTypedChars(expected, ["bir"], "ik");
    expect(s.correct).toBe(4 + 2);
    expect(s.incorrect).toBe(0);
  });

  it("is NFC-safe for Turkish characters", () => {
    const decomposed = "üç"; // ü ç (NFD)
    const s = countTypedChars(["üç"], [decomposed]);
    expect(s.correct).toBe(2);
  });

  it("ignores typed words beyond the expected list", () => {
    const s = countTypedChars(["a"], ["a", "b", "c"]);
    expect(s.correct).toBe(1);
  });
});

describe("sanitizeTypedWords", () => {
  it("accepts string arrays within limits", () => {
    expect(sanitizeTypedWords(["a", "b"], 5)).toEqual(["a", "b"]);
  });
  it("rejects non-arrays, non-strings, too many or too long words", () => {
    expect(sanitizeTypedWords("a b", 5)).toBeNull();
    expect(sanitizeTypedWords([1, 2], 5)).toBeNull();
    expect(sanitizeTypedWords(["a", "b", "c"], 2)).toBeNull();
    expect(sanitizeTypedWords(["x".repeat(65)], 5)).toBeNull();
  });
});
