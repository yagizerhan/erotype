// SPDX-License-Identifier: AGPL-3.0-or-later
// Regression tests for room lifecycle and anti-abuse hardening.
import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_PLAYERS, MAX_PLAYERS } from "../../shared/constants";
import {
  checkRaceCompletion,
  collectRaceResults,
  createInitialRoomState,
  handleClientEvent,
  handlePlayerJoin,
  type InternalRoomState,
  parseClientMessage,
  raceDeadline
} from "./room-logic";

function join(state: InternalRoomState, name: string, now: number, isBot = false) {
  const j = handlePlayerJoin(state, name, now, undefined, undefined, isBot);
  if (!j.ok) throw new Error("join");
  return j.player;
}

/** Runs a full quote-mode race to completion; takes a list of [userId, isBot] tuples. */
function playQuoteRace(entrants: [string | null, boolean][]) {
  const state = createInitialRoomState("AB12CD", 1000, 5, "tr");
  const players = entrants.map(([uid, bot], i) => {
    const p = join(state, `oyuncu${i}`, 1000 + i, bot);
    p.userId = uid;
    return p;
  });
  handleClientEvent(state, players[0].id, { t: "config", raceMode: "quote" }, 1500, () => "");
  handleClientEvent(state, players[0].id, { t: "start" }, 2000, () => "ışık güzel");
  const startAt = state.startAt!;
  players.forEach((p, i) => {
    const t0 = startAt + 1500 + i * 500;
    handleClientEvent(state, p.id, { t: "progress", r: 1, w: 1, x: "ışık", e: 0, ce: t0 - startAt }, t0, () => "");
    handleClientEvent(
      state,
      p.id,
      { t: "finish", r: 1, x: "güzel", ce: t0 + 1500 - startAt, keys: 10, errs: 0 },
      t0 + 1500,
      () => ""
    );
  });
  return { state, players };
}

describe("room capacity", () => {
  it("falls back to default maxPlayers for non-numeric input (prevents NaN bypass)", () => {
    const st = createInitialRoomState("AB12CD", 0, "abc" as unknown as number);
    expect(st.maxPlayers).toBe(DEFAULT_MAX_PLAYERS);
    for (let i = 0; i < 30; i++) handlePlayerJoin(st, `p${i}`, i);
    const players = Object.values(st.players).filter((p) => p.role === "player");
    expect(players).toHaveLength(DEFAULT_MAX_PLAYERS);
  });

  it("clamps out-of-range values to MAX_PLAYERS", () => {
    expect(createInitialRoomState("AB12CD", 0, 99).maxPlayers).toBe(MAX_PLAYERS);
  });
});

describe("parseClientMessage", () => {
  it("rejects malformed payloads", () => {
    expect(parseClientMessage(null)).toBeNull();
    expect(parseClientMessage([])).toBeNull();
    expect(parseClientMessage({ t: "progress", r: 1, w: 1, e: 0, ce: 0 })).toBeNull(); // missing x
    expect(parseClientMessage({ t: "hello", v: 2, name: 42 })).toBeNull();
    expect(parseClientMessage({ t: "finish", r: 1, x: "a", ce: "1", keys: 1, errs: 0 })).toBeNull();
    expect(parseClientMessage({ t: "unknown" })).toBeNull();
  });

  it("accepts valid messages", () => {
    expect(parseClientMessage({ t: "progress", r: 1, w: 2, x: "ev", e: 0, ce: 900 })).toEqual({
      t: "progress",
      r: 1,
      w: 2,
      x: "ev",
      e: 0,
      ce: 900
    });
    expect(parseClientMessage({ t: "hello", v: 2, name: "ali", bot: true })).toMatchObject({ bot: true });
  });
});

describe("disconnected players", () => {
  it("prunes players who disconnected in a previous race before starting a new one", () => {
    const st = createInitialRoomState("AB12CD", 0, 5);
    const a = join(st, "a", 1);
    const b = join(st, "b", 2);
    const c = join(st, "c", 3);
    handleClientEvent(st, a.id, { t: "start" }, 10, () => "bir iki");
    // c disconnected mid-race and never returned
    st.players[c.id].connected = false;
    st.phase = "FINISHED";
    handleClientEvent(st, a.id, { t: "start" }, 100_000, () => "bir iki");
    expect(st.players[c.id]).toBeUndefined();
    expect(st.players[b.id].status).toBe("racing");
  });

  it("marks disconnected racers who did not return as DNF when race ends", () => {
    const st = createInitialRoomState("AB12CD", 0, 5);
    const a = join(st, "a", 1);
    const b = join(st, "b", 2);
    handleClientEvent(st, a.id, { t: "start" }, 10, () => "bir iki");
    st.players[a.id].connected = false;
    st.players[b.id].connected = false;
    checkRaceCompletion(st, []);
    expect(st.phase).toBe("FINISHED");
    expect(st.players[a.id].status).toBe("dnf");
  });
});

describe("win counting", () => {
  it("does not count beating your own bot as a win and does not record bot results", () => {
    const { state } = playQuoteRace([["u1", false], ["u1", true]]);
    const { records, participants } = collectRaceResults(state);
    expect(participants).toEqual([{ userId: "u1", won: false }]);
    expect(records).toHaveLength(1);
    expect(records[0].won).toBe(false);
  });

  it("does not count beating a second tab of the same account as a win", () => {
    const { state } = playQuoteRace([["u1", false], ["u1", false]]);
    expect(collectRaceResults(state).participants).toEqual([{ userId: "u1", won: false }]);
  });

  it("counts beating a real opponent (including guests) as a win", () => {
    const { state } = playQuoteRace([["u1", false], [null, false]]);
    expect(collectRaceResults(state).participants).toEqual([{ userId: "u1", won: true }]);
  });
});

describe("race rules", () => {
  it("ignores rematch during an active race or countdown", () => {
    const st = createInitialRoomState("AB12CD", 0, 5);
    const a = join(st, "a", 1);
    join(st, "b", 2);
    handleClientEvent(st, a.id, { t: "start" }, 10, () => "bir iki");
    handleClientEvent(st, a.id, { t: "rematch" }, 20, () => "");
    expect(st.phase).toBe("COUNTDOWN");
  });

  it("prevents client ce from ending a timed race early", () => {
    const st = createInitialRoomState("AB12CD", 0, 5);
    const a = join(st, "a", 1);
    join(st, "b", 2);
    handleClientEvent(st, a.id, { t: "start" }, 10, () => "bir iki üç dört");
    const startAt = st.startAt!;
    handleClientEvent(st, a.id, { t: "finish", r: 1, x: "", ce: 60_000, keys: 0, errs: 0 }, startAt + 2_000, () => "");
    expect(st.players[a.id].status).toBe("racing");
  });

  it("sets raceDeadline in timed mode to startAt + duration + grace", () => {
    const st = createInitialRoomState("AB12CD", 0, 5);
    st.startAt = 10_000;
    st.timeOption = 30;
    expect(raceDeadline(st)).toBe(10_000 + 30_000 + 1_500);
  });
});
