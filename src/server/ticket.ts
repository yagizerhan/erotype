// SPDX-License-Identifier: AGPL-3.0-or-later
// Stateless HMAC-signed solo test ticket

export interface TestTicketPayload {
  testId: string;
  seed: number;
  mode: "time" | "words" | "quote";
  mode2: string;
  lang: "tr" | "en";
  punctuation: boolean;
  numbers: boolean;
  userId: string;
  issuedAt: number;
}

export interface SignedTestTicket extends TestTicketPayload {
  sig: string;
}

const TICKET_MAX_AGE_MS = 10 * 60 * 1_000; // 10 minutes

function serializeTicketPayload(p: TestTicketPayload): string {
  return [
    p.testId,
    p.seed,
    p.mode,
    p.mode2,
    p.lang,
    p.punctuation ? 1 : 0,
    p.numbers ? 1 : 0,
    p.userId,
    p.issuedAt
  ].join("|");
}

async function computeHmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signTestTicket(
  payload: TestTicketPayload,
  secret: string
): Promise<SignedTestTicket> {
  const sig = await computeHmacHex(secret, serializeTicketPayload(payload));
  return { ...payload, sig };
}

export async function verifyTestTicket(
  ticket: SignedTestTicket,
  secret: string,
  now = Date.now()
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (now - ticket.issuedAt > TICKET_MAX_AGE_MS || ticket.issuedAt > now + 5_000) {
    return { ok: false, reason: "Test biletinin süresi dolmuş." };
  }
  const expected = await computeHmacHex(secret, serializeTicketPayload(ticket));
  if (expected !== ticket.sig) {
    return { ok: false, reason: "Geçersiz test bileti imzası." };
  }
  return { ok: true };
}
