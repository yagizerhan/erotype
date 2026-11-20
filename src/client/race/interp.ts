// SPDX-License-Identifier: AGPL-3.0-or-later
// Opponent animation smoothing: Dead reckoning + bounded exponential decay

export interface RemoteRacerState {
  confirmedRatio: number; // 0..1
  confirmedAt: number; // performance.now()
  speedPerMs: number; // ratio per ms derived from authoritative WPM
  shownRatio: number; // 0..1 rendered on screen
  nextWordLimit: number; // max ratio before next word boundary
  finished: boolean;
}

export function createRemoteRacer(
  now = performance.now(),
  prefixChars?: number[]
): RemoteRacerState {
  const totalChars =
    prefixChars && prefixChars.length > 0
      ? prefixChars[prefixChars.length - 1] || 100
      : 100;
  const firstWordRatio =
    prefixChars && prefixChars.length > 1
      ? Math.min(1, (prefixChars[1] ?? 5) / totalChars)
      : 0.08;
  // Gentle initial dead-reckoning (~55 WPM) across word 1 so the bar starts smoothly at t=0
  const initialSpeed = (55 * 5) / 60_000 / totalChars;
  return {
    confirmedRatio: 0,
    confirmedAt: now,
    speedPerMs: initialSpeed,
    shownRatio: 0,
    nextWordLimit: firstWordRatio,
    finished: false
  };
}

export function onRemoteProgress(
  r: RemoteRacerState,
  wordIndex: number,
  wpm: number,
  prefixChars: number[],
  now = performance.now()
): void {
  const totalChars = prefixChars[prefixChars.length - 1] || 1;
  const newRatio = Math.min(1, (prefixChars[wordIndex] ?? 0) / totalChars);
  const nextRatio = Math.min(
    1,
    (prefixChars[wordIndex + 1] ?? totalChars) / totalChars
  );

  // Derive smooth velocity directly from authoritative WPM (1 word = 5 chars)
  if (wpm > 0 && totalChars > 0) {
    const charsPerMs = (wpm * 5) / 60_000;
    const wpmSpeed = charsPerMs / totalChars;
    r.speedPerMs = r.speedPerMs > 0 ? r.speedPerMs * 0.4 + wpmSpeed * 0.6 : wpmSpeed;
  }

  r.confirmedRatio = newRatio;
  r.confirmedAt = now;
  r.nextWordLimit = Math.max(newRatio, nextRatio);
  if (newRatio >= 1) {
    r.finished = true;
  }
}

export function stepRemoteRacer(
  r: RemoteRacerState,
  frameDtMs: number,
  now = performance.now()
): number {
  const k = 1 - Math.exp(-frameDtMs / 110);
  if (r.finished) {
    r.shownRatio = Math.min(1, r.shownRatio + (1 - r.shownRatio) * k);
    if (1 - r.shownRatio < 0.002) r.shownRatio = 1;
    return r.shownRatio;
  }

  const dtSinceConfirm = Math.max(0, now - r.confirmedAt);
  // Extrapolate at 90% of current WPM velocity up to 92% of the next word boundary
  const softLimit =
    r.confirmedRatio + (r.nextWordLimit - r.confirmedRatio) * 0.92;
  let target = r.confirmedRatio + r.speedPerMs * 0.9 * dtSinceConfirm;
  target = Math.min(target, softLimit, 1);
  target = Math.max(target, r.shownRatio); // never move backwards

  r.shownRatio += (target - r.shownRatio) * k;
  return r.shownRatio;
}
