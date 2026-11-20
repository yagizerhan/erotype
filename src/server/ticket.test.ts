// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { type TestTicketPayload, signTestTicket, verifyTestTicket } from "./ticket";

const SECRET = "test-secret-that-is-long-enough-123456";
const NOW = 1_800_000_000_000;

const payload: TestTicketPayload = {
  testId: "t-1",
  seed: 42,
  mode: "time",
  mode2: "30",
  lang: "tr",
  punctuation: false,
  numbers: false,
  userId: "u-1",
  issuedAt: NOW
};

describe("test ticket", () => {
  it("verifies a freshly signed ticket", async () => {
    const t = await signTestTicket(payload, SECRET);
    expect(await verifyTestTicket(t, SECRET, NOW + 1_000)).toEqual({ ok: true });
  });

  it("rejects a ticket signed with another secret", async () => {
    const t = await signTestTicket(payload, "another-secret-another-secret-xx");
    expect((await verifyTestTicket(t, SECRET, NOW)).ok).toBe(false);
  });

  it.each([
    ["seed", { seed: 43 }],
    ["mode2", { mode2: "15" }],
    ["userId", { userId: "u-2" }],
    ["issuedAt", { issuedAt: NOW - 1 }],
    ["punctuation", { punctuation: true }]
  ])("rejects a ticket whose %s was tampered with", async (_name, patch) => {
    const t = await signTestTicket(payload, SECRET);
    const tampered = { ...t, ...patch };
    expect((await verifyTestTicket(tampered, SECRET, NOW)).ok).toBe(false);
  });

  it("rejects expired tickets (older than 10 minutes)", async () => {
    const t = await signTestTicket(payload, SECRET);
    expect((await verifyTestTicket(t, SECRET, NOW + 10 * 60_000 + 1)).ok).toBe(false);
  });

  it("rejects tickets issued in the future beyond clock tolerance", async () => {
    const t = await signTestTicket(payload, SECRET);
    expect((await verifyTestTicket(t, SECRET, NOW - 6_000)).ok).toBe(false);
    expect((await verifyTestTicket(t, SECRET, NOW - 4_000)).ok).toBe(true);
  });
});
