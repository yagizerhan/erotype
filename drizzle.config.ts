// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from "drizzle-kit";

// Generate migrations: npx drizzle-kit generate
// Apply locally:       npx wrangler d1 migrations apply DB --local
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./migrations"
});
