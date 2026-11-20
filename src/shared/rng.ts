// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Seeded deterministic PRNG (mulberry32).
 * Client and server produce the exact same sequence from the same seed,
 * allowing solo test results to be recomputed and verified on the server.
 *
 * Uses only 32-bit integer arithmetic (never Math.sin-based PRNGs whose
 * floating-point output can diverge across JS engines).
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random seed in 1..2^31 (non-cryptographic, used only for word selection). */
export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * 0x7ffffffe);
}
