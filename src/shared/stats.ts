// SPDX-License-Identifier: AGPL-3.0-or-later

export interface SecondSample {
  sec: number;
  wpm: number;
  raw: number;
  errors: number;
}

/**
 * Calculates typing consistency (0..100%) from per-second WPM values.
 * Uses coefficient of variation (stddev / mean) mapped to 0..100.
 */
export function calculateConsistency(wpmSeries: number[]): number {
  if (wpmSeries.length <= 1) return 100;
  const mean = wpmSeries.reduce((acc, v) => acc + v, 0) / wpmSeries.length;
  if (mean <= 0) return 0;

  const variance =
    wpmSeries.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / wpmSeries.length;
  const sd = Math.sqrt(variance);
  const cv = sd / mean;

  // Map CV (0 -> 100%, >=1 -> 0%) with a natural curve
  const score = Math.max(0, Math.min(100, Math.round((1 - cv * 0.75) * 100)));
  return score;
}
