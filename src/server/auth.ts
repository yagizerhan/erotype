// SPDX-License-Identifier: AGPL-3.0-or-later
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { getAuthSecret, isEmailPasswordEnabled } from "./config";
import { schema } from "./db/schema";

export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ENABLE_EMAIL_PASSWORD?: string;
}

export function createAuth(env: AuthEnv, requestUrl?: string) {
  const db = drizzle(env.DB, { schema });
  const baseURL =
    env.BETTER_AUTH_URL ||
    (requestUrl ? new URL(requestUrl).origin : "http://localhost:5173");

  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET
    };
  }
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET
    };
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema
    }),
    secret: getAuthSecret(env, requestUrl ?? baseURL),
    baseURL,
    emailAndPassword: {
      enabled: isEmailPasswordEnabled(env, requestUrl ?? baseURL),
      minPasswordLength: 8,
      autoSignIn: true
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days persistent session by default
      updateAge: 60 * 60 * 24
    },
    socialProviders
  });
}
