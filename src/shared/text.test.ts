// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  calculateWpm,
  capitalizeWord,
  computePrefixChars,
  generateWordSequence,
  normalizeText,
  splitWords
} from "./text";

describe("text utilities", () => {
  it("normalizes typographic quotes and unicode NFC", () => {
    const raw = "‘Merhaba’ “dünya”… — test";
    const clean = normalizeText(raw);
    expect(clean).toBe("'Merhaba' \"dünya\"... - test");
  });

  it("splits text into words properly", () => {
    expect(splitWords("  hızlı    klavye   testi  ")).toEqual([
      "hızlı",
      "klavye",
      "testi"
    ]);
  });

  it("computes prefix character lengths including separating spaces", () => {
    const words = ["bir", "iki", "üç"];
    // bir(3) + space(1) = 4, iki(3) + space(1) = 8, üç(2) = 10
    // [0, 4, 8, 10]
    const prefix = computePrefixChars(words);
    expect(prefix).toEqual([0, 4, 8, 10]);
  });

  it("calculates WPM accurately based on standard 5-character words", () => {
    // 50 characters in 60,000ms (1 minute) = 10 WPM
    expect(calculateWpm(50, 60_000)).toBe(10);
    // 100 characters in 30,000ms (0.5 minute) = (100 / 5) / 0.5 = 40 WPM
    expect(calculateWpm(100, 30_000)).toBe(40);
  });

  it("capitalizes words safely for Turkish i/İ and ı/I", () => {
    expect(capitalizeWord("istanbul", "tr")).toBe("İstanbul");
    expect(capitalizeWord("ışık", "tr")).toBe("Işık");
    expect(capitalizeWord("apple", "en")).toBe("Apple");
  });

  it("generates deterministic word sequence for identical seed", () => {
    const pool = ["elma", "armut", "kiraz", "kavun", "karpuz"];
    const seq1 = generateWordSequence(pool, 10, 42, "tr");
    const seq2 = generateWordSequence(pool, 10, 42, "tr");
    expect(seq1).toEqual(seq2);
    expect(seq1.length).toBe(10);
  });
});
