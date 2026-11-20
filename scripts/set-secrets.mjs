// SPDX-License-Identifier: AGPL-3.0-or-later
// Generates the two required production secrets randomly and uploads them to Cloudflare.
// Secrets are never printed to stdout or written to disk.
//
//   node scripts/set-secrets.mjs          -> sets only missing secrets
//   node scripts/set-secrets.mjs --force  -> rotates both secrets (invalidates all sessions!)
import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const NAMES = ["BETTER_AUTH_SECRET", "TEST_TICKET_SECRET"];
const force = process.argv.includes("--force");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

let existing = [];
try {
  const out = execSync(`${npx} wrangler secret list --format json`, {
    encoding: "utf8"
  });
  existing = JSON.parse(out.slice(out.indexOf("["))).map((s) => s.name);
} catch {
  // If listing fails, attempt to set all secrets
}

for (const name of NAMES) {
  if (existing.includes(name) && !force) {
    console.log(`✓ ${name} is already set, skipping`);
    continue;
  }
  const value = randomBytes(32).toString("base64url");
  const res = spawnSync(`${npx} wrangler secret put ${name}`, {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true
  });
  if (res.status !== 0) {
    console.error(`✗ Failed to set ${name}`);
    process.exit(1);
  }
  console.log(`✓ ${name} set`);
}
