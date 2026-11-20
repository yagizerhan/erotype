// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { expectedWordsForTicket, pickQuote, verifyAndScoreResult } from "./solo";
import { type TestTicketPayload, signTestTicket } from "./ticket";

const SECRET = "test-secret-that-is-long-enough-123456";
const ISSUED = 1_800_000_000_000;

async function ticket(patch: Partial<TestTicketPayload> = {}) {
  return signTestTicket(
    {
      testId: "t-1",
      seed: 12345,
      mode: "words",
      mode2: "10",
      lang: "tr",
      punctuation: false,
      numbers: false,
      userId: "u-1",
      issuedAt: ISSUED,
      ...patch
    },
    SECRET
  );
}

const ctx = (now: number, userId = "u-1") => ({ userId, secret: SECRET, now });

describe("verifyAndScoreResult", () => {
  it("scores a correctly typed words test from the server's own word list", async () => {
    const t = await ticket();
    const words = expectedWordsForTicket(t)!;
    const chars = words.join(" ").length;
    const res = await verifyAndScoreResult(
      t,
      { typed: words, durationMs: 10_000, keystrokes: chars, errors: 0, consistency: 90 },
      ctx(ISSUED + 15_000)
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.wpm).toBeCloseTo((chars / 5) * 6, 0);
      expect(res.acc).toBe(100);
      expect(res.consistency).toBe(90);
    }
  });

  it("does not credit words that were not actually typed correctly", async () => {
    const t = await ticket();
    const words = expectedWordsForTicket(t)!;
    const garbage = words.map(() => "zzzz");
    const res = await verifyAndScoreResult(
      t,
      { typed: garbage, durationMs: 10_000 },
      ctx(ISSUED + 15_000)
    );
    // No correct characters -> WPM 0 -> rejected
    expect(res.ok).toBe(false);
  });

  it("rejects incomplete words-mode submissions", async () => {
    const t = await ticket();
    const words = expectedWordsForTicket(t)!;
    const res = await verifyAndScoreResult(
      t,
      { typed: words.slice(0, 5), durationMs: 5_000 },
      ctx(ISSUED + 15_000)
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a duration longer than the real elapsed wall-clock time", async () => {
    const t = await ticket();
    const words = expectedWordsForTicket(t)!;
    const res = await verifyAndScoreResult(
      t,
      { typed: words, durationMs: 60_000 },
      ctx(ISSUED + 10_000)
    );
    expect(res).toMatchObject({ ok: false, reason: "Süre doğrulaması başarısız." });
  });

  it("rejects impossible WPM", async () => {
    const t = await ticket();
    const words = expectedWordsForTicket(t)!;
    const res = await verifyAndScoreResult(
      t,
      { typed: words, durationMs: 500 },
      ctx(ISSUED + 10_000)
    );
    expect(res).toMatchObject({ ok: false, reason: "Geçersiz WPM hızı." });
  });

  it("rejects a ticket belonging to another user", async () => {
    const t = await ticket();
    const words = expectedWordsForTicket(t)!;
    const res = await verifyAndScoreResult(
      t,
      { typed: words, durationMs: 10_000 },
      ctx(ISSUED + 15_000, "u-2")
    );
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("uses the fixed duration in time mode, ignoring the client's claim", async () => {
    const t = await ticket({ mode: "time", mode2: "15" });
    const words = expectedWordsForTicket(t)!;
    const typed = words.slice(0, 10);
    const res = await verifyAndScoreResult(
      t,
      { typed, partial: "", durationMs: 1_000 },
      ctx(ISSUED + 16_000)
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.durationMs).toBe(15_000);
  });

  it("rejects a time-mode result submitted before the time could have elapsed", async () => {
    const t = await ticket({ mode: "time", mode2: "60" });
    const words = expectedWordsForTicket(t)!;
    const res = await verifyAndScoreResult(
      t,
      { typed: words.slice(0, 20) },
      ctx(ISSUED + 20_000)
    );
    expect(res.ok).toBe(false);
  });

  it("forces accuracy below 100 when wrong characters remain", async () => {
    const t = await ticket();
    const words = [...expectedWordsForTicket(t)!];
    words[0] = words[0].slice(0, -1) + "#";
    const res = await verifyAndScoreResult(
      t,
      { typed: words, durationMs: 10_000, errors: 0 },
      ctx(ISSUED + 15_000)
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.acc).toBeLessThan(100);
  });

  it("rejects non-whitelisted mode2 values", async () => {
    const t = await ticket({ mode2: "3" });
    const res = await verifyAndScoreResult(t, { typed: [] }, ctx(ISSUED + 15_000));
    expect(res.ok).toBe(false);
  });

  it("accepts quote mode only when mode2 matches the seed's quote", async () => {
    const seed = 7;
    const good = await ticket({ mode: "quote", seed, mode2: pickQuote("tr", seed).id });
    expect(expectedWordsForTicket(good)).not.toBeNull();
    const bad = await ticket({ mode: "quote", seed, mode2: "tr-xxxx" });
    expect(expectedWordsForTicket(bad)).toBeNull();
  });
});
