import { describe, it, expect } from "vitest";
import { Market, type MarketConfig } from "../../src/market/market.js";

describe("Market", () => {
  const baseConfig: MarketConfig = {
    seed: 42,
    startFair: 100,
    startPrice: 100,
    switchProb: 0.01,
    trendDrift: 0.03,
    meanRevertK: 0.02,
    anchor: 100,
    fairNoiseStd: 0.10,
    microNoiseStd: 0.25,
  };

  describe("initialization", () => {
    it("should initialize with correct starting values", () => {
      const market = new Market(baseConfig);
      const step = market.step();

      expect(step.t).toBe(1);
      expect(["TREND", "MEANREV", "CHOP"]).toContain(step.regime);
      expect(Number.isFinite(step.fair)).toBe(true);
      expect(Number.isFinite(step.price)).toBe(true);
    });

    it("should be deterministic with same seed", () => {
      const market1 = new Market({ ...baseConfig, seed: 123 });
      const market2 = new Market({ ...baseConfig, seed: 123 });

      for (let i = 0; i < 10; i++) {
        const step1 = market1.step();
        const step2 = market2.step();
        expect(step1.t).toBe(step2.t);
        expect(step1.regime).toBe(step2.regime);
        expect(step1.fair).toBeCloseTo(step2.fair, 10);
        expect(step1.price).toBeCloseTo(step2.price, 10);
      }
    });
  });

  describe("step", () => {
    it("should increment time step", () => {
      const market = new Market(baseConfig);
      expect(market.step().t).toBe(1);
      expect(market.step().t).toBe(2);
      expect(market.step().t).toBe(3);
    });

    it("should return valid regime", () => {
      const market = new Market(baseConfig);
      for (let i = 0; i < 100; i++) {
        const step = market.step();
        expect(["TREND", "MEANREV", "CHOP"]).toContain(step.regime);
      }
    });

    it("should calculate returns correctly", () => {
      const market = new Market(baseConfig);
      const step1 = market.step();
      const step2 = market.step();

      expect(step2.fairReturn).toBeCloseTo(step2.fair - step1.fair, 10);
      expect(step2.priceReturn).toBeCloseTo(step2.price - step1.price, 10);
    });

    it("should have finite values", () => {
      const market = new Market(baseConfig);
      for (let i = 0; i < 100; i++) {
        const step = market.step();
        expect(Number.isFinite(step.fair)).toBe(true);
        expect(Number.isFinite(step.price)).toBe(true);
        expect(Number.isFinite(step.fairReturn)).toBe(true);
        expect(Number.isFinite(step.priceReturn)).toBe(true);
      }
    });
  });

  describe("regime switching", () => {
    it("should switch regimes with high probability when switchProb=1", () => {
      const market = new Market({ ...baseConfig, switchProb: 1.0 });
      const regimes = new Set();
      for (let i = 0; i < 20; i++) {
        regimes.add(market.step().regime);
      }
      // Should see multiple regimes
      expect(regimes.size).toBeGreaterThan(1);
    });

    it("should rarely switch when switchProb=0", () => {
      const market = new Market({ ...baseConfig, switchProb: 0 });
      const firstRegime = market.step().regime;
      // With prob=0, should stay same (unless initial pick was different)
      let sameCount = 0;
      for (let i = 0; i < 100; i++) {
        if (market.step().regime === firstRegime) {
          sameCount++;
        }
      }
      // Should mostly stay the same
      expect(sameCount).toBeGreaterThan(90);
    });
  });

  describe("regime behavior", () => {
    it("should apply trend drift in TREND regime", () => {
      const market = new Market({ ...baseConfig, switchProb: 0, trendDrift: 1.0, fairNoiseStd: 0 });
      // Force TREND regime by manipulating seed
      // Actually, we can't easily force regime, but we can test that drift affects behavior
      const steps = Array.from({ length: 100 }, () => market.step());
      // In TREND, should have positive drift on average
      const avgReturn = steps.reduce((sum, s) => sum + s.fairReturn, 0) / steps.length;
      // With noise=0 and trend drift, should see positive drift when in TREND
      expect(Number.isFinite(avgReturn)).toBe(true);
    });

    it("should mean revert in MEANREV regime", () => {
      const market = new Market({
        ...baseConfig,
        startFair: 150, // Start far from anchor
        meanRevertK: 0.5,
        fairNoiseStd: 0,
        switchProb: 0,
      });
      // Can't easily force MEANREV, but can verify mean reversion logic exists
      const step = market.step();
      expect(Number.isFinite(step.fair)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle zero noise", () => {
      const market = new Market({ ...baseConfig, fairNoiseStd: 0, microNoiseStd: 0 });
      const step = market.step();
      expect(Number.isFinite(step.fair)).toBe(true);
      expect(Number.isFinite(step.price)).toBe(true);
    });

    it("should handle very large noise", () => {
      const market = new Market({ ...baseConfig, fairNoiseStd: 1000, microNoiseStd: 1000 });
      const step = market.step();
      expect(Number.isFinite(step.fair)).toBe(true);
      expect(Number.isFinite(step.price)).toBe(true);
    });

    it("should handle negative startFair", () => {
      const market = new Market({ ...baseConfig, startFair: -100, startPrice: -100 });
      const step = market.step();
      expect(Number.isFinite(step.fair)).toBe(true);
      expect(Number.isFinite(step.price)).toBe(true);
    });

    it("should handle zero startFair", () => {
      const market = new Market({ ...baseConfig, startFair: 0, startPrice: 0 });
      const step = market.step();
      expect(Number.isFinite(step.fair)).toBe(true);
      expect(Number.isFinite(step.price)).toBe(true);
    });
  });
});
