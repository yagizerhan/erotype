// SPDX-License-Identifier: AGPL-3.0-or-later

export const PROTOCOL_VERSION = 2;

// Room & Player limits
export const MIN_PLAYERS = 2;
export const DEFAULT_MAX_PLAYERS = 5;
export const MAX_PLAYERS = 8;
export const MAX_SPECTATORS = 8;

// Room code alphabet (unambiguous characters: no 0/O, 1/I/L)
export const ROOM_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_ID_LENGTH = 6;

// Timing constants (ms)
export const COUNTDOWN_MS = 5_000;
export const TEXT_REVEAL_MS = 3_000; // reveal blurred text 3s before startAt
export const RACE_DURATION_MS = 60_000; // 60s default online timed race
export const RECONNECT_GRACE_MS = 30_000;
export const ROOM_IDLE_CLEANUP_MS = 5 * 60 * 1_000; // 5 minutes

// Anti-cheat & validation constants
export const MAX_WPM = 250;
export const MAX_BURST_WPM = 350;
export const MIN_WPM_FOR_TIMEOUT = 15;
export const CLOCK_SLACK_MS = 300;
export const MSG_RATE_LIMIT_PER_SEC = 30;
export const MAX_MSG_BYTES = 1_024;
export const MAX_VIOLATIONS_BEFORE_DQ = 3;
