// SPDX-License-Identifier: AGPL-3.0-or-later
import { PROTOCOL_VERSION } from "./constants";

export type RoomPhase = "LOBBY" | "COUNTDOWN" | "RACING" | "FINISHED";
export type PlayerRole = "player" | "spectator";
export type PlayerRaceStatus = "idle" | "racing" | "finished" | "dnf" | "dq";

export interface PublicPlayerState {
  id: string;
  name: string;
  connected: boolean;
  role: PlayerRole;
  wordIndex: number;
  wpm: number;
  place: number | null;
  finishMs: number | null;
  acc: number | null;
  status: PlayerRaceStatus;
}

export type RaceTextMode = "time" | "quote";
export type RaceTimeOption = 15 | 30 | 60 | 120;

export interface PublicRoomSnapshot {
  roomId: string;
  phase: RoomPhase;
  maxPlayers: number;
  hostId: string | null;
  raceId: number;
  lang: "tr" | "en";
  raceMode: RaceTextMode;
  timeOption: RaceTimeOption;
  wordCount: number;
  charCount: number;
  sStartAt: number | null;
  players: PublicPlayerState[];
}

export interface ResultRow {
  id: string;
  name: string;
  place: number | null;
  ms: number | null;
  wpm: number;
  acc: number;
  status: PlayerRaceStatus;
}

export type ErrorCode =
  | "ROOM_FULL"
  | "ROOM_NOT_FOUND"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "BAD_PROGRESS"
  | "VERSION_MISMATCH"
  | "RATE_LIMITED"
  | "INVALID_MESSAGE";

// Client -> Server messages
export type ClientMessage =
  | {
      t: "hello";
      v: number;
      name: string;
      playerId?: string;
      token?: string;
      /** Practice bot: results are not saved to an account and do not count as a rival for wins. */
      bot?: boolean;
    }
  | {
      t: "ping";
      c: number;
    }
  | {
      t: "config";
      lang?: "tr" | "en";
      raceMode?: RaceTextMode;
      timeOption?: RaceTimeOption;
    }
  | {
      t: "start";
    }
  | {
      t: "progress";
      r: number;
      w: number;
      x: string;
      e: number;
      ce: number;
    }
  | {
      t: "finish";
      r: number;
      x: string;
      ce: number;
      keys: number;
      errs: number;
    }
  | {
      t: "rematch";
    };

// Server -> Client messages
export type ServerMessage =
  | {
      t: "welcome";
      v: typeof PROTOCOL_VERSION;
      you: string;
      token: string;
      room: PublicRoomSnapshot;
      s: number;
    }
  | {
      t: "pong";
      c: number;
      s: number;
    }
  | {
      t: "room_state";
      room: PublicRoomSnapshot;
    }
  | {
      t: "player_joined";
      player: PublicPlayerState;
    }
  | {
      t: "player_left";
      id: string;
      hostId: string | null;
    }
  | {
      t: "host_changed";
      id: string | null;
    }
  | {
      t: "countdown";
      r: number;
      sStartAt: number;
      wordCount: number;
      charCount: number;
    }
  | {
      t: "race_text";
      r: number;
      text: string;
      sStartAt: number;
    }
  | {
      t: "progress_broadcast";
      id: string;
      w: number;
      sAt: number;
      wpm: number;
    }
  | {
      t: "player_finished";
      id: string;
      place: number;
      ms: number;
      wpm: number;
      acc: number;
    }
  | {
      t: "results";
      r: number;
      rows: ResultRow[];
    }
  | {
      t: "error";
      code: ErrorCode;
      msg: string;
    };
