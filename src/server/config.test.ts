// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { ConfigError, getAuthSecret, getTicketSecret, isDevHost } from "./config";

const LONG = "x".repeat(32);

describe("secret configuration", () => {
  it("recognises local development hosts", () => {
    expect(isDevHost("http://localhost:5173/api")).toBe(true);
    expect(isDevHost("http://127.0.0.1:8787/")).toBe(true);
    expect(isDevHost("http://app.localhost/")).toBe(true);
    expect(isDevHost("https://erotype.example.workers.dev/")).toBe(false);
  });

  it("falls back to dev defaults only on local hosts", () => {
    expect(getAuthSecret({}, "http://localhost:5173/")).toMatch(/^erotype-dev/);
    expect(() => getAuthSecret({}, "https://erotype.workers.dev/")).toThrow(ConfigError);
    expect(() => getTicketSecret({}, "https://erotype.workers.dev/")).toThrow(ConfigError);
  });

  it("rejects short secrets in production and accepts long ones", () => {
    const prod = "https://erotype.workers.dev/";
    expect(() => getAuthSecret({ BETTER_AUTH_SECRET: "short" }, prod)).toThrow(ConfigError);
    expect(getAuthSecret({ BETTER_AUTH_SECRET: LONG }, prod)).toBe(LONG);
    expect(getTicketSecret({ TEST_TICKET_SECRET: LONG }, prod)).toBe(LONG);
  });
});
