import { describe, it, expect } from "vitest";
import { runBatch, type BatchSummary } from "../../src/experiments/batch.js";
import { DEFAULT_CONFIG } from "../../src/config.js";

describe("batch", () => {
  it("should run multiple seeds and produce summary", async () => {
    const config = { ...DEFAULT_CONFIG, T: 50 }; // Short run for test
    const seeds = [1, 2];

    const result = await runBatch({ seeds, baseConfig: config });

    expect(result.config.seeds).toEqual(seeds);
    expect(result.config.n).toBe(2);
    expect(Object.keys(result.agents).length).toBeGreaterThan(0);
  });

  it("should include all required fields in summary", async () => {
    const config = { ...DEFAULT_CONFIG, T: 50 };
    const seeds = [1, 2];

    const result = await runBatch({ seeds, baseConfig: config });

    for (const [agentId, stats] of Object.entries(result.agents)) {
      expect(stats).toHaveProperty("pnl");
      expect(stats.pnl).toHaveProperty("mean");
      expect(stats.pnl).toHaveProperty("std");
      expect(stats).toHaveProperty("maxDrawdownMean");
      expect(stats).toHaveProperty("turnoverMean");
      expect(stats).toHaveProperty("pnlByRegimeMean");
      expect(stats.pnlByRegimeMean).toHaveProperty("TREND");
      expect(stats.pnlByRegimeMean).toHaveProperty("MEANREV");
      expect(stats.pnlByRegimeMean).toHaveProperty("CHOP");
    }
  });

  it("should be deterministic with same seeds", async () => {
    const config = { ...DEFAULT_CONFIG, T: 50 };
    const seeds = [1, 2];

    const result1 = await runBatch({ seeds, baseConfig: config });
    const result2 = await runBatch({ seeds, baseConfig: config });

    // Compare agent summaries (should be identical)
    const agentIds = Object.keys(result1.agents);
    expect(agentIds).toEqual(Object.keys(result2.agents));

    for (const agentId of agentIds) {
      const stats1 = result1.agents[agentId]!;
      const stats2 = result2.agents[agentId]!;

      expect(stats1.pnl.mean).toBeCloseTo(stats2.pnl.mean, 5);
      expect(stats1.pnl.std).toBeCloseTo(stats2.pnl.std, 5);
      expect(stats1.maxDrawdownMean).toBeCloseTo(stats2.maxDrawdownMean, 5);
      expect(stats1.turnoverMean).toBeCloseTo(stats2.turnoverMean, 5);
    }
  });

  it("should include all agent types", async () => {
    const config = { ...DEFAULT_CONFIG, T: 50 };
    const seeds = [1];

    const result = await runBatch({ seeds, baseConfig: config });

    const agentIds = Object.keys(result.agents);
    expect(agentIds).toContain("noise-1");
    expect(agentIds).toContain("momentum-1");
    expect(agentIds).toContain("meanrev-1");
    expect(agentIds).toContain("marketmaker-1");
  });

  it("should use default n=20 if not specified", async () => {
    const config = { ...DEFAULT_CONFIG, T: 50 };

    const result = await runBatch({ baseConfig: config });

    expect(result.config.n).toBe(20);
    expect(result.config.seeds).toHaveLength(20);
  });
});
