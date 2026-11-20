// SPDX-License-Identifier: AGPL-3.0-or-later
// Personal best / leaderboard variant key. Punctuation and numbers increase difficulty,
// so separate records are tracked: "60" (plain), "60:p" (punctuation), "60:n" (numbers), "60:pn" (both).
// In quote and race modes these options do not alter the text, so mode2 stays unchanged.

export function variantMode2(
  mode: string,
  mode2: string,
  punctuation: boolean,
  numbers: boolean
): string {
  if (mode === "quote" || mode === "race") return mode2;
  const flags = `${punctuation ? "p" : ""}${numbers ? "n" : ""}`;
  return flags ? `${mode2}:${flags}` : mode2;
}

export function parseVariantMode2(key: string): {
  base: string;
  punctuation: boolean;
  numbers: boolean;
} {
  const [base, flags = ""] = key.split(":");
  return { base, punctuation: flags.includes("p"), numbers: flags.includes("n") };
}
