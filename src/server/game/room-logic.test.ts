// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
  createInitialRoomState,
  handleClientEvent,
  handlePlayerJoin
} from "./room-logic";

describe("room-logic pure game state machine", () => {
  it("requires at least 2 players to start a race", () => {
    const state = createInitialRoomState("AB12CD", 1000, 5, "tr");
    const p1 = handlePlayerJoin(state, "Ali", 1000);
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;

    const out = handleClientEvent(
      state,
      p1.player.id,
      { t: "start" },
      1100,
      () => "kısa bir test"
    );

    expect(state.phase).toBe("LOBBY");
    expect(out.outbox[0]?.msg.t).toBe("error");
  });

  it("runs a 2-player race, validates Turkish characters, and ranks finishes", () => {
    const state = createInitialRoomState("AB12CD", 1000, 5, "tr");
    const j1 = handlePlayerJoin(state, "Ayşe", 1000);
    const j2 = handlePlayerJoin(state, "İsmail", 1010);
    if (!j1.ok || !j2.ok) throw new Error("Join failed");

    const startOut = handleClientEvent(
      state,
      j1.player.id,
      { t: "start" },
      2000,
      () => "ışık güzel"
    );

    expect(state.phase).toBe("COUNTDOWN");
    expect(state.startAt).toBe(7000);
    expect(startOut.nextAlarmAt).toBe(4000); // startAt - 3000ms text reveal

    // Player 1 completes word 1 ("ışık") at t=8500 (1.5s elapsed -> normal WPM)
    handleClientEvent(
      state,
      j1.player.id,
      { t: "progress", r: 1, w: 1, x: "ışık", e: 0, ce: 1500 },
      8500,
      () => ""
    );
    expect(state.players[j1.player.id].wordIndex).toBe(1);

    // Player 1 finishes word 2 ("güzel") at t=10000 (3.0s elapsed)
    handleClientEvent(
      state,
      j1.player.id,
      { t: "finish", r: 1, x: "güzel", ce: 2950, keys: 10, errs: 0 },
      10000,
      () => ""
    );

    expect(state.players[j1.player.id].status).toBe("finished");
    expect(state.players[j1.player.id].place).toBe(1);
  });

  it("rejects superhuman speed (>250 WPM) and disqualifies after repeated violations", () => {
    const state = createInitialRoomState("AB12CD", 1000, 5, "tr");
    const j1 = handlePlayerJoin(state, "Bot", 1000);
    const j2 = handlePlayerJoin(state, "Normal", 1010);
    if (!j1.ok || !j2.ok) throw new Error("Join failed");

    handleClientEvent(
      state,
      j1.player.id,
      { t: "start" },
      2000,
      () => "uzunkelimebir uzunkelimiki"
    );

    // 100ms after startAt=7000 -> >1000 WPM -> rejected 3 times -> DQ
    for (let i = 0; i < 3; i++) {
      handleClientEvent(
        state,
        j1.player.id,
        { t: "progress", r: 1, w: 1, x: "uzunkelimebir", e: 0, ce: 50 },
        7050,
        () => ""
      );
    }

    expect(state.players[j1.player.id].status).toBe("dq");
  });

  it("allows only the host to update room config in lobby and defaults to 60s time mode", () => {
    const state = createInitialRoomState("AB12CD", 1000, 5, "tr");
    expect(state.raceMode).toBe("time");
    expect(state.timeOption).toBe(60);

    const host = handlePlayerJoin(state, "Host", 1000);
    const guest = handlePlayerJoin(state, "Guest", 1010);
    if (!host.ok || !guest.ok) throw new Error("Join failed");

    // Non-host attempt should be rejected
    const badOut = handleClientEvent(
      state,
      guest.player.id,
      { t: "config", lang: "en", raceMode: "time", timeOption: 120 },
      1100,
      () => ""
    );
    expect(badOut.outbox[0]?.msg.t).toBe("error");
    expect(state.lang).toBe("tr");
    expect(state.timeOption).toBe(60);

    // Host attempt succeeds
    const okOut = handleClientEvent(
      state,
      host.player.id,
      { t: "config", lang: "en", raceMode: "time", timeOption: 120 },
      1200,
      () => ""
    );
    expect(okOut.outbox[0]?.msg.t).toBe("room_state");
    expect(state.lang).toBe("en");
    expect(state.raceMode).toBe("time");
    expect(state.timeOption).toBe(120);
  });
});
