import { describe, it, expect } from "vitest";
import { pickRegime, ALL_REGIMES, type Regime } from "../../src/market/regimes.js";

describe("regimes", () => {
  describe("pickRegime", () => {
    it("should return TREND for r < 1/3", () => {
      expect(pickRegime(0)).toBe("TREND");
      expect(pickRegime(0.1)).toBe("TREND");
      expect(pickRegime(0.33)).toBe("TREND");
      expect(pickRegime(1 / 3 - 0.0001)).toBe("TREND");
    });

    it("should return MEANREV for 1/3 <= r < 2/3", () => {
      expect(pickRegime(1 / 3)).toBe("MEANREV");
      expect(pickRegime(0.5)).toBe("MEANREV");
      expect(pickRegime(2 / 3 - 0.0001)).toBe("MEANREV");
    });

    it("should return CHOP for r >= 2/3", () => {
      expect(pickRegime(2 / 3)).toBe("CHOP");
      expect(pickRegime(0.9)).toBe("CHOP");
      expect(pickRegime(0.99)).toBe("CHOP");
    });

    it("should handle edge cases", () => {
      // 0.3333333333 < 1/3, so should be TREND
      expect(pickRegime(0.3333333333)).toBe("TREND");
      // 0.6666666666 < 2/3, so should be MEANREV
      expect(pickRegime(0.6666666666)).toBe("MEANREV");
      // Exactly 2/3 should be CHOP
      expect(pickRegime(2 / 3)).toBe("CHOP");
    });
  });

  describe("ALL_REGIMES", () => {
    it("should contain all three regimes", () => {
      expect(ALL_REGIMES).toHaveLength(3);
      expect(ALL_REGIMES).toContain("TREND");
      expect(ALL_REGIMES).toContain("MEANREV");
      expect(ALL_REGIMES).toContain("CHOP");
    });

    it("should ensure all regimes are pickable", () => {
      const regimes = new Set<Regime>();
      // Sample many values
      for (let i = 0; i < 1000; i++) {
        const r = i / 1000;
        regimes.add(pickRegime(r));
      }
      expect(regimes.size).toBe(3);
      expect(regimes.has("TREND")).toBe(true);
      expect(regimes.has("MEANREV")).toBe(true);
      expect(regimes.has("CHOP")).toBe(true);
    });
  });
});
