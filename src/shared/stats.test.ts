// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { calculateConsistency } from "./stats";

describe("stats utilities", () => {
  it("returns 100% consistency for empty or single sample", () => {
    expect(calculateConsistency([])).toBe(100);
    expect(calculateConsistency([80])).toBe(100);
  });

  it("returns 100% consistency for perfectly constant speed", () => {
    expect(calculateConsistency([75, 75, 75, 75])).toBe(100);
  });

  it("penalizes erratic speed fluctuations", () => {
    const consistent = calculateConsistency([60, 62, 59, 61, 60]);
    const volatile = calculateConsistency([20, 80, 10, 90, 30]);
    expect(consistent).toBeGreaterThan(volatile);
    expect(consistent).toBeGreaterThanOrEqual(90);
    expect(volatile).toBeLessThan(70);
  });
});
