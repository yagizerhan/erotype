// SPDX-License-Identifier: AGPL-3.0-or-later
import { createRng } from "./rng";

/**
 * Normalizes text to Unicode NFC form and standardizes typographic punctuation
 * to keyboard-typeable equivalents.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes a single word to NFC without stripping internal characters.
 * Turkish 'i/İ/ı/I' safe: never uses toLocaleLowerCase.
 */
export function normalizeWord(word: string): string {
  return word.normalize("NFC");
}

/**
 * Splits normalized text into words separated by single spaces.
 */
export function splitWords(text: string): string[] {
  const clean = normalizeText(text);
  if (!clean) return [];
  return clean.split(" ");
}

/**
 * Computes cumulative character counts after each completed word (including the space after non-final words).
 * prefixChars[0] = 0
 * prefixChars[w] = characters typed when word `w` (1-indexed) is completed.
 */
export function computePrefixChars(words: string[]): number[] {
  const prefix: number[] = [0];
  let total = 0;
  for (let i = 0; i < words.length; i++) {
    total += words[i].length;
    if (i < words.length - 1) {
      total += 1; // space after word
    }
    prefix.push(total);
  }
  return prefix;
}

/**
 * Standard WPM formula: (characters / 5) / (elapsedMs / 60000)
 */
export function calculateWpm(chars: number, elapsedMs: number): number {
  if (elapsedMs <= 0 || chars <= 0) return 0;
  const minutes = elapsedMs / 60_000;
  return Math.round((chars / 5 / minutes) * 10) / 10;
}

/**
 * Capitalizes the first letter of a word safely for Turkish ('i' -> 'İ', 'ı' -> 'I').
 */
export function capitalizeWord(word: string, lang: "tr" | "en"): string {
  if (!word) return word;
  const first = word[0];
  let upper = first.toUpperCase();
  if (lang === "tr") {
    if (first === "i") upper = "İ";
    else if (first === "ı") upper = "I";
  }
  return upper + word.slice(1);
}

/**
 * Generates a deterministic word sequence from a seed (with optional punctuation / numbers).
 * Client and server produce the exact same sequence from identical inputs.
 */
export function generateWordSequence(
  pool: string[],
  count: number,
  seed: number,
  lang: "tr" | "en",
  options: { punctuation?: boolean; numbers?: boolean } = {}
): string[] {
  const out: string[] = [];
  const rand = createRng(seed);
  let capitalizeNext = Boolean(options.punctuation);
  let prevWord = "";

  for (let i = 0; i < count; i++) {
    // Draw a fixed number of PRNG values per word so the sequence stays stable
    const rNum = rand();
    const rPick = rand();
    const rPunct = rand();
    const rDigits = rand();

    // When numbers are enabled, ~14% chance of a 1-3 digit number
    if (options.numbers && rNum < 0.14) {
      const digits = Math.floor(rDigits * 3) + 1;
      const numVal = Math.floor(rPick * Math.pow(10, digits));
      out.push(String(numVal));
      capitalizeNext = false;
      prevWord = "";
      continue;
    }

    let idx = Math.floor(rPick * pool.length) % pool.length;
    // Avoid repeating the same word back-to-back
    if (pool[idx] === prevWord && pool.length > 1) {
      idx = (idx + 1) % pool.length;
    }
    let word = pool[idx];
    prevWord = word;

    if (options.punctuation) {
      if (capitalizeNext) {
        word = capitalizeWord(word, lang);
        capitalizeNext = false;
      }

      if (i === count - 1) {
        word = word + ".";
      } else if (rPunct < 0.12) {
        word = word + ".";
        capitalizeNext = true;
      } else if (rPunct < 0.22) {
        word = word + ",";
      } else if (rPunct < 0.25) {
        word = word + "?";
        capitalizeNext = true;
      } else if (rPunct < 0.27) {
        word = word + ";";
      }
    }

    out.push(normalizeWord(word));
  }

  return out;
}

/** Number of words to generate for timed mode so fast typists don't run out (up to ~240 WPM). */
export function wordCountForTimeMode(seconds: number): number {
  return Math.max(120, Math.ceil(seconds * 4));
}
