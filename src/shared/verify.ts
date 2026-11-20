// SPDX-License-Identifier: AGPL-3.0-or-later
import { normalizeWord } from "./text";

/** Maximum length of a single typed word accepted by the server (abuse cap). */
export const MAX_TYPED_WORD_LENGTH = 64;

export interface TypedCharStats {
  /** Correct characters counted toward WPM (including trailing space after fully correct words). */
  correct: number;
  /** Remaining wrong / missing / extra characters in the result. */
  incorrect: number;
  /** Total characters typed by the user (including spaces). Lower bound on keystrokes. */
  typedTotal: number;
}

/**
 * Compares expected words against typed words and counts character stats.
 * Uses the same rules as the client's live WPM calculation so the server can
 * recompute scores authoritatively without trusting client-reported numbers.
 *
 * - `typed`: words committed via space.
 * - `partial`: in-progress word when time expires (timed mode).
 */
export function countTypedChars(
  expected: readonly string[],
  typed: readonly string[],
  partial = ""
): TypedCharStats {
  let correct = 0;
  let incorrect = 0;
  let typedTotal = 0;

  const n = Math.min(typed.length, expected.length);
  for (let i = 0; i < n; i++) {
    const exp = expected[i];
    const act = normalizeWord(typed[i] ?? "");
    const hasSpace = i < expected.length - 1;
    typedTotal += act.length + (hasSpace ? 1 : 0);

    if (act === exp) {
      correct += exp.length + (hasSpace ? 1 : 0);
      continue;
    }
    let matches = 0;
    const len = Math.min(exp.length, act.length);
    for (let c = 0; c < len; c++) {
      if (act[c] === exp[c]) matches++;
    }
    correct += matches;
    incorrect += Math.max(exp.length, act.length) - matches;
  }

  if (partial && typed.length < expected.length) {
    const exp = expected[typed.length];
    const act = normalizeWord(partial);
    typedTotal += act.length;
    const len = Math.min(exp.length, act.length);
    for (let c = 0; c < len; c++) {
      if (act[c] === exp[c]) correct++;
      else incorrect++;
    }
    // Missing trailing letters in a partial word are not penalized (time expired); extra letters are
    if (act.length > exp.length) incorrect += act.length - exp.length;
  }

  return { correct, incorrect, typedTotal };
}

/** Validates and normalizes the incoming JSON `typed` field into a string array. */
export function sanitizeTypedWords(raw: unknown, maxWords: number): string[] | null {
  if (!Array.isArray(raw) || raw.length > maxWords) return null;
  const out: string[] = [];
  for (const w of raw) {
    if (typeof w !== "string" || w.length > MAX_TYPED_WORD_LENGTH) return null;
    out.push(w);
  }
  return out;
}
