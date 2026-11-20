// SPDX-License-Identifier: AGPL-3.0-or-later
import { DurableObject } from "cloudflare:workers";
import {
  MAX_MSG_BYTES,
  MAX_WPM,
  MSG_RATE_LIMIT_PER_SEC,
  PROTOCOL_VERSION,
  ROOM_IDLE_CLEANUP_MS,
  TEXT_REVEAL_MS
} from "../shared/constants";
import type {
  RaceTextMode,
  RaceTimeOption,
  ServerMessage
} from "../shared/protocol";
import { calculateWpm } from "../shared/text";
import {
  checkRaceCompletion,
  collectRaceResults,
  createInitialRoomState,
  handleClientEvent,
  handlePlayerJoin,
  type InternalRoomState,
  type OutgoingDirective,
  parseClientMessage,
  pruneDisconnected,
  raceDeadline,
  type RaceResultRecord,
  reassignHost,
  recomputePlaces,
  serverSideAccuracy,
  toPublicPlayer,
  toPublicSnapshot
} from "./game/room-logic";
import trQuotes from "../../data/languages/tr/quotes.json";
import enQuotes from "../../data/languages/en/quotes.json";
import trWords from "../../data/languages/tr/words-1k.json";
import enWords from "../../data/languages/en/words-1k.json";

interface WsAttachment {
  playerId?: string;
  /** Account ID verified from the session by the Worker (null for guests). */
  userId?: string | null;
}

/** Internal Worker -> DO header. The Worker always strips any client-supplied copy. */
export const USER_ID_HEADER = "X-EroType-User-Id";

export class RoomDO extends DurableObject {
  private stateData: InternalRoomState | null = null;
  /** Per-connection message counter for rate limiting. Kept in memory; resets on hibernation. */
  private msgRate = new WeakMap<WebSocket, { windowStart: number; count: number }>();

  private async loadState(): Promise<InternalRoomState | null> {
    if (this.stateData) return this.stateData;
    const stored = await this.ctx.storage.get<InternalRoomState>("room");
    if (stored) {
      this.stateData = stored;
    }
    return this.stateData;
  }

  private async saveState(): Promise<void> {
    if (this.stateData) {
      await this.ctx.storage.put("room", this.stateData);
    }
  }

  private pickRaceText(
    lang: "tr" | "en",
    raceMode: RaceTextMode,
    timeOption: RaceTimeOption = 60
  ): string {
    if (raceMode !== "quote") {
      // Timed race: generate enough words so even MAX_WPM typists won't run out before time expires
      const count = Math.max(40, Math.ceil((timeOption / 60) * MAX_WPM));
      const pool = lang === "en" ? enWords : trWords;
      const out: string[] = [];
      for (let i = 0; i < count; i++) {
        let w = pool[Math.floor(Math.random() * pool.length)];
        if (i > 0 && w === out[i - 1]) {
          w = pool[(Math.floor(Math.random() * pool.length) + 1) % pool.length];
        }
        out.push(w);
      }
      return out.join(" ");
    }
    const pool = lang === "en" ? enQuotes : trQuotes;
    const item = pool[Math.floor(Math.random() * pool.length)];
    return item ? item.text : "Klavye hız testi örnek yarış metni.";
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1) Room initialization via POST /init
    if (request.method === "POST" && url.pathname === "/init") {
      const existing = await this.loadState();
      if (existing?.initialized) {
        return Response.json({ ok: false, reason: "ALREADY_EXISTS" }, { status: 409 });
      }
      const body = (await request.json().catch(() => ({}))) as {
        roomId?: string;
        maxPlayers?: unknown;
        lang?: "tr" | "en";
      };
      const now = Date.now();
      this.stateData = createInitialRoomState(
        body.roomId || "ROOM01",
        now,
        // createInitialRoomState falls back to default for non-numeric values
        body.maxPlayers as number | undefined,
        body.lang === "en" ? "en" : "tr"
      );
      await this.saveState();
      await this.ctx.storage.setAlarm(now + ROOM_IDLE_CLEANUP_MS);
      return Response.json({ ok: true, room: toPublicSnapshot(this.stateData) });
    }

    // 2) Room status check via GET /info
    if (request.method === "GET" && url.pathname === "/info") {
      const st = await this.loadState();
      if (!st?.initialized) {
        return Response.json({ ok: false, code: "ROOM_NOT_FOUND" }, { status: 404 });
      }
      return Response.json({ ok: true, room: toPublicSnapshot(st) });
    }

    // 3) WebSocket upgrade via GET /ws
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const st = await this.loadState();
      if (!st?.initialized) {
        return new Response("Room not found", { status: 404 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // WebSocket Hibernation API
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({
        userId: request.headers.get(USER_ID_HEADER) || null
      } satisfies WsAttachment);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string" || message.length > MAX_MSG_BYTES) {
      ws.close(1009, "Message too large or invalid format");
      return;
    }

    if (this.isRateLimited(ws)) {
      this.sendToSocket(ws, {
        t: "error",
        code: "RATE_LIMITED",
        msg: "Çok fazla mesaj gönderildi."
      });
      ws.close(1008, "Rate limited");
      return;
    }

    const st = await this.loadState();
    if (!st?.initialized) {
      this.sendToSocket(ws, {
        t: "error",
        code: "ROOM_NOT_FOUND",
        msg: "Bu oda bulunamadı veya süresi doldu."
      });
      ws.close(1008, "Room not found");
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(message);
    } catch {
      ws.close(1003, "Invalid JSON");
      return;
    }
    const parsed = parseClientMessage(json);
    if (!parsed) {
      this.sendToSocket(ws, {
        t: "error",
        code: "INVALID_MESSAGE",
        msg: "Geçersiz mesaj."
      });
      return;
    }

    const now = Date.now();

    if (parsed.t === "hello") {
      // Prevent a second hello on the same socket from spawning a ghost player
      const current = ws.deserializeAttachment() as WsAttachment | null;
      if (current?.playerId) {
        this.sendToSocket(ws, {
          t: "error",
          code: "INVALID_MESSAGE",
          msg: "Bu bağlantı zaten odaya katıldı."
        });
        return;
      }

      if (parsed.v !== PROTOCOL_VERSION) {
        this.sendToSocket(ws, {
          t: "error",
          code: "VERSION_MISMATCH",
          msg: "Protokol sürümü uyuşmuyor, sayfayı yenileyin."
        });
        ws.close(1002, "Version mismatch");
        return;
      }

      const joinRes = handlePlayerJoin(
        st,
        parsed.name,
        now,
        parsed.playerId,
        parsed.token,
        parsed.bot === true
      );
      if (!joinRes.ok) {
        this.sendToSocket(ws, {
          t: "error",
          code: joinRes.code,
          msg: joinRes.msg
        });
        ws.close(1008, joinRes.code);
        return;
      }

      const { player, reconnected } = joinRes;
      // Bots connect from their owner's browser (with session cookie); never save their results to an account
      player.userId = player.isBot ? null : current?.userId ?? null;
      ws.serializeAttachment({
        playerId: player.id,
        userId: current?.userId ?? null
      } satisfies WsAttachment);
      if (reconnected) {
        // Detach the player's old socket so its close event won't remove or DNF the player
        for (const other of this.ctx.getWebSockets()) {
          if (other === ws) continue;
          const att = other.deserializeAttachment() as WsAttachment | null;
          if (att?.playerId === player.id) {
            other.serializeAttachment({ userId: att.userId ?? null } satisfies WsAttachment);
            try {
              other.close(4000, "Replaced by new connection");
            } catch {
              // already closed
            }
          }
        }
      }
      await this.saveState();

      this.sendToSocket(ws, {
        t: "welcome",
        v: PROTOCOL_VERSION,
        you: player.id,
        token: player.token,
        room: toPublicSnapshot(st),
        s: now
      });

      // If race text is already revealed, send it to reconnecting/spectating client
      if (
        (st.phase === "COUNTDOWN" || st.phase === "RACING") &&
        st.textRevealed &&
        st.text &&
        st.startAt
      ) {
        this.sendToSocket(ws, {
          t: "race_text",
          r: st.raceId,
          text: st.text,
          sStartAt: st.startAt
        });
      }

      this.broadcastExcept(player.id, {
        t: "player_joined",
        player: toPublicPlayer(player)
      });
      return;
    }

    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    if (!attachment?.playerId) {
      this.sendToSocket(ws, {
        t: "error",
        code: "INVALID_MESSAGE",
        msg: "Önce hello mesajı gönderilmelidir."
      });
      return;
    }

    const output = handleClientEvent(
      st,
      attachment.playerId,
      parsed,
      now,
      (lang, raceMode, timeOption) =>
        this.pickRaceText(lang, raceMode, timeOption)
    );

    // ping does not mutate state: avoid unnecessary storage writes on every ping
    if (parsed.t !== "ping") {
      await this.saveState();
    }
    this.flushOutbox(output.outbox);
    await this.finalizeIfFinished(st);

    if (output.nextAlarmAt) {
      await this.ctx.storage.setAlarm(output.nextAlarmAt);
    }
  }

  /** At most MSG_RATE_LIMIT_PER_SEC messages per second per connection. */
  private isRateLimited(ws: WebSocket): boolean {
    const now = Date.now();
    const entry = this.msgRate.get(ws);
    if (!entry || now - entry.windowStart >= 1_000) {
      this.msgRate.set(ws, { windowStart: now, count: 1 });
      return false;
    }
    entry.count += 1;
    return entry.count > MSG_RATE_LIMIT_PER_SEC;
  }

  /** Schedules idle cleanup when the room is empty and no race is active (never overwrites a race alarm). */
  private async scheduleIdleCleanupIfEmpty(st: InternalRoomState): Promise<void> {
    if (st.phase === "COUNTDOWN" || st.phase === "RACING") return;
    const anyConnected = Object.values(st.players).some((x) => x.connected);
    if (!anyConnected) {
      await this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_CLEANUP_MS);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const st = await this.loadState();
    if (!st) return;

    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    const playerId = attachment?.playerId;
    if (!playerId || !st.players[playerId]) return;

    // Ignore close if the player is still connected via another (reconnected) socket
    const stillConnected = this.ctx.getWebSockets().some((other) => {
      if (other === ws) return false;
      const att = other.deserializeAttachment() as WsAttachment | null;
      return att?.playerId === playerId;
    });
    if (stillConnected) return;

    const p = st.players[playerId];
    p.connected = false;

    if (st.phase === "LOBBY" || st.phase === "FINISHED") {
      delete st.players[playerId];
    }
    // Players who disconnect during countdown/race stay in state until the race ends:
    // if they reconnect with the same token they resume from their word; otherwise they
    // are marked DNF and pruned at race end (checkRaceCompletion + finalizeIfFinished).

    if (st.hostId === playerId) {
      reassignHost(st);
    }

    const outbox: OutgoingDirective[] = [
      {
        msg: {
          t: "player_left",
          id: playerId,
          hostId: st.hostId
        }
      },
      {
        msg: {
          t: "room_state",
          room: toPublicSnapshot(st)
        }
      }
    ];

    if (st.phase === "RACING" || st.phase === "COUNTDOWN") {
      checkRaceCompletion(st, outbox);
    }

    await this.saveState();
    this.flushOutbox(outbox);
    await this.finalizeIfFinished(st);
    await this.scheduleIdleCleanupIfEmpty(st);
  }

  async alarm(): Promise<void> {
    const st = await this.loadState();
    if (!st?.initialized) return;

    const now = Date.now();
    const anyConnected = Object.values(st.players).some((x) => x.connected);

    // 1) Cleanup idle empty room
    if (!anyConnected && st.phase !== "COUNTDOWN" && st.phase !== "RACING") {
      await this.ctx.storage.deleteAll();
      this.stateData = null;
      return;
    }

    // 2) Reveal text ~3s before startAt
    if (st.phase === "COUNTDOWN" && st.startAt && st.text) {
      if (!st.textRevealed && now >= st.startAt - TEXT_REVEAL_MS - 100) {
        st.textRevealed = true;
        this.broadcastAll({
          t: "race_text",
          r: st.raceId,
          text: st.text,
          sStartAt: st.startAt
        });
      }

      if (now < st.startAt) {
        await this.saveState();
        await this.ctx.storage.setAlarm(st.startAt);
        return;
      }

      // Transition to RACING at startAt and schedule race timeout alarm
      st.phase = "RACING";
      await this.saveState();
      this.broadcastAll({ t: "room_state", room: toPublicSnapshot(st) });
      await this.ctx.storage.setAlarm(raceDeadline(st) ?? now);
      return;
    }

    // 3) Race timeout reached -> in time mode finalize active racers, in quote mode mark remaining as DNF
    if (st.phase === "RACING") {
      // Phase may already have transitioned to RACING via the first progress/finish message.
      // In that case this alarm is the startAt alarm and the deadline hasn't passed yet: reschedule.
      const deadline = raceDeadline(st);
      if (deadline && now < deadline - 100) {
        await this.ctx.storage.setAlarm(deadline);
        return;
      }
      const outbox: OutgoingDirective[] = [];
      const targetDurationMs = (st.timeOption ?? 60) * 1_000;
      if (st.raceMode !== "quote") {
        for (const p of Object.values(st.players)) {
          if (p.status === "racing") {
            if (p.connected) {
              const charsTyped = st.prefixChars[p.wordIndex] ?? 0;
              p.finishMs = targetDurationMs;
              p.wpm = calculateWpm(charsTyped, targetDurationMs);
              p.acc = serverSideAccuracy(st, p);
              p.status = "finished";
            } else {
              p.status = "dnf";
            }
          }
        }
        recomputePlaces(st);
      } else {
        for (const p of Object.values(st.players)) {
          if (p.status === "racing") {
            p.status = "dnf";
          }
        }
      }
      checkRaceCompletion(st, outbox);
      await this.saveState();
      this.flushOutbox(outbox);
      await this.finalizeIfFinished(st);
      await this.scheduleIdleCleanupIfEmpty(st);
    }
  }

  /**
   * When a race finishes, writes signed-in players' results to D1 and increments
   * profile race/win counters. Runs at most once per race (guarded by savedRaceId);
   * DB errors are logged without disrupting the room.
   */
  private async finalizeIfFinished(st: InternalRoomState): Promise<void> {
    if (st.phase !== "FINISHED" || st.raceId === 0 || st.savedRaceId === st.raceId) return;
    st.savedRaceId = st.raceId;
    // Collect results before pruning disconnected players (they participated and count as DNF)
    const { records, participants } = collectRaceResults(st);
    const removed = pruneDisconnected(st);
    await this.saveState();
    if (removed.length > 0) {
      this.broadcastAll({ t: "room_state", room: toPublicSnapshot(st) });
    }
    await this.writeRaceResults(records, participants);
  }

  private async writeRaceResults(
    records: RaceResultRecord[],
    participants: { userId: string; won: boolean }[]
  ): Promise<void> {
    const db = (this.env as { DB?: D1Database }).DB;
    if (!db || participants.length === 0) return;

    const now = Date.now();
    const statements: D1PreparedStatement[] = [];
    for (const r of records) {
      statements.push(
        db
          .prepare(
            `INSERT INTO result (id, user_id, mode, mode2, lang, wpm, raw_wpm, acc, consistency,
                                 duration_ms, room_id, place, created_at)
             SELECT ?1, ?2, 'race', ?3, ?4, ?5, ?6, ?7, NULL, ?8, ?9, ?10, ?11
             WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ?2)
               AND NOT EXISTS (SELECT 1 FROM profile WHERE user_id = ?2 AND banned = 1)
             ON CONFLICT(id) DO NOTHING`
          )
          .bind(r.id, r.userId, r.mode2, r.lang, r.wpm, r.rawWpm, r.acc, r.durationMs, r.roomId, r.place, now)
      );
    }
    for (const p of participants) {
      statements.push(
        db
          .prepare(
            `UPDATE profile SET races_total = races_total + 1, races_won = races_won + ?1
             WHERE user_id = ?2`
          )
          .bind(p.won ? 1 : 0, p.userId)
      );
    }
    try {
      await db.batch(statements);
    } catch (err) {
      console.error("race results not saved", err);
    }
  }

  private flushOutbox(outbox: OutgoingDirective[]): void {
    for (const item of outbox) {
      if (item.to) {
        this.sendToPlayer(item.to, item.msg);
      } else if (item.exclude) {
        this.broadcastExcept(item.exclude, item.msg);
      } else {
        this.broadcastAll(item.msg);
      }
    }
  }

  private sendToSocket(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // ignore closed socket
    }
  }

  private sendToPlayer(playerId: string, msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as WsAttachment | null;
      if (att?.playerId === playerId) {
        try {
          ws.send(payload);
        } catch {
          // ignore
        }
      }
    }
  }

  private broadcastExcept(excludePlayerId: string, msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as WsAttachment | null;
      if (att?.playerId !== excludePlayerId) {
        try {
          ws.send(payload);
        } catch {
          // ignore
        }
      }
    }
  }

  private broadcastAll(msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // ignore
      }
    }
  }
}
