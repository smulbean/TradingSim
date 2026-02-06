import { describe, it, expect } from "vitest";
import { runSim } from "../../src/runSim.js";
import type { SimConfig } from "../../src/config.js";

describe("Evolution integration", () => {
  it("should run deterministically with evolution enabled", () => {
    const cfg: SimConfig = {
      seed: 42,
      T: 200,
      cash0: 10000,
      market: {
        startFair: 100,
        startPrice: 100,
        switchProb: 0.01,
        trendDrift: 0.03,
        meanRevertK: 0.02,
        anchor: 100,
        fairNoiseStd: 0.1,
        microNoiseStd: 0.25,
      },
      exchange: {
        feePerUnit: 0.01,
        slippagePerUnit: 0.01,
        impact: 0.0005,
        hitProb: 0.15,
      },
      constraints: {
        positionLimit: 30,
        maxLeverage: 4.0,
      },
      agents: {
        noise: { count: 2 }, // Reduced for speed
        momentum: { lookback: 8, k: 0.4, invPenalty: 0.02, maxStepQty: 3 },
        meanRevert: { window: 25, k: 0.25, maxStepQty: 3 },
        marketMaker: { baseSpread: 0.1, volWindow: 30, volMultiplier: 0.5, invSkew: 0.02, size: 2 },
      },
      evolution: {
        enabled: true,
        interval: 50,
        eliteFrac: 0.5,
        mutateSigma: 0.15,
        fitness: {
          turnoverPenalty: 0.05,
          drawdownPenalty: 2000,
        },
      },
    };

    const result1 = runSim(cfg, "summary");
    const result2 = runSim(cfg, "summary");

    // Should have same number of final agents
    expect(result1.finalSnapshots.length).toBe(result2.finalSnapshots.length);
    expect(result1.finalSnapshots.length).toBe(5); // 2 noise + 1 momentum + 1 meanrev + 1 maker

    // Agent IDs should be deterministic (same set)
    const ids1 = new Set(result1.finalSnapshots.map(s => s.agentId));
    const ids2 = new Set(result2.finalSnapshots.map(s => s.agentId));
    expect(ids1).toEqual(ids2);

    // PnL by regime keys should match
    const regimeKeys1 = Object.keys(result1.pnlByRegime).sort();
    const regimeKeys2 = Object.keys(result2.pnlByRegime).sort();
    expect(regimeKeys1).toEqual(regimeKeys2);
  });

  it("should include evolution events in full mode", () => {
    const cfg: SimConfig = {
      seed: 123,
      T: 150,
      cash0: 10000,
      market: {
        startFair: 100,
        startPrice: 100,
        switchProb: 0.01,
        trendDrift: 0.03,
        meanRevertK: 0.02,
        anchor: 100,
        fairNoiseStd: 0.1,
        microNoiseStd: 0.25,
      },
      exchange: {
        feePerUnit: 0.01,
        slippagePerUnit: 0.01,
        impact: 0.0005,
        hitProb: 0.15,
      },
      constraints: {
        positionLimit: 30,
        maxLeverage: 4.0,
      },
      agents: {
        noise: { count: 2 },
        momentum: { lookback: 8, k: 0.4, invPenalty: 0.02, maxStepQty: 3 },
        meanRevert: { window: 25, k: 0.25, maxStepQty: 3 },
        marketMaker: { baseSpread: 0.1, volWindow: 30, volMultiplier: 0.5, invSkew: 0.02, size: 2 },
      },
      evolution: {
        enabled: true,
        interval: 50,
        eliteFrac: 0.5,
        mutateSigma: 0.15,
        fitness: {
          turnoverPenalty: 0.05,
          drawdownPenalty: 2000,
        },
      },
    };

    const result = runSim(cfg, "full");

    expect(result.evolutionEvents).toBeDefined();
    expect(result.evolutionEvents!.length).toBeGreaterThan(0);

    // Check structure of evolution events
    for (const event of result.evolutionEvents!) {
      expect(event.t).toBeGreaterThan(0);
      expect(event.t % cfg.evolution!.interval).toBe(0);
      expect(Array.isArray(event.ranking)).toBe(true);
      expect(Array.isArray(event.replacements)).toBe(true);

      // Ranking should have all agents
      expect(event.ranking.length).toBeGreaterThan(0);
      for (const row of event.ranking) {
        expect(row).toHaveProperty("id");
        expect(row).toHaveProperty("kind");
        expect(row).toHaveProperty("fitness");
        expect(row).toHaveProperty("pnl");
        expect(row).toHaveProperty("params");
      }
    }
  });

  it("should not evolve when evolution is disabled", () => {
    const cfg: SimConfig = {
      seed: 42,
      T: 100,
      cash0: 10000,
      market: {
        startFair: 100,
        startPrice: 100,
        switchProb: 0.01,
        trendDrift: 0.03,
        meanRevertK: 0.02,
        anchor: 100,
        fairNoiseStd: 0.1,
        microNoiseStd: 0.25,
      },
      exchange: {
        feePerUnit: 0.01,
        slippagePerUnit: 0.01,
        impact: 0.0005,
        hitProb: 0.15,
      },
      constraints: {
        positionLimit: 30,
        maxLeverage: 4.0,
      },
      agents: {
        noise: { count: 3 },
        momentum: { lookback: 8, k: 0.4, invPenalty: 0.02, maxStepQty: 3 },
        meanRevert: { window: 25, k: 0.25, maxStepQty: 3 },
        marketMaker: { baseSpread: 0.1, volWindow: 30, volMultiplier: 0.5, invSkew: 0.02, size: 2 },
      },
      evolution: {
        enabled: false,
        interval: 1000,
        eliteFrac: 0.5,
        mutateSigma: 0.15,
        fitness: {
          turnoverPenalty: 0.05,
          drawdownPenalty: 2000,
        },
      },
    };

    const result = runSim(cfg, "full");

    expect(result.evolutionEvents).toBeUndefined();
    // Agent IDs should be original ones
    const ids = result.finalSnapshots.map(s => s.agentId);
    expect(ids).toContain("noise-1");
    expect(ids).toContain("noise-2");
    expect(ids).toContain("noise-3");
    expect(ids).toContain("momentum-1");
    expect(ids).toContain("meanrev-1");
    expect(ids).toContain("marketmaker-1");
  });
});
