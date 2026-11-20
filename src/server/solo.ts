// SPDX-License-Identifier: AGPL-3.0-or-later
// Authoritative verification and scoring for solo test submissions.
// Pure module: no D1 / Workers API dependencies so it can be unit-tested.
import { MAX_BURST_WPM, MAX_WPM } from "../shared/constants";
import {
  calculateWpm,
  generateWordSequence,
  splitWords,
  wordCountForTimeMode
} from "../shared/text";
import {
  MAX_TYPED_WORD_LENGTH,
  countTypedChars,
  sanitizeTypedWords
} from "../shared/verify";
import trWords from "../../data/languages/tr/words-1k.json";
import enWords from "../../data/languages/en/words-1k.json";
import trQuotes from "../../data/languages/tr/quotes.json";
import enQuotes from "../../data/languages/en/quotes.json";
import { type SignedTestTicket, verifyTestTicket } from "./ticket";

export const TIME_OPTIONS_SEC: readonly number[] = [15, 30, 60, 120];
export const WORD_OPTIONS: readonly number[] = [10, 25, 50, 100];

/** Clock skew / network latency tolerance. */
export const WALL_CLOCK_SLACK_MS = 1_500;

export interface Quote {
  id: string;
  text: string;
}

/** Matches the client's deterministic quote selection: pool[(seed - 1) % pool.length]. */
export function pickQuote(lang: "tr" | "en", seed: number): Quote {
  const pool = (lang === "en" ? enQuotes : trQuotes) as Quote[];
  return pool[(seed - 1) % pool.length] ?? pool[0];
}

/** Reconstructs the exact word sequence shown to the client from the signed ticket. */
export function expectedWordsForTicket(ticket: SignedTestTicket): string[] | null {
  if (ticket.mode === "quote") {
    const quote = pickQuote(ticket.lang, ticket.seed);
    if (quote.id !== ticket.mode2) return null;
    return splitWords(quote.text);
  }
  const pool = ticket.lang === "en" ? enWords : trWords;
  const n = Number(ticket.mode2);
  let count: number;
  if (ticket.mode === "time") {
    if (!TIME_OPTIONS_SEC.includes(n)) return null;
    count = wordCountForTimeMode(n);
  } else {
    if (!WORD_OPTIONS.includes(n)) return null;
    count = n;
  }
  return generateWordSequence(pool, count, ticket.seed, ticket.lang, {
    punctuation: ticket.punctuation,
    numbers: ticket.numbers
  });
}

export interface ResultSubmission {
  typed?: unknown;
  partial?: unknown;
  durationMs?: unknown;
  keystrokes?: unknown;
  errors?: unknown;
  consistency?: unknown;
}

export type ScoreOutcome =
  | {
      ok: true;
      wpm: number;
      rawWpm: number;
      acc: number;
      consistency: number;
      durationMs: number;
    }
  | { ok: false; status: 400 | 403; reason: string };

function fail(reason: string, status: 400 | 403 = 400): ScoreOutcome {
  return { ok: false, status, reason };
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export async function verifyAndScoreResult(
  ticket: SignedTestTicket,
  sub: ResultSubmission,
  ctx: { userId: string; secret: string; now: number }
): Promise<ScoreOutcome> {
  const sig = await verifyTestTicket(ticket, ctx.secret, ctx.now);
  if (!sig.ok) return fail(sig.reason);

  if (ticket.userId !== ctx.userId) {
    return fail("Bu test bileti başka bir oturuma ait.", 403);
  }

  const expected = expectedWordsForTicket(ticket);
  if (!expected || expected.length === 0) return fail("Geçersiz test parametreleri.");

  const typed = sanitizeTypedWords(sub.typed, expected.length);
  if (!typed) return fail("Yazılan kelimeler geçersiz.");
  const partial =
    typeof sub.partial === "string" && sub.partial.length <= MAX_TYPED_WORD_LENGTH
      ? sub.partial
      : "";

  // Duration: fixed in time mode, client-measured (bounded by wall clock) in other modes
  let durationMs: number;
  if (ticket.mode === "time") {
    durationMs = Number(ticket.mode2) * 1_000;
  } else {
    if (typed.length !== expected.length) return fail("Test tamamlanmamış.");
    durationMs = Math.max(500, toInt(sub.durationMs));
  }

  if (durationMs > ctx.now - ticket.issuedAt + WALL_CLOCK_SLACK_MS) {
    return fail("Süre doğrulaması başarısız.");
  }

  const stats = countTypedChars(expected, typed, ticket.mode === "time" ? partial : "");
  const wpm = calculateWpm(stats.correct, durationMs);
  if (wpm <= 0 || wpm > MAX_WPM) return fail("Geçersiz WPM hızı.");

  // Keystrokes and errors come from the client, clamped to be consistent with the typed text
  const keystrokes = Math.max(stats.typedTotal, toInt(sub.keystrokes));
  const rawWpm = calculateWpm(keystrokes, durationMs);
  if (rawWpm > MAX_BURST_WPM) return fail("Geçersiz ham WPM hızı.");

  const errors = Math.min(keystrokes, Math.max(stats.incorrect, toInt(sub.errors)));
  const acc =
    keystrokes > 0 ? Math.round(((keystrokes - errors) / keystrokes) * 100) : 100;

  const rawCons = Number(sub.consistency);
  const consistency = Number.isFinite(rawCons)
    ? Math.max(0, Math.min(100, Math.round(rawCons)))
    : 0;

  return { ok: true, wpm, rawWpm, acc, consistency, durationMs };
}
