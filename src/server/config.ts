// SPDX-License-Identifier: AGPL-3.0-or-later
// Secret keys: dev defaults on localhost, REQUIRED in production.
// Since the source code is public, default keys are known to everyone;
// falling back to them in production would allow session and ticket forgery.

const DEV_AUTH_SECRET = "erotype-dev-default-secret-key-at-least-32-chars";
const DEV_TICKET_SECRET = "erotype-dev-ticket-secret-key";
const MIN_SECRET_LENGTH = 32;

export interface SecretEnv {
  BETTER_AUTH_SECRET?: string;
  TEST_TICKET_SECRET?: string;
}

export class ConfigError extends Error {}

/** localhost, 127.0.0.1, [::1] and *.localhost are treated as local development. */
export function isDevHost(requestUrl: string): boolean {
  const host = new URL(requestUrl).hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".localhost")
  );
}

function pick(
  value: string | undefined,
  devDefault: string,
  name: string,
  requestUrl: string
): string {
  if (value && value.length >= MIN_SECRET_LENGTH) return value;
  if (isDevHost(requestUrl)) return value || devDefault;
  throw new ConfigError(
    `${name} is missing or shorter than ${MIN_SECRET_LENGTH} characters. ` +
      "Set it with `npx wrangler secret put " + name + "`."
  );
}

/**
 * Email/password sign-in is OFF by default in production (no email verification or
 * password reset flow, and password hashing can exceed the Free plan's 10ms CPU limit).
 * To enable, set wrangler.jsonc -> vars: { "ENABLE_EMAIL_PASSWORD": "true" }.
 * Enabled on localhost for easier local testing.
 */
export function isEmailPasswordEnabled(
  env: { ENABLE_EMAIL_PASSWORD?: string },
  requestUrl: string
): boolean {
  return env.ENABLE_EMAIL_PASSWORD === "true" || isDevHost(requestUrl);
}

export function getAuthSecret(env: SecretEnv, requestUrl: string): string {
  return pick(env.BETTER_AUTH_SECRET, DEV_AUTH_SECRET, "BETTER_AUTH_SECRET", requestUrl);
}

export function getTicketSecret(env: SecretEnv, requestUrl: string): string {
  return pick(env.TEST_TICKET_SECRET, DEV_TICKET_SECRET, "TEST_TICKET_SECRET", requestUrl);
}
