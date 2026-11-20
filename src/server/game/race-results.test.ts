// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  collectRaceResults,
  createInitialRoomState,
  handleClientEvent,
  handlePlayerJoin,
  serverSideAccuracy
} from "./room-logic";

// Runs a full 2-player quote-mode race to completion.
function playQuoteRace(userIds: (string | null)[]) {
  const state = createInitialRoomState("AB12CD", 1000, 5, "tr");
  const players = userIds.map((uid, i) => {
    const j = handlePlayerJoin(state, `oyuncu${i}`, 1000 + i);
    if (!j.ok) throw new Error("join");
    j.player.userId = uid;
    return j.player;
  });
  handleClientEvent(state, players[0].id, { t: "config", lang: "tr", raceMode: "quote" }, 1500, () => "");
  handleClientEvent(state, players[0].id, { t: "start" }, 2000, () => "ışık güzel");
  const startAt = state.startAt!;
  players.forEach((p, i) => {
    const t0 = startAt + 1500 + i * 500;
    handleClientEvent(state, p.id, { t: "progress", r: 1, w: 1, x: "ışık", e: i, ce: t0 - startAt }, t0, () => "");
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

describe("collectRaceResults", () => {
  it("records only signed-in players and awards the win to 1st place", () => {
    const { state } = playQuoteRace(["u1", null]);
    expect(state.phase).toBe("FINISHED");
    const { records, participants } = collectRaceResults(state);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ userId: "u1", place: 1, won: true, mode2: "quote", lang: "tr" });
    expect(records[0].id).toBe(`race:AB12CD:1000:1:u1`);
    expect(participants).toEqual([{ userId: "u1", won: true }]);
  });

  it("reflects server-counted errors in accuracy even if the client reports errs=0", () => {
    const { state, players } = playQuoteRace(["u1", "u2"]);
    // second player reported e=1 during progress
    expect(state.players[players[1].id].acc).toBeLessThan(100);
    const { records } = collectRaceResults(state);
    expect(records.find((r) => r.userId === "u2")?.won).toBe(false);
  });

  it("deduplicates same account racing in two tabs, keeping the best placement", () => {
    const { state } = playQuoteRace(["u1", "u1"]);
    const { records, participants } = collectRaceResults(state);
    expect(records).toHaveLength(1);
    expect(records[0].place).toBe(1);
    expect(participants).toHaveLength(1);
  });
});

describe("serverSideAccuracy", () => {
  it("computes correctChars / (correctChars + errors)", () => {
    const state = createInitialRoomState("AB12CD", 1000, 5, "tr");
    state.prefixChars = [0, 5, 11];
    const j = handlePlayerJoin(state, "a", 1000);
    if (!j.ok) throw new Error("join");
    j.player.wordIndex = 2;
    j.player.errors = 1;
    expect(serverSideAccuracy(state, j.player)).toBeCloseTo(91.7, 1);
    j.player.errors = 0;
    expect(serverSideAccuracy(state, j.player)).toBe(100);
  });
});
