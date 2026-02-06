import { describe, it, expect } from "vitest";
import { leaderboard } from "../../src/metrics/equity.js";
import type { AgentSnapshot } from "../../src/agents/agent.js";

describe("leaderboard", () => {
  const cash0 = 10000;

  it("should sort by equity descending", () => {
    const snaps: AgentSnapshot[] = [
      { agentId: "low", cash: 5000, pos: 0, equity: 5000, turnover: 0, maxDrawdown: 0 },
      { agentId: "high", cash: 15000, pos: 0, equity: 15000, turnover: 0, maxDrawdown: 0 },
      { agentId: "mid", cash: 10000, pos: 0, equity: 10000, turnover: 0, maxDrawdown: 0 },
    ];

    const result = leaderboard(snaps, cash0);
    expect(result[0]!.agentId).toBe("high");
    expect(result[1]!.agentId).toBe("mid");
    expect(result[2]!.agentId).toBe("low");
  });

  it("should calculate PnL correctly", () => {
    const snaps: AgentSnapshot[] = [
      { agentId: "agent1", cash: 12000, pos: 0, equity: 12000, turnover: 0, maxDrawdown: 0 },
      { agentId: "agent2", cash: 8000, pos: 0, equity: 8000, turnover: 0, maxDrawdown: 0 },
    ];

    const result = leaderboard(snaps, cash0);
    expect(result[0]!.pnl).toBe(2000);
    expect(result[1]!.pnl).toBe(-2000);
  });

  it("should include all required fields", () => {
    const snaps: AgentSnapshot[] = [
      { agentId: "agent1", cash: 10000, pos: 10, equity: 11000, turnover: 100, maxDrawdown: 0.1 },
    ];

    const result = leaderboard(snaps, cash0);
    expect(result[0]).toHaveProperty("agentId");
    expect(result[0]).toHaveProperty("pnl");
    expect(result[0]).toHaveProperty("equity");
    expect(result[0]).toHaveProperty("pos");
    expect(result[0]).toHaveProperty("turnover");
    expect(result[0]).toHaveProperty("maxDrawdownPct");
  });

  it("should convert maxDrawdown to percentage", () => {
    const snaps: AgentSnapshot[] = [
      { agentId: "agent1", cash: 10000, pos: 0, equity: 10000, turnover: 0, maxDrawdown: 0.15 },
    ];

    const result = leaderboard(snaps, cash0);
    expect(result[0]!.maxDrawdownPct).toBe(15);
  });

  it("should handle empty array", () => {
    const result = leaderboard([], cash0);
    expect(result).toEqual([]);
  });

  it("should handle single agent", () => {
    const snaps: AgentSnapshot[] = [
      { agentId: "agent1", cash: 10000, pos: 0, equity: 10000, turnover: 0, maxDrawdown: 0 },
    ];

    const result = leaderboard(snaps, cash0);
    expect(result).toHaveLength(1);
    expect(result[0]!.agentId).toBe("agent1");
  });

  it("should preserve all agents", () => {
    const snaps: AgentSnapshot[] = [
      { agentId: "a", cash: 10000, pos: 0, equity: 10000, turnover: 0, maxDrawdown: 0 },
      { agentId: "b", cash: 10000, pos: 0, equity: 10000, turnover: 0, maxDrawdown: 0 },
      { agentId: "c", cash: 10000, pos: 0, equity: 10000, turnover: 0, maxDrawdown: 0 },
    ];

    const result = leaderboard(snaps, cash0);
    expect(result).toHaveLength(3);
  });

  it("should handle ties in equity", () => {
    const snaps: AgentSnapshot[] = [
      { agentId: "a", cash: 10000, pos: 0, equity: 10000, turnover: 0, maxDrawdown: 0 },
      { agentId: "b", cash: 10000, pos: 0, equity: 10000, turnover: 0, maxDrawdown: 0 },
    ];

    const result = leaderboard(snaps, cash0);
    expect(result).toHaveLength(2);
    // Both should be present, order may vary
    expect(result.map(r => r.agentId).sort()).toEqual(["a", "b"]);
  });

  describe("edge cases", () => {
    it("should handle negative equity", () => {
      const snaps: AgentSnapshot[] = [
        { agentId: "agent1", cash: -5000, pos: 0, equity: -5000, turnover: 0, maxDrawdown: 0 },
      ];

      const result = leaderboard(snaps, cash0);
      expect(result[0]!.pnl).toBe(-15000);
    });

    it("should handle zero cash0", () => {
      const snaps: AgentSnapshot[] = [
        { agentId: "agent1", cash: 5000, pos: 0, equity: 5000, turnover: 0, maxDrawdown: 0 },
      ];

      const result = leaderboard(snaps, 0);
      expect(result[0]!.pnl).toBe(5000);
    });

    it("should handle very large equity", () => {
      const snaps: AgentSnapshot[] = [
        { agentId: "agent1", cash: 1e10, pos: 0, equity: 1e10, turnover: 0, maxDrawdown: 0 },
      ];

      const result = leaderboard(snaps, cash0);
      expect(result[0]!.pnl).toBe(1e10 - cash0);
    });

    it("should handle maxDrawdown of 1 (100% loss)", () => {
      const snaps: AgentSnapshot[] = [
        { agentId: "agent1", cash: 10000, pos: 0, equity: 10000, turnover: 0, maxDrawdown: 1.0 },
      ];

      const result = leaderboard(snaps, cash0);
      expect(result[0]!.maxDrawdownPct).toBe(100);
    });
  });
});
