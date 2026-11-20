// SPDX-License-Identifier: AGPL-3.0-or-later
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  DEFAULT_MAX_PLAYERS,
  ROOM_ID_ALPHABET,
  ROOM_ID_LENGTH
} from "../shared/constants";
import { type AuthEnv, createAuth } from "./auth";
import {
  ConfigError,
  getTicketSecret,
  isEmailPasswordEnabled
} from "./config";
import { personalBest, profile, result, schema } from "./db/schema";
import { variantMode2 } from "../shared/variant";
import { RoomDO, USER_ID_HEADER } from "./room-do";
import {
  TIME_OPTIONS_SEC,
  WORD_OPTIONS,
  pickQuote,
  verifyAndScoreResult
} from "./solo";
import { type SignedTestTicket, signTestTicket } from "./ticket";

export { RoomDO };

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env extends AuthEnv {
  ROOMS: DurableObjectNamespace<RoomDO>;
  DB: D1Database;
  TEST_TICKET_SECRET?: string;
  /** Strict rate limit: room creation, sign-in/sign-up (wrangler.jsonc -> ratelimits) */
  RL_STRICT?: RateLimiter;
  /** General API rate limit: test tickets, result submission, WS upgrades */
  RL_API?: RateLimiter;
}

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

/** Profile avatar: client resizes to 128x128; data-URL size cap matches that. */
const MAX_AVATAR_DATA_URL_LENGTH = 60_000;
// SVG intentionally excluded: serving untrusted SVG from our own origin can execute scripts.
const AVATAR_DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

/** Cryptographic seed (1..2^31-1); must be unpredictable. */
function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return 1 + (buf[0] % 0x7ffffffe);
}

/**
 * Applies Cloudflare Workers Rate Limiting binding. If the binding is absent
 * (e.g. older local setup), allows the request through.
 */
async function allowRequest(
  c: AppContext,
  binding: "RL_STRICT" | "RL_API",
  scope: string
): Promise<boolean> {
  const limiter = c.env[binding];
  if (!limiter) return true;
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  try {
    const { success } = await limiter.limit({ key: `${scope}:${ip}` });
    return success;
  } catch {
    return true;
  }
}

function tooManyRequests(c: AppContext) {
  return c.json({ error: "Çok fazla istek. Lütfen biraz bekleyin." }, 429);
}

/** Returns a short, cacheable avatar URL instead of inlining a large data-URL. */
function avatarUrl(username: string, image: string | null | undefined, version?: number | Date | null): string | null {
  if (!image) return null;
  if (image.startsWith("https://")) return image;
  const v = version instanceof Date ? version.getTime() : version ?? 0;
  return `/api/avatars/${encodeURIComponent(username)}?v=${v}`;
}

app.onError((err, c) => {
  if (err instanceof ConfigError) {
    console.error("[config]", err.message);
    return c.json({ error: "Sunucu yapılandırması eksik." }, 500);
  }
  console.error(err);
  return c.json({ error: "Sunucu hatası." }, 500);
});

// Which sign-in methods the auth modal should display
app.get("/api/auth-config", (c) => {
  return c.json({
    emailPassword: isEmailPasswordEnabled(c.env, c.req.url),
    github: Boolean(c.env.GITHUB_CLIENT_ID && c.env.GITHUB_CLIENT_SECRET),
    google: Boolean(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET)
  });
});

/** Room code format: prevents waking arbitrary DO instances and wasting quota. */
const ROOM_ID_RE = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);

function parseRoomId(raw: string | undefined): string | null {
  const id = (raw ?? "").toUpperCase();
  return ROOM_ID_RE.test(id) ? id : null;
}

function generateRoomId(): string {
  const bytes = new Uint8Array(ROOM_ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[bytes[i] % ROOM_ID_ALPHABET.length];
  }
  return id;
}

function sanitizeUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  return cleaned.length >= 3 ? cleaned : `oyuncu_${Math.floor(100 + Math.random() * 900)}`;
}

async function getSessionUser(c: { env: Env; req: { raw: Request } }) {
  const auth = createAuth(c.env, c.req.raw.url);
  const sessionData = await auth.api.getSession({
    headers: c.req.raw.headers
  });
  return sessionData?.user ?? null;
}

async function ensureUserProfile(db: ReturnType<typeof drizzle>, user: { id: string; name: string }) {
  const existing = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .get();
  if (existing) return existing;

  const baseName = sanitizeUsername(user.name || "oyuncu");
  let candidate = baseName;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = {
        userId: user.id,
        username: candidate,
        createdAt: Date.now(),
        racesTotal: 0,
        racesWon: 0,
        testsTotal: 0,
        banned: 0
      };
      await db.insert(profile).values(created);
      return created;
    } catch {
      candidate = `${baseName.slice(0, 15)}_${Math.floor(100 + Math.random() * 900)}`;
    }
  }
  return null;
}

app.get("/api/health", (c) => {
  return c.json({ ok: true, time: Date.now() });
});

// ---------------------------------------------------------------------------
// 1) Better Auth Endpoint (/api/auth/*)
// ---------------------------------------------------------------------------
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  // Rate-limit sign-in / sign-up / password attempts (brute-force & account spam)
  if (c.req.method === "POST" && !(await allowRequest(c, "RL_STRICT", "auth"))) {
    return tooManyRequests(c);
  }
  const auth = createAuth(c.env, c.req.url);
  return auth.handler(c.req.raw);
});

// ---------------------------------------------------------------------------
// 2) User Profile & Personal Bests (/api/me, /api/profile)
// ---------------------------------------------------------------------------
app.get("/api/me", async (c) => {
  const sessionUser = await getSessionUser(c);
  if (!sessionUser) {
    return c.json({ user: null, profile: null, pbs: [], recentResults: [] });
  }

  const db = drizzle(c.env.DB, { schema });
  const dbUser = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, sessionUser.id))
    .get();
  const prof = await ensureUserProfile(db, sessionUser);

  const pbs = await db
    .select()
    .from(personalBest)
    .where(eq(personalBest.userId, sessionUser.id))
    .all();

  const recentResults = await db
    .select()
    .from(result)
    .where(eq(result.userId, sessionUser.id))
    .orderBy(desc(result.createdAt))
    .limit(15)
    .all();

  return c.json({
    user: {
      id: sessionUser.id,
      name: dbUser?.name ?? sessionUser.name,
      email: dbUser?.email ?? sessionUser.email,
      image: dbUser?.image ?? sessionUser.image ?? null
    },
    profile: prof,
    pbs,
    recentResults
  });
});

app.post("/api/profile", async (c) => {
  const sessionUser = await getSessionUser(c);
  if (!sessionUser) {
    return c.json({ error: "Giriş yapmalısınız." }, 401);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    username?: string;
    name?: string;
    bio?: string | null;
    image?: string | null;
  };

  const db = drizzle(c.env.DB, { schema });
  await ensureUserProfile(db, sessionUser);

  if (body.username !== undefined) {
    const raw = body.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(raw)) {
      return c.json(
        {
          error:
            "Kullanıcı adı 3-20 karakter olmalı ve sadece a-z, 0-9, _ içermelidir."
        },
        400
      );
    }
    try {
      await db
        .update(profile)
        .set({ username: raw })
        .where(eq(profile.userId, sessionUser.id));
    } catch {
      return c.json({ error: "Bu kullanıcı adı zaten alınmış." }, 409);
    }
  }

  if (body.bio !== undefined) {
    const cleanedBio =
      typeof body.bio === "string"
        ? body.bio.normalize("NFC").trim().slice(0, 140)
        : null;
    await db
      .update(profile)
      .set({ bio: cleanedBio || null })
      .where(eq(profile.userId, sessionUser.id));
  }

  const userUpdates: { name?: string; image?: string | null; updatedAt?: Date } =
    {};
  if (typeof body.name === "string") {
    const cleanedName = body.name.normalize("NFC").trim().slice(0, 60);
    if (cleanedName.length >= 1) {
      userUpdates.name = cleanedName;
    }
  }
  if (body.image !== undefined) {
    if (body.image === null || body.image === "") {
      userUpdates.image = null;
    } else if (
      typeof body.image === "string" &&
      body.image.length <= MAX_AVATAR_DATA_URL_LENGTH &&
      AVATAR_DATA_URL_RE.test(body.image)
    ) {
      userUpdates.image = body.image;
    } else if (typeof body.image === "string" && body.image.startsWith("https://")) {
      // Only allow an external HTTPS URL if it is already stored (from Google/GitHub OAuth).
      // Allowing arbitrary HTTPS URLs would enable IP-tracking pixels on the leaderboard
      // and an open redirect via /api/avatars.
      const current = await db
        .select({ image: schema.user.image })
        .from(schema.user)
        .where(eq(schema.user.id, sessionUser.id))
        .get();
      if (current?.image !== body.image) {
        return c.json({ error: "Geçersiz profil fotoğrafı formatı." }, 400);
      }
    } else {
      return c.json({ error: "Geçersiz profil fotoğrafı formatı." }, 400);
    }
  }

  if (Object.keys(userUpdates).length > 0) {
    userUpdates.updatedAt = new Date();
    await db
      .update(schema.user)
      .set(userUpdates)
      .where(eq(schema.user.id, sessionUser.id));
  }

  return c.json({ ok: true });
});

// Account deletion (right to erasure). Permanently deletes the user and all associated data.
// Requires typing the username to confirm. JSON + same-origin check protects against CSRF:
// cross-origin JSON POSTs trigger a CORS preflight and form POSTs are rejected.
app.post("/api/account/delete", async (c) => {
  if (!(await allowRequest(c, "RL_STRICT", "account-delete"))) return tooManyRequests(c);
  const origin = c.req.header("origin");
  if (
    !c.req.header("content-type")?.includes("application/json") ||
    (origin && origin !== new URL(c.req.url).origin)
  ) {
    return c.json({ error: "Geçersiz istek." }, 400);
  }

  const sessionUser = await getSessionUser(c);
  if (!sessionUser) {
    return c.json({ error: "Giriş yapmalısınız." }, 401);
  }

  const body = (await c.req.json().catch(() => ({}))) as { confirm?: string };
  const db = drizzle(c.env.DB, { schema });
  const prof = await db
    .select({ username: profile.username })
    .from(profile)
    .where(eq(profile.userId, sessionUser.id))
    .get();
  const expected = prof?.username ?? "";
  if (!expected || (body.confirm ?? "").trim().toLowerCase() !== expected) {
    return c.json({ error: "Onay için kullanıcı adınızı doğru yazın." }, 400);
  }

  // Foreign keys have ON DELETE CASCADE, but we delete explicitly in a single atomic batch.
  const id = sessionUser.id;
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM personal_best WHERE user_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM result WHERE user_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM profile WHERE user_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM session WHERE "userId" = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM account WHERE "userId" = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM "user" WHERE id = ?`).bind(id)
  ]);

  return c.json({ ok: true });
});

app.get("/api/users/:username", async (c) => {
  const rawUsername = (c.req.param("username") || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(rawUsername)) {
    return c.json({ error: "Kullanıcı bulunamadı." }, 404);
  }
  if (!(await allowRequest(c, "RL_API", "users"))) return tooManyRequests(c);

  const db = drizzle(c.env.DB, { schema });
  const prof = await db
    .select()
    .from(profile)
    .where(eq(profile.username, rawUsername))
    .get();

  if (!prof) {
    return c.json({ error: "Kullanıcı bulunamadı." }, 404);
  }

  const dbUser = await db
    .select({
      name: schema.user.name,
      image: schema.user.image,
      updatedAt: schema.user.updatedAt
    })
    .from(schema.user)
    .where(eq(schema.user.id, prof.userId))
    .get();

  // Public endpoint: only expose displayed columns. Internal user ID and room code
  // (which is an invite secret and also appears in race result IDs) are never exposed.
  const pbs = await db
    .select({
      mode: personalBest.mode,
      mode2: personalBest.mode2,
      lang: personalBest.lang,
      wpm: personalBest.wpm,
      acc: personalBest.acc,
      createdAt: personalBest.createdAt
    })
    .from(personalBest)
    .where(eq(personalBest.userId, prof.userId))
    .all();

  const recentRows = await db
    .select({
      mode: result.mode,
      mode2: result.mode2,
      lang: result.lang,
      wpm: result.wpm,
      rawWpm: result.rawWpm,
      acc: result.acc,
      consistency: result.consistency,
      durationMs: result.durationMs,
      place: result.place,
      createdAt: result.createdAt
    })
    .from(result)
    .where(eq(result.userId, prof.userId))
    .orderBy(desc(result.createdAt))
    .limit(12)
    .all();
  const recentResults = recentRows.map((r, i) => ({ id: `${r.createdAt}-${i}`, ...r }));

  return c.json({
    profile: {
      username: prof.username,
      fullName: dbUser?.name ?? prof.username,
      avatar: avatarUrl(prof.username, dbUser?.image, dbUser?.updatedAt),
      bio: prof.bio ?? null,
      createdAt: prof.createdAt,
      testsTotal: prof.testsTotal,
      racesTotal: prof.racesTotal,
      racesWon: prof.racesWon
    },
    pbs,
    recentResults
  });
});

// ---------------------------------------------------------------------------
// 3) Stateless Solo Test Ticket & Authoritative Result Verification
// ---------------------------------------------------------------------------
app.post("/api/tests/start", async (c) => {
  if (!(await allowRequest(c, "RL_API", "tests"))) return tooManyRequests(c);
  const user = await getSessionUser(c);
  const body = (await c.req.json().catch(() => ({}))) as {
    mode?: "time" | "words" | "quote";
    mode2?: string;
    lang?: "tr" | "en";
    punctuation?: boolean;
    numbers?: boolean;
  };

  const mode =
    body.mode === "words" || body.mode === "quote" ? body.mode : "time";
  const lang = body.lang === "en" ? "en" : "tr";
  // Only the server chooses the seed so clients cannot pre-know or cherry-pick easy text.
  const seed = randomSeed();
  let mode2: string;
  if (mode === "time") {
    const sec = Number(body.mode2);
    mode2 = String(TIME_OPTIONS_SEC.includes(sec) ? sec : 60);
  } else if (mode === "words") {
    const cnt = Number(body.mode2);
    mode2 = String(WORD_OPTIONS.includes(cnt) ? cnt : 25);
  } else {
    mode2 = pickQuote(lang, seed).id;
  }

  const secret = getTicketSecret(c.env, c.req.url);

  const ticket = await signTestTicket(
    {
      testId: crypto.randomUUID(),
      seed,
      mode,
      mode2,
      lang,
      punctuation: Boolean(body.punctuation),
      numbers: Boolean(body.numbers),
      userId: user?.id ?? "guest",
      issuedAt: Date.now()
    },
    secret
  );

  return c.json({ ticket });
});

app.post("/api/results", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ ok: false, reason: "GUEST_NOT_SAVED" });
  }

  if (!(await allowRequest(c, "RL_API", "results"))) return tooManyRequests(c);

  const body = (await c.req.json().catch(() => ({}))) as {
    ticket?: SignedTestTicket;
    typed?: unknown;
    partial?: unknown;
    durationMs?: number;
    keystrokes?: number;
    errors?: number;
    consistency?: number;
  };

  if (!body.ticket || typeof body.ticket !== "object") {
    return c.json({ error: "Test bileti eksik." }, 400);
  }

  const now = Date.now();
  const verified = await verifyAndScoreResult(
    body.ticket,
    {
      typed: body.typed,
      partial: body.partial,
      durationMs: body.durationMs,
      keystrokes: body.keystrokes,
      errors: body.errors,
      consistency: body.consistency
    },
    { userId: user.id, secret: getTicketSecret(c.env, c.req.url), now }
  );
  if (!verified.ok) {
    return c.json({ error: verified.reason }, verified.status);
  }

  const { ticket } = body;
  const { wpm, rawWpm, acc, consistency, durationMs } = verified;
  // Punctuation/numbers use separate personal-best keys (see src/shared/variant.ts)
  const boardMode2 = variantMode2(ticket.mode, ticket.mode2, ticket.punctuation, ticket.numbers);

  const db = drizzle(c.env.DB, { schema });

  // Return a clean conflict error if the same ticket (id = testId) is submitted twice
  const duplicate = await db
    .select({ id: result.id })
    .from(result)
    .where(eq(result.id, ticket.testId))
    .get();
  if (duplicate) {
    return c.json({ error: "Bu test sonucu zaten kaydedildi." }, 409);
  }

  const prof = await ensureUserProfile(db, user);
  if (prof?.banned) {
    return c.json({ error: "Bu hesabın sonuçları kaydedilmiyor." }, 403);
  }

  // Insert result (id = testId prevents duplicate submission). Under concurrent requests
  // both could pass the check above; PK conflict -> 409.
  const inserted = await db
    .insert(result)
    .values({
      id: ticket.testId,
      userId: user.id,
      mode: ticket.mode,
      mode2: boardMode2,
      lang: ticket.lang,
      wpm,
      rawWpm,
      acc,
      consistency,
      durationMs,
      roomId: null,
      place: null,
      createdAt: now
    })
    .onConflictDoNothing()
    .returning({ id: result.id });
  if (inserted.length === 0) {
    return c.json({ error: "Bu test sonucu zaten kaydedildi." }, 409);
  }

  // Counter + PB update in a single atomic batch. Conditional upsert ensures only a higher
  // WPM overwrites the PB even under concurrent submissions (no read-compare-write race).
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(`UPDATE profile SET tests_total = tests_total + 1 WHERE user_id = ?1`).bind(
      user.id
    )
  ];
  if (acc >= 50) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO personal_best (user_id, mode, mode2, lang, wpm, acc, result_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT (user_id, mode, mode2, lang) DO UPDATE SET
           wpm = excluded.wpm, acc = excluded.acc,
           result_id = excluded.result_id, created_at = excluded.created_at
         WHERE excluded.wpm > personal_best.wpm
         RETURNING result_id`
      ).bind(user.id, ticket.mode, boardMode2, ticket.lang, wpm, acc, ticket.testId, now)
    );
  }
  const batchResults = await c.env.DB.batch(statements);
  const isNewBest = acc >= 50 && (batchResults[1]?.results?.length ?? 0) > 0;

  return c.json({
    ok: true,
    wpm,
    rawWpm,
    acc,
    consistency,
    isNewBest
  });
});

// ---------------------------------------------------------------------------
// 4) Leaderboard with Workers Cache API & Index
// ---------------------------------------------------------------------------
app.get("/api/leaderboard", async (c) => {
  const rawMode = c.req.query("mode");
  const mode = rawMode === "words" || rawMode === "quote" ? rawMode : "time";
  const rawMode2 = c.req.query("mode2") || "60";
  if (!/^[a-z0-9:-]{1,32}$/.test(rawMode2)) {
    return c.json({ error: "Geçersiz mod." }, 400);
  }
  const mode2 = rawMode2;
  const lang = c.req.query("lang") === "en" ? "en" : "tr";

  // Build the cache key solely from normalized parameters so arbitrary query params
  // (e.g. ?x=123) cannot bypass the cache and hit D1 directly.
  const cacheKeyUrl = new URL("/api/leaderboard", c.req.url);
  cacheKeyUrl.search = new URLSearchParams({ mode, mode2, lang }).toString();
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });
  const cache = typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : null;

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }
  if (!(await allowRequest(c, "RL_API", "leaderboard"))) return tooManyRequests(c);

  const rows = await c.env.DB.prepare(
    `SELECT pb.wpm, pb.acc, pb.created_at as createdAt, p.username,
            CASE WHEN u.image IS NULL OR u.image = '' THEN NULL
                 WHEN u.image LIKE 'https://%' THEN u.image
                 ELSE '/api/avatars/' || p.username || '?v=' || u."updatedAt" END as avatar,
            u.name as fullName
     FROM personal_best pb
     INNER JOIN profile p ON p.user_id = pb.user_id
     LEFT JOIN user u ON u.id = pb.user_id
     WHERE pb.mode = ?1 AND pb.mode2 = ?2 AND pb.lang = ?3 AND p.banned = 0
     ORDER BY pb.wpm DESC
     LIMIT 50`
  )
    .bind(mode, mode2, lang)
    .all<{
      wpm: number;
      acc: number;
      createdAt: number;
      username: string;
      avatar?: string | null;
      fullName?: string | null;
    }>();

  const res = Response.json(
    {
      mode,
      mode2,
      lang,
      rows: rows.results ?? []
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30"
      }
    }
  );

  if (cache) {
    c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  }

  return res;
});

// Serve avatar images from a separate cacheable endpoint instead of embedding
// tens of KB of data-URLs into leaderboard responses.
app.get("/api/avatars/:username", async (c) => {
  if (!(await allowRequest(c, "RL_API", "avatars"))) return tooManyRequests(c);
  const username = (c.req.param("username") || "").trim().toLowerCase();
  const row = await c.env.DB.prepare(
    `SELECT u.image as image FROM profile p INNER JOIN user u ON u.id = p.user_id WHERE p.username = ?1`
  )
    .bind(username)
    .first<{ image: string | null }>();

  const image = row?.image;
  if (!image) return c.body(null, 404);
  if (image.startsWith("https://")) return c.redirect(image, 302);

  const match = AVATAR_DATA_URL_RE.exec(image);
  if (!match) return c.body(null, 404);
  const bytes = Uint8Array.from(atob(match[2]), (ch) => ch.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "Content-Type": match[1],
      // Cache-busted via ?v= version query param when avatar updates
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    }
  });
});

// ---------------------------------------------------------------------------
// 5) Multiplayer Rooms (/api/rooms, /api/rooms/:roomId/ws)
// ---------------------------------------------------------------------------
app.post("/api/rooms", async (c) => {
  if (!(await allowRequest(c, "RL_STRICT", "rooms"))) return tooManyRequests(c);
  const body = (await c.req.json().catch(() => ({}))) as {
    maxPlayers?: unknown;
    lang?: "tr" | "en";
  };
  // Fall back to default for non-numeric values; DO also clamps to MIN..MAX
  const maxPlayers =
    typeof body.maxPlayers === "number" && Number.isFinite(body.maxPlayers)
      ? Math.round(body.maxPlayers)
      : DEFAULT_MAX_PLAYERS;

  for (let attempt = 0; attempt < 5; attempt++) {
    const roomId = generateRoomId();
    const id = c.env.ROOMS.idFromName(roomId);
    const stub = c.env.ROOMS.get(id);

    const res = await stub.fetch("https://room/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        maxPlayers,
        lang: body.lang === "en" ? "en" : "tr"
      })
    });

    if (res.ok) {
      const origin = new URL(c.req.url).origin;
      return c.json({
        roomId,
        url: `${origin}/r/${roomId}`
      });
    }
  }

  return c.json({ error: "Oda oluşturulamadı, lütfen tekrar deneyin." }, 500);
});

app.get("/api/rooms/:roomId", async (c) => {
  const roomId = parseRoomId(c.req.param("roomId"));
  if (!roomId) return c.json({ ok: false, code: "ROOM_NOT_FOUND" }, 404);
  if (!(await allowRequest(c, "RL_API", "room-info"))) return tooManyRequests(c);
  const id = c.env.ROOMS.idFromName(roomId);
  const stub = c.env.ROOMS.get(id);
  return stub.fetch("https://room/info");
});

app.get("/api/rooms/:roomId/ws", async (c) => {
  const roomId = parseRoomId(c.req.param("roomId"));
  if (!roomId) return c.text("Room not found", 404);
  if (!(await allowRequest(c, "RL_API", "ws"))) return tooManyRequests(c);
  const id = c.env.ROOMS.idFromName(roomId);
  const stub = c.env.ROOMS.get(id);
  // Forward the verified session user ID to the DO so race results can be saved.
  // Clients cannot spoof this header: it is always stripped and rewritten here.
  const forwarded = new Request(c.req.raw);
  forwarded.headers.delete(USER_ID_HEADER);
  const user = await getSessionUser(c).catch(() => null);
  if (user) forwarded.headers.set(USER_ID_HEADER, user.id);
  return stub.fetch(forwarded);
});

export default app;
