// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  CLOCK_SLACK_MS,
  COUNTDOWN_MS,
  DEFAULT_MAX_PLAYERS,
  MAX_PLAYERS,
  MAX_SPECTATORS,
  MAX_VIOLATIONS_BEFORE_DQ,
  MAX_WPM,
  MIN_PLAYERS,
  MIN_WPM_FOR_TIMEOUT,
  TEXT_REVEAL_MS
} from "../../shared/constants";
import type {
  ClientMessage,
  PlayerRaceStatus,
  PlayerRole,
  PublicPlayerState,
  PublicRoomSnapshot,
  RaceTextMode,
  RaceTimeOption,
  ResultRow,
  RoomPhase,
  ServerMessage
} from "../../shared/protocol";
import {
  calculateWpm,
  computePrefixChars,
  normalizeText,
  normalizeWord,
  splitWords
} from "../../shared/text";

export interface InternalPlayerState {
  id: string;
  token: string;
  name: string;
  connected: boolean;
  joinedAt: number;
  role: PlayerRole;
  wordIndex: number;
  lastProgressAt: number;
  wpm: number;
  errors: number;
  violations: number;
  rttMin: number;
  finishMs: number | null;
  acc: number | null;
  place: number | null;
  status: PlayerRaceStatus;
  /** Signed-in player's account ID (from server session; never supplied by client). */
  userId?: string | null;
  /** Practice bot (hello.bot). Results are not saved and do not count as a rival for wins. */
  isBot?: boolean;
}

export interface InternalRoomState {
  initialized: boolean;
  roomId: string;
  createdAt: number;
  maxPlayers: number;
  lang: "tr" | "en";
  raceMode: RaceTextMode;
  timeOption: RaceTimeOption;
  hostId: string | null;
  phase: RoomPhase;
  raceId: number;
  text: string | null;
  words: string[];
  prefixChars: number[];
  startAt: number | null;
  textRevealed: boolean;
  players: Record<string, InternalPlayerState>;
  /** Last raceId whose results were persisted to D1 (prevents duplicate writes). */
  savedRaceId?: number;
}

export interface OutgoingDirective {
  to?: string; // specific playerId, or broadcast if omitted
  exclude?: string; // exclude this playerId on broadcast
  msg: ServerMessage;
}

export interface LogicOutput {
  outbox: OutgoingDirective[];
  nextAlarmAt?: number | null;
}

export function createInitialRoomState(
  roomId: string,
  now: number,
  maxPlayers = DEFAULT_MAX_PLAYERS,
  lang: "tr" | "en" = "tr"
): InternalRoomState {
  // Payload comes from the client: a non-numeric value like "abc" becomes NaN and
  // makes every >= comparison false (bypassing capacity limits). Fall back to default.
  const requested = typeof maxPlayers === "number" && Number.isFinite(maxPlayers)
    ? Math.round(maxPlayers)
    : DEFAULT_MAX_PLAYERS;
  const clampedMax = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, requested));
  return {
    initialized: true,
    roomId,
    createdAt: now,
    maxPlayers: clampedMax,
    lang,
    raceMode: "time",
    timeOption: 60,
    hostId: null,
    phase: "LOBBY",
    raceId: 0,
    text: null,
    words: [],
    prefixChars: [0],
    startAt: null,
    textRevealed: false,
    players: {}
  };
}

export function toPublicPlayer(p: InternalPlayerState): PublicPlayerState {
  return {
    id: p.id,
    name: p.name,
    connected: p.connected,
    role: p.role,
    wordIndex: p.wordIndex,
    wpm: p.wpm,
    place: p.place,
    finishMs: p.finishMs,
    acc: p.acc,
    status: p.status
  };
}

export function toPublicSnapshot(state: InternalRoomState): PublicRoomSnapshot {
  const players = Object.values(state.players)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map(toPublicPlayer);
  const totalChars =
    state.prefixChars.length > 0
      ? state.prefixChars[state.prefixChars.length - 1]
      : 0;
  const normalizedMode: RaceTextMode =
    state.raceMode === "quote" ? "quote" : "time";

  return {
    roomId: state.roomId,
    phase: state.phase,
    maxPlayers: state.maxPlayers,
    hostId: state.hostId,
    raceId: state.raceId,
    lang: state.lang,
    raceMode: normalizedMode,
    timeOption: state.timeOption ?? 60,
    wordCount: state.words.length,
    charCount: totalChars,
    sStartAt: state.startAt,
    players
  };
}

export function sanitizePlayerName(raw: unknown): string {
  if (typeof raw !== "string") return "Oyuncu";
  const clean = raw.normalize("NFC").replace(/[\r\n\t<>]/g, "").trim();
  if (!clean) return "Oyuncu";
  return clean.slice(0, 20);
}

const MAX_WORD_FIELD_LENGTH = 64;

/**
 * Runtime validator for incoming client messages (TypeScript types do not protect
 * against arbitrary JSON from the browser). Returns null on invalid payloads so the DO
 * rejects them before processing.
 */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const int = (v: unknown) => num(v) && Number.isInteger(v);
  const optStr = (v: unknown, max: number) =>
    v === undefined || (typeof v === "string" && v.length <= max);
  const word = (v: unknown) => typeof v === "string" && v.length <= MAX_WORD_FIELD_LENGTH;

  switch (m.t) {
    case "hello":
      if (!num(m.v) || typeof m.name !== "string" || m.name.length > 100) return null;
      if (!optStr(m.playerId, 16) || !optStr(m.token, 64)) return null;
      if (m.bot !== undefined && typeof m.bot !== "boolean") return null;
      return {
        t: "hello",
        v: m.v as number,
        name: m.name,
        playerId: m.playerId as string | undefined,
        token: m.token as string | undefined,
        bot: m.bot === true
      };
    case "ping":
      return num(m.c) ? { t: "ping", c: m.c as number } : null;
    case "config":
      // Fields are strictly checked against whitelisted values inside handleClientEvent.
      return {
        t: "config",
        lang: m.lang as "tr" | "en" | undefined,
        raceMode: m.raceMode as RaceTextMode | undefined,
        timeOption: m.timeOption as RaceTimeOption | undefined
      };
    case "start":
      return { t: "start" };
    case "rematch":
      return { t: "rematch" };
    case "progress":
      if (!int(m.r) || !int(m.w) || !word(m.x) || !num(m.e) || !num(m.ce)) return null;
      return {
        t: "progress",
        r: m.r as number,
        w: m.w as number,
        x: m.x as string,
        e: m.e as number,
        ce: m.ce as number
      };
    case "finish":
      if (!int(m.r) || !word(m.x) || !num(m.ce) || !num(m.keys) || !num(m.errs)) return null;
      return {
        t: "finish",
        r: m.r as number,
        x: m.x as string,
        ce: m.ce as number,
        keys: m.keys as number,
        errs: m.errs as number
      };
    default:
      return null;
  }
}

/** Server-side deadline for timed or quote races (startAt + duration). */
export function raceDeadline(state: InternalRoomState): number | null {
  if (!state.startAt) return null;
  if (state.raceMode !== "quote") {
    // Allow brief grace period for the client's final "finish" message (real accuracy)
    return state.startAt + (state.timeOption ?? 60) * 1_000 + 1_500;
  }
  const totalChars = state.prefixChars[state.prefixChars.length - 1] ?? 100;
  return (
    state.startAt +
    Math.max(60_000, Math.round((totalChars / ((MIN_WPM_FOR_TIMEOUT * 5) / 60)) * 1_000))
  );
}

/** Removes disconnected players from the room and reassigns the host if needed. */
export function pruneDisconnected(state: InternalRoomState): string[] {
  const removed: string[] = [];
  for (const p of Object.values(state.players)) {
    if (!p.connected) {
      delete state.players[p.id];
      removed.push(p.id);
    }
  }
  if (state.hostId && !state.players[state.hostId]) {
    reassignHost(state);
  }
  return removed;
}

export function reassignHost(state: InternalRoomState): void {
  const nextHost = Object.values(state.players)
    .filter((x) => x.connected && x.role === "player")
    .sort((a, b) => a.joinedAt - b.joinedAt)[0];
  state.hostId = nextHost ? nextHost.id : null;
}

/**
 * Pure room state transition handler.
 * Independent of Cloudflare runtime so it can be unit-tested or run on Node.js.
 */
export function handleClientEvent(
  state: InternalRoomState,
  senderId: string,
  msg: ClientMessage,
  now: number,
  pickRaceText: (
    lang: "tr" | "en",
    raceMode: RaceTextMode,
    timeOption: RaceTimeOption
  ) => string
): LogicOutput {
  const outbox: OutgoingDirective[] = [];
  const player = state.players[senderId];

  if (msg.t === "ping") {
    outbox.push({
      to: senderId,
      msg: { t: "pong", c: msg.c, s: now }
    });
    return { outbox };
  }

  if (!player) {
    outbox.push({
      to: senderId,
      msg: { t: "error", code: "INVALID_MESSAGE", msg: "Önce odaya katılmalısınız." }
    });
    return { outbox };
  }

  switch (msg.t) {
    case "config": {
      if (state.hostId !== senderId) {
        outbox.push({
          to: senderId,
          msg: { t: "error", code: "NOT_HOST", msg: "Oda ayarlarını sadece oda sahibi değiştirebilir." }
        });
        return { outbox };
      }
      if (state.phase !== "LOBBY" && state.phase !== "FINISHED") {
        return { outbox };
      }
      if (msg.lang === "tr" || msg.lang === "en") {
        state.lang = msg.lang;
      }
      if (msg.raceMode === "time" || msg.raceMode === "quote") {
        state.raceMode = msg.raceMode;
      }
      if (
        msg.timeOption === 15 ||
        msg.timeOption === 30 ||
        msg.timeOption === 60 ||
        msg.timeOption === 120
      ) {
        state.timeOption = msg.timeOption;
      }
      outbox.push({
        msg: { t: "room_state", room: toPublicSnapshot(state) }
      });
      return { outbox };
    }

    case "start": {
      if (state.hostId !== senderId) {
        outbox.push({
          to: senderId,
          msg: { t: "error", code: "NOT_HOST", msg: "Yarışı sadece oda sahibi başlatabilir." }
        });
        return { outbox };
      }
      if (state.phase !== "LOBBY" && state.phase !== "FINISHED") {
        return { outbox };
      }

      // Prune players who disconnected in a previous race so they don't carry over as
      // "racing" (which would mark them DNF every race and occupy player slots).
      pruneDisconnected(state);

      const activePlayers = Object.values(state.players).filter(
        (p) => p.connected && p.role === "player"
      );
      if (activePlayers.length < MIN_PLAYERS) {
        outbox.push({
          to: senderId,
          msg: {
            t: "error",
            code: "NOT_ENOUGH_PLAYERS",
            msg: `Yarışı başlatmak için en az ${MIN_PLAYERS} oyuncu gerekli.`
          }
        });
        return { outbox };
      }

      const normalizedMode: RaceTextMode =
        state.raceMode === "quote" ? "quote" : "time";
      state.raceMode = normalizedMode;
      const chosenText = normalizeText(
        pickRaceText(state.lang, normalizedMode, state.timeOption ?? 60)
      );
      const words = splitWords(chosenText);
      const prefixChars = computePrefixChars(words);
      const totalChars = prefixChars[prefixChars.length - 1] ?? 0;

      state.raceId += 1;
      state.phase = "COUNTDOWN";
      state.text = chosenText;
      state.words = words;
      state.prefixChars = prefixChars;
      state.startAt = now + COUNTDOWN_MS;
      state.textRevealed = false;

      for (const p of Object.values(state.players)) {
        if (p.connected && p.role === "spectator") {
          const currentPlayers = Object.values(state.players).filter(
            (x) => x.role === "player"
          ).length;
          if (currentPlayers < state.maxPlayers) {
            p.role = "player";
          }
        }
        p.wordIndex = 0;
        p.lastProgressAt = now;
        p.wpm = 0;
        p.errors = 0;
        p.violations = 0;
        p.finishMs = null;
        p.acc = null;
        p.place = null;
        p.status = p.role === "player" ? "racing" : "idle";
      }

      outbox.push({
        msg: {
          t: "countdown",
          r: state.raceId,
          sStartAt: state.startAt,
          wordCount: words.length,
          charCount: totalChars
        }
      });
      outbox.push({
        msg: {
          t: "room_state",
          room: toPublicSnapshot(state)
        }
      });

      const revealAt = state.startAt - TEXT_REVEAL_MS;
      return { outbox, nextAlarmAt: Math.max(now + 50, revealAt) };
    }

    case "progress": {
      if (
        (state.phase !== "RACING" && state.phase !== "COUNTDOWN") ||
        msg.r !== state.raceId ||
        player.role !== "player" ||
        player.status !== "racing" ||
        !state.startAt
      ) {
        return { outbox };
      }

      // Transition to RACING if startAt has passed
      if (state.phase === "COUNTDOWN" && now >= state.startAt) {
        state.phase = "RACING";
      }

      // Rule 2: Early start check
      if (now + CLOCK_SLACK_MS < state.startAt) {
        player.violations += 1;
        if (player.violations >= MAX_VIOLATIONS_BEFORE_DQ) {
          player.status = "dq";
          outbox.push({ msg: { t: "room_state", room: toPublicSnapshot(state) } });
        }
        return { outbox };
      }

      // Rule 3: Sequential word check
      if (msg.w !== player.wordIndex + 1 || msg.w > state.words.length) {
        outbox.push({
          to: senderId,
          msg: { t: "error", code: "BAD_PROGRESS", msg: "Sırasız kelime ilerlemesi." }
        });
        return { outbox };
      }

      // Rule 4: Exact NFC word match
      const expectedWord = state.words[msg.w - 1];
      if (normalizeWord(msg.x) !== expectedWord) {
        outbox.push({
          to: senderId,
          msg: { t: "error", code: "BAD_PROGRESS", msg: "Kelime eşleşmedi." }
        });
        return { outbox };
      }

      // Rule 5: Cumulative speed check
      const serverElapsed = Math.max(100, now - state.startAt);
      const charsTyped = state.prefixChars[msg.w] ?? 0;
      const wpm = calculateWpm(charsTyped, serverElapsed);

      if (wpm > MAX_WPM) {
        player.violations += 1;
        if (player.violations >= MAX_VIOLATIONS_BEFORE_DQ) {
          player.status = "dq";
          outbox.push({ msg: { t: "room_state", room: toPublicSnapshot(state) } });
        }
        return { outbox };
      }

      player.wordIndex = msg.w;
      player.lastProgressAt = now;
      player.wpm = wpm;
      player.errors += Math.max(0, msg.e | 0);

      outbox.push({
        exclude: senderId,
        msg: {
          t: "progress_broadcast",
          id: senderId,
          w: player.wordIndex,
          sAt: now,
          wpm: player.wpm
        }
      });

      return { outbox };
    }

    case "finish": {
      if (
        (state.phase !== "RACING" && state.phase !== "COUNTDOWN") ||
        msg.r !== state.raceId ||
        player.role !== "player" ||
        player.status !== "racing" ||
        !state.startAt
      ) {
        return { outbox };
      }

      if (state.phase === "COUNTDOWN" && now >= state.startAt) {
        state.phase = "RACING";
      }

      const se = Math.max(200, now - state.startAt);
      const isTimeMode = state.raceMode !== "quote";
      const targetDurationMs = (state.timeOption ?? 60) * 1_000;
      const lastWordIndex = state.words.length;
      // Trust only the server clock: client's "ce" cannot end a timed race early.
      const isTimerEnd = isTimeMode && se >= targetDurationMs - 1_500;

      let completedWordIdx = player.wordIndex;

      if (!isTimerEnd) {
        if (player.wordIndex !== lastWordIndex - 1) {
          outbox.push({
            to: senderId,
            msg: { t: "error", code: "BAD_PROGRESS", msg: "Önceki kelimeler tamamlanmadı." }
          });
          return { outbox };
        }

        const expectedLastWord = state.words[lastWordIndex - 1];
        if (normalizeWord(msg.x) !== expectedLastWord) {
          outbox.push({
            to: senderId,
            msg: { t: "error", code: "BAD_PROGRESS", msg: "Son kelime eşleşmedi." }
          });
          return { outbox };
        }
        completedWordIdx = lastWordIndex;
      } else {
        // In timed race, if the player's current word matches when the timer expires, credit it
        const candidate = normalizeWord(msg.x);
        if (
          completedWordIdx < lastWordIndex &&
          candidate.length > 0 &&
          candidate === state.words[completedWordIdx]
        ) {
          completedWordIdx += 1;
        }
      }

      // Finish time validation
      const oneWay = Math.min(300, (player.rttMin || 100) / 2);
      const lowerBound = se - oneWay - CLOCK_SLACK_MS;
      const upperBound = se + CLOCK_SLACK_MS;

      const verifiedMs = isTimerEnd
        ? targetDurationMs
        : msg.ce >= lowerBound && msg.ce <= upperBound
        ? Math.round(msg.ce)
        : Math.max(200, Math.round(se - oneWay));

      const totalChars = state.prefixChars[completedWordIdx] ?? 0;
      const finalWpm = calculateWpm(totalChars, verifiedMs);

      if (finalWpm > MAX_WPM) {
        player.status = "dq";
        outbox.push({ msg: { t: "room_state", room: toPublicSnapshot(state) } });
        return checkRaceCompletion(state, outbox);
      }

      const totalKeys = Math.max(totalChars, msg.keys | 0);
      // Error count is floored by the errors the server already accumulated from progress updates
      const totalErrs = Math.max(player.errors, msg.errs | 0);
      const acc =
        totalKeys > 0
          ? Math.max(0, Math.min(100, Math.round(((totalKeys - totalErrs) / totalKeys) * 1000) / 10))
          : 100;

      player.wordIndex = completedWordIdx;
      player.finishMs = verifiedMs;
      player.wpm = finalWpm;
      player.acc = acc;
      player.status = "finished";

      recomputePlaces(state);

      outbox.push({
        msg: {
          t: "player_finished",
          id: senderId,
          place: player.place ?? 1,
          ms: verifiedMs,
          wpm: finalWpm,
          acc
        }
      });

      return checkRaceCompletion(state, outbox);
    }

    case "rematch": {
      if (state.hostId !== senderId) {
        outbox.push({
          to: senderId,
          msg: { t: "error", code: "NOT_HOST", msg: "Sadece oda sahibi yeni yarış başlatabilir." }
        });
        return { outbox };
      }
      // Cannot reset an active race (including countdown)
      if (state.phase !== "FINISHED" && state.phase !== "LOBBY") {
        return { outbox };
      }
      state.phase = "LOBBY";
      state.text = null;
      state.words = [];
      state.prefixChars = [0];
      state.startAt = null;
      state.textRevealed = false;
      for (const p of Object.values(state.players)) {
        p.wordIndex = 0;
        p.wpm = 0;
        p.errors = 0;
        p.finishMs = null;
        p.acc = null;
        p.place = null;
        p.status = "idle";
      }
      outbox.push({
        msg: { t: "room_state", room: toPublicSnapshot(state) }
      });
      return { outbox };
    }

    default:
      return { outbox };
  }
}

/**
 * Fallback accuracy when time expires before the client sends a "finish" message,
 * computed from server-tracked values: correctChars / (correctChars + errors).
 */
export function serverSideAccuracy(state: InternalRoomState, p: InternalPlayerState): number {
  const chars = state.prefixChars[p.wordIndex] ?? 0;
  const total = chars + Math.max(0, p.errors);
  return total > 0 ? Math.round((chars / total) * 1000) / 10 : 0;
}

export interface RaceResultRecord {
  id: string;
  userId: string;
  mode2: string;
  lang: "tr" | "en";
  wpm: number;
  rawWpm: number;
  acc: number;
  durationMs: number;
  roomId: string;
  place: number;
  won: boolean;
}

/**
 * Collects D1 result records for a finished race (signed-in finishers only).
 * If the same account raced in multiple tabs, only the best placement is kept.
 * A win requires at least one real opponent who finished: non-bot and a different
 * account (beating your own bot or a second tab does not count as a win).
 * Bot results are never written to any account.
 */
export function collectRaceResults(state: InternalRoomState): {
  records: RaceResultRecord[];
  participants: { userId: string; won: boolean }[];
} {
  const racers = Object.values(state.players).filter(
    (p) => p.role === "player" && (p.status === "finished" || p.status === "dnf")
  );
  const realFinishers = racers.filter((p) => p.status === "finished" && !p.isBot);
  const hasRealOpponent = (winner: InternalPlayerState) =>
    realFinishers.some((o) => o.id !== winner.id && (!o.userId || o.userId !== winner.userId));

  const bestByUser = new Map<string, InternalPlayerState>();
  for (const p of racers) {
    if (!p.userId || p.isBot) continue;
    const prev = bestByUser.get(p.userId);
    const rank = (x: InternalPlayerState) => (x.status === "finished" && x.place ? x.place : 999);
    if (!prev || rank(p) < rank(prev)) bestByUser.set(p.userId, p);
  }

  const records: RaceResultRecord[] = [];
  const participants: { userId: string; won: boolean }[] = [];
  for (const [userId, p] of bestByUser) {
    const won = p.status === "finished" && p.place === 1 && hasRealOpponent(p);
    participants.push({ userId, won });
    if (p.status !== "finished" || !p.place || !p.finishMs || p.wpm <= 0) continue;
    records.push({
      id: `race:${state.roomId}:${state.createdAt}:${state.raceId}:${userId}`,
      userId,
      mode2: state.raceMode === "quote" ? "quote" : String(state.timeOption ?? 60),
      lang: state.lang,
      wpm: p.wpm,
      rawWpm: p.wpm,
      acc: p.acc ?? serverSideAccuracy(state, p),
      durationMs: p.finishMs,
      roomId: state.roomId,
      place: p.place,
      won
    });
  }
  return { records, participants };
}

export function recomputePlaces(state: InternalRoomState): void {
  const finished = Object.values(state.players)
    .filter((p) => p.status === "finished" && p.finishMs !== null)
    .sort((a, b) => {
      if (state.raceMode !== "quote") {
        if (b.wordIndex !== a.wordIndex) return b.wordIndex - a.wordIndex;
        if (b.wpm !== a.wpm) return b.wpm - a.wpm;
        return a.finishMs! - b.finishMs!;
      }
      if (b.wordIndex !== a.wordIndex) return b.wordIndex - a.wordIndex;
      return a.finishMs! - b.finishMs!;
    });

  finished.forEach((p, idx) => {
    p.place = idx + 1;
  });
}

export function checkRaceCompletion(
  state: InternalRoomState,
  outbox: OutgoingDirective[]
): LogicOutput {
  const activeRacers = Object.values(state.players).filter(
    (p) => p.role === "player" && p.connected && p.status === "racing"
  );

  if (activeRacers.length === 0 && (state.phase === "RACING" || state.phase === "COUNTDOWN")) {
    state.phase = "FINISHED";
    // Disconnected racers who did not return before race end are marked DNF
    for (const p of Object.values(state.players)) {
      if (p.status === "racing") p.status = "dnf";
    }
    recomputePlaces(state);

    const rows: ResultRow[] = Object.values(state.players)
      .filter((p) => p.role === "player")
      .sort((a, b) => {
        if (a.place !== null && b.place !== null) return a.place - b.place;
        if (a.place !== null) return -1;
        if (b.place !== null) return 1;
        return b.wordIndex - a.wordIndex;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        place: p.place,
        ms: p.finishMs,
        wpm: p.wpm,
        acc: p.acc ?? serverSideAccuracy(state, p),
        status: p.status
      }));

    outbox.push({
      msg: {
        t: "results",
        r: state.raceId,
        rows
      }
    });
    outbox.push({
      msg: {
        t: "room_state",
        room: toPublicSnapshot(state)
      }
    });
  }

  return { outbox };
}

export function handlePlayerJoin(
  state: InternalRoomState,
  name: string,
  now: number,
  existingId?: string,
  token?: string,
  isBot = false
): {
  ok: true;
  player: InternalPlayerState;
  reconnected: boolean;
} | {
  ok: false;
  code: "ROOM_FULL";
  msg: string;
} {
  // Check reconnection with valid token
  if (existingId && token && state.players[existingId]?.token === token) {
    const p = state.players[existingId];
    p.connected = true;
    p.name = sanitizePlayerName(name);
    if (!state.hostId) state.hostId = p.id;
    return { ok: true, player: p, reconnected: true };
  }

  const allPlayers = Object.values(state.players).filter((p) => p.connected);
  const activePlayerCount = allPlayers.filter((p) => p.role === "player").length;
  const spectatorCount = allPlayers.filter((p) => p.role === "spectator").length;

  let role: PlayerRole = "player";
  if (state.phase === "COUNTDOWN" || state.phase === "RACING") {
    role = "spectator";
  } else if (activePlayerCount >= state.maxPlayers) {
    role = "spectator";
  }

  if (role === "spectator" && spectatorCount >= MAX_SPECTATORS) {
    return {
      ok: false,
      code: "ROOM_FULL",
      msg: "Oda ve izleyici kapasitesi dolu."
    };
  }

  const id = crypto.randomUUID().slice(0, 8);
  const newToken = crypto.randomUUID();
  const newPlayer: InternalPlayerState = {
    id,
    token: newToken,
    name: sanitizePlayerName(name),
    connected: true,
    joinedAt: now,
    role,
    wordIndex: 0,
    lastProgressAt: now,
    wpm: 0,
    errors: 0,
    violations: 0,
    rttMin: 120,
    finishMs: null,
    acc: null,
    place: null,
    status: "idle",
    isBot
  };

  state.players[id] = newPlayer;
  if (!state.hostId && role === "player") {
    state.hostId = id;
  }

  return { ok: true, player: newPlayer, reconnected: false };
}
