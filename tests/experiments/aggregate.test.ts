import { describe, it, expect } from "vitest";
import { aggregateRegimePnL } from "../../src/experiments/aggregate.js";
import type { Regime } from "../../src/market/regimes.js";

describe("aggregate", () => {
  describe("aggregateRegimePnL", () => {
    it("should compute mean PnL per agent per regime", () => {
      const results: Array<Record<string, Record<Regime, number>>> = [
        {
          "agent-1": { TREND: 10, MEANREV: -5, CHOP: 2 },
          "agent-2": { TREND: 20, MEANREV: -10, CHOP: 5 },
        },
        {
          "agent-1": { TREND: 15, MEANREV: -3, CHOP: 1 },
          "agent-2": { TREND: 25, MEANREV: -8, CHOP: 3 },
        },
        {
          "agent-1": { TREND: 5, MEANREV: -7, CHOP: 3 },
          "agent-2": { TREND: 15, MEANREV: -12, CHOP: 7 },
        },
      ];

      const aggregated = aggregateRegimePnL(results);

      // agent-1 TREND: (10 + 15 + 5) / 3 = 10
      expect(aggregated["agent-1"]?.TREND).toBeCloseTo(10, 5);
      // agent-1 MEANREV: (-5 + -3 + -7) / 3 = -5
      expect(aggregated["agent-1"]?.MEANREV).toBeCloseTo(-5, 5);
      // agent-1 CHOP: (2 + 1 + 3) / 3 = 2
      expect(aggregated["agent-1"]?.CHOP).toBeCloseTo(2, 5);

      // agent-2 TREND: (20 + 25 + 15) / 3 = 20
      expect(aggregated["agent-2"]?.TREND).toBeCloseTo(20, 5);
      // agent-2 MEANREV: (-10 + -8 + -12) / 3 = -10
      expect(aggregated["agent-2"]?.MEANREV).toBeCloseTo(-10, 5);
      // agent-2 CHOP: (5 + 3 + 7) / 3 = 5
      expect(aggregated["agent-2"]?.CHOP).toBeCloseTo(5, 5);
    });

    it("should handle missing agents gracefully", () => {
      const results: Array<Record<string, Record<Regime, number>>> = [
        { "agent-1": { TREND: 10, MEANREV: 0, CHOP: 0 } },
        {
          "agent-1": { TREND: 20, MEANREV: 0, CHOP: 0 },
          "agent-2": { TREND: 5, MEANREV: 0, CHOP: 0 },
        },
      ];

      const aggregated = aggregateRegimePnL(results);

      // agent-1 appears in both: (10 + 20) / 2 = 15
      expect(aggregated["agent-1"]?.TREND).toBeCloseTo(15, 5);
      // agent-2 appears in one, missing in first (treated as 0): (0 + 5) / 2 = 2.5
      expect(aggregated["agent-2"]?.TREND).toBeCloseTo(2.5, 5);
    });

    it("should handle empty results", () => {
      const aggregated = aggregateRegimePnL([]);
      expect(Object.keys(aggregated)).toHaveLength(0);
    });

    it("should handle single result", () => {
      const results: Array<Record<string, Record<Regime, number>>> = [
        { "agent-1": { TREND: 10, MEANREV: -5, CHOP: 2 } },
      ];

      const aggregated = aggregateRegimePnL(results);

      expect(aggregated["agent-1"]?.TREND).toBe(10);
      expect(aggregated["agent-1"]?.MEANREV).toBe(-5);
      expect(aggregated["agent-1"]?.CHOP).toBe(2);
    });
  });
});
