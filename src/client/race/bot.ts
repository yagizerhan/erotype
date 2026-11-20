// SPDX-License-Identifier: AGPL-3.0-or-later
import { PROTOCOL_VERSION, RACE_DURATION_MS } from "../../shared/constants";
import type { ClientMessage, RaceTextMode, ServerMessage } from "../../shared/protocol";
import { splitWords } from "../../shared/text";

export interface BotConnection {
  name: string;
  targetWpm: number;
  close: () => void;
}

const BOT_PROFILES = [
  { name: "bot_kor", wpm: 58 },
  { name: "bot_alev", wpm: 76 },
  { name: "bot_fırtına", wpm: 94 },
  { name: "bot_gölge", wpm: 112 }
];

export function connectPracticeBot(roomId: string, index: number): BotConnection {
  const profile = BOT_PROFILES[index % BOT_PROFILES.length];
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${proto}//${window.location.host}/api/rooms/${roomId}/ws`;
  const ws = new WebSocket(wsUrl);

  let timers: ReturnType<typeof setTimeout>[] = [];
  let closed = false;
  let clockOffset = 0;
  let currentRaceMode: RaceTextMode = "time";
  let currentTimeLimitMs: number = RACE_DURATION_MS;

  const clearTimers = () => {
    for (const t of timers) clearTimeout(t);
    timers = [];
  };

  const send = (msg: ClientMessage) => {
    if (!closed && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  ws.onopen = () => {
    send({
      t: "hello",
      v: PROTOCOL_VERSION,
      name: `${profile.name} (${profile.wpm})`,
      // The server does not save bot results to accounts and does not count bots as opponents for wins
      bot: true
    });
    send({ t: "ping", c: Date.now() });
  };

  ws.onmessage = (ev) => {
    if (closed) return;
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(ev.data)) as ServerMessage;
    } catch {
      return;
    }

    if (msg.t === "welcome" || msg.t === "room_state") {
      currentRaceMode = msg.room.raceMode;
      currentTimeLimitMs = (msg.room.timeOption ?? 60) * 1_000;
      return;
    }

    if (msg.t === "pong") {
      const rtt = Date.now() - msg.c;
      clockOffset = msg.s - (msg.c + rtt / 2);
      return;
    }

    if (msg.t === "race_text") {
      clearTimers();
      const words = splitWords(msg.text);
      if (words.length === 0) return;

      const raceId = msg.r;
      const serverNow = Date.now() + clockOffset;
      // Add +150ms safety margin after sStartAt so the bot never triggers early-start check
      const delayUntilStart = Math.max(150, msg.sStartAt - serverNow + 150);
      let cumulativeElapsedMs = 0;
      let totalChars = 0;
      let lastScheduledChars = 0;

      words.forEach((word, idx) => {
        const wordChars = word.length + (idx < words.length - 1 ? 1 : 0);
        // Time to type this word at targetWpm: (chars / 5) * (60000 / wpm) with +-10% jitter
        const baseMs = (wordChars / 5) * (60000 / profile.wpm);
        const jitter = 0.9 + Math.random() * 0.2;
        const wordDurationMs = Math.max(240, Math.round(baseMs * jitter));

        cumulativeElapsedMs += wordDurationMs;
        totalChars += wordChars;

        if (currentRaceMode === "time" && cumulativeElapsedMs >= currentTimeLimitMs - 150) {
          return;
        }

        lastScheduledChars = totalChars;
        const fireAfterMs = delayUntilStart + cumulativeElapsedMs;
        const elapsedSnapshot = cumulativeElapsedMs;
        const charsSnapshot = totalChars;

        const timer = setTimeout(() => {
          if (idx === words.length - 1) {
            send({
              t: "finish",
              r: raceId,
              x: word,
              ce: elapsedSnapshot,
              keys: charsSnapshot + 1,
              errs: 1
            });
          } else {
            send({
              t: "progress",
              r: raceId,
              w: idx + 1,
              x: word,
              e: 0,
              ce: elapsedSnapshot
            });
          }
        }, fireAfterMs);

        timers.push(timer);
      });

      if (currentRaceMode === "time" && cumulativeElapsedMs >= currentTimeLimitMs - 150) {
        const endTimer = setTimeout(() => {
          send({
            t: "finish",
            r: raceId,
            x: "",
            ce: currentTimeLimitMs,
            keys: lastScheduledChars + 1,
            errs: 1
          });
        }, delayUntilStart + currentTimeLimitMs);
        timers.push(endTimer);
      }
    }
  };

  return {
    name: profile.name,
    targetWpm: profile.wpm,
    close: () => {
      closed = true;
      clearTimers();
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
  };
}
