import { describe, it, expect, beforeEach } from "vitest";
import { NoiseAgent } from "../../src/agents/noise.js";
import type { Fill } from "../../src/agents/agent.js";

describe("NoiseAgent", () => {
  let agent: NoiseAgent;

  beforeEach(() => {
    agent = new NoiseAgent({ id: "test-agent", seed: 42, cash0: 10000 });
  });

  describe("initialization", () => {
    it("should initialize with correct values", () => {
      expect(agent.id).toBe("test-agent");
      const snap = agent.snapshot(100);
      expect(snap.cash).toBe(10000);
      expect(snap.pos).toBe(0);
      expect(snap.equity).toBe(10000);
      expect(snap.turnover).toBe(0);
      expect(snap.maxDrawdown).toBe(0);
    });

    it("should be deterministic with same seed", () => {
      const agent1 = new NoiseAgent({ id: "a1", seed: 123, cash0: 10000 });
      const agent2 = new NoiseAgent({ id: "a2", seed: 123, cash0: 10000 });

      const obs1 = agent1.observe({ t: 1, price: 100 });
      const obs2 = agent2.observe({ t: 1, price: 100 });
      // Should produce same qty (agentId will differ)
      expect(obs1.length).toBe(obs2.length);
      if (obs1.length > 0 && obs2.length > 0) {
        expect(obs1[0]!.qty).toBe(obs2[0]!.qty);
      }
    });
  });

  describe("observe", () => {
    it("should return orders with qty in [-2, -1, 0, 1, 2]", () => {
      for (let i = 0; i < 100; i++) {
        const orders = agent.observe({ t: i, price: 100 });
        if (orders.length > 0) {
          expect(Math.abs(orders[0]!.qty)).toBeLessThanOrEqual(2);
          expect(Math.abs(orders[0]!.qty)).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it("should return empty array when qty is 0", () => {
      // This is probabilistic, so we test many times
      let emptyCount = 0;
      for (let i = 0; i < 1000; i++) {
        const orders = agent.observe({ t: i, price: 100 });
        if (orders.length === 0) {
          emptyCount++;
        } else {
          expect(orders[0]!.agentId).toBe("test-agent");
        }
      }
      // Should have some empty orders (qty=0)
      expect(emptyCount).toBeGreaterThan(0);
    });

    it("should return orders with correct agentId", () => {
      const orders = agent.observe({ t: 1, price: 100 });
      if (orders.length > 0) {
        expect(orders[0]!.agentId).toBe("test-agent");
      }
    });

    it("should ignore market observation", () => {
      // Should work regardless of price/time (but RNG state advances)
      const orders1 = agent.observe({ t: 1, price: 100 });
      // Create new agent with same seed to test determinism
      const agent2 = new NoiseAgent({ id: "test-agent", seed: 42, cash0: 10000 });
      const orders2 = agent2.observe({ t: 1, price: 200 });
      // Same seed should produce same orders (price/time ignored)
      expect(orders1.length).toBe(orders2.length);
      if (orders1.length > 0 && orders2.length > 0) {
        expect(orders1[0]!.qty).toBe(orders2[0]!.qty);
      }
    });
  });

  describe("onFill", () => {
    it("should update cash and position correctly for buy", () => {
      const fill: Fill = { agentId: "test-agent", qty: 10, price: 100, fee: 0.1 };
      agent.onFill(fill);

      const snap = agent.snapshot(100);
      expect(snap.pos).toBe(10);
      expect(snap.cash).toBeCloseTo(10000 - 10 * 100 - 0.1, 5);
      expect(snap.turnover).toBe(10);
    });

    it("should update cash and position correctly for sell", () => {
      const fill: Fill = { agentId: "test-agent", qty: -10, price: 100, fee: 0.1 };
      agent.onFill(fill);

      const snap = agent.snapshot(100);
      expect(snap.pos).toBe(-10);
      expect(snap.cash).toBeCloseTo(10000 - (-10) * 100 - 0.1, 5);
      expect(snap.turnover).toBe(10);
    });

    it("should accumulate turnover", () => {
      agent.onFill({ agentId: "test-agent", qty: 5, price: 100, fee: 0.05 });
      agent.onFill({ agentId: "test-agent", qty: -3, price: 100, fee: 0.03 });

      const snap = agent.snapshot(100);
      expect(snap.turnover).toBe(8); // 5 + 3
    });

    it("should handle multiple fills", () => {
      agent.onFill({ agentId: "test-agent", qty: 10, price: 100, fee: 0.1 });
      agent.onFill({ agentId: "test-agent", qty: 5, price: 105, fee: 0.05 });

      const snap = agent.snapshot(110);
      expect(snap.pos).toBe(15);
      expect(snap.cash).toBeCloseTo(10000 - 10 * 100 - 0.1 - 5 * 105 - 0.05, 5);
    });
  });

  describe("markToMarket", () => {
    it("should update max drawdown when equity drops", () => {
      agent.onFill({ agentId: "test-agent", qty: 10, price: 100, fee: 0.1 });
      agent.markToMarket(100);
      const snap1 = agent.snapshot(100);
      const initialDD = snap1.maxDrawdown;

      // Price drops
      agent.markToMarket(90);
      const snap2 = agent.snapshot(90);
      expect(snap2.maxDrawdown).toBeGreaterThanOrEqual(initialDD);

      // Price drops more
      agent.markToMarket(80);
      const snap3 = agent.snapshot(80);
      expect(snap3.maxDrawdown).toBeGreaterThan(snap2.maxDrawdown);
    });

    it("should not reduce max drawdown when equity recovers", () => {
      agent.onFill({ agentId: "test-agent", qty: 10, price: 100, fee: 0.1 });
      agent.markToMarket(80); // Drop
      const snap1 = agent.snapshot(80);
      const dd1 = snap1.maxDrawdown;

      agent.markToMarket(100); // Recover
      const snap2 = agent.snapshot(100);
      expect(snap2.maxDrawdown).toBeGreaterThanOrEqual(dd1); // Should not decrease
    });

    it("should handle zero equity peak", () => {
      const agent2 = new NoiseAgent({ id: "a", seed: 1, cash0: 0 });
      agent2.markToMarket(100);
      const snap = agent2.snapshot(100);
      expect(Number.isFinite(snap.maxDrawdown)).toBe(true);
      expect(snap.maxDrawdown).toBeGreaterThanOrEqual(0);
    });
  });

  describe("snapshot", () => {
    it("should calculate equity correctly", () => {
      agent.onFill({ agentId: "test-agent", qty: 10, price: 100, fee: 0.1 });
      const snap = agent.snapshot(110);
      const expectedEquity = snap.cash + 10 * 110;
      expect(snap.equity).toBeCloseTo(expectedEquity, 5);
    });

    it("should return correct snapshot structure", () => {
      const snap = agent.snapshot(100);
      expect(snap).toHaveProperty("agentId");
      expect(snap).toHaveProperty("cash");
      expect(snap).toHaveProperty("pos");
      expect(snap).toHaveProperty("equity");
      expect(snap).toHaveProperty("turnover");
      expect(snap).toHaveProperty("maxDrawdown");
    });

    it("should reflect current price in equity", () => {
      agent.onFill({ agentId: "test-agent", qty: 10, price: 100, fee: 0.1 });
      const snap1 = agent.snapshot(100);
      const snap2 = agent.snapshot(200);
      expect(snap2.equity).toBeGreaterThan(snap1.equity);
    });

    it("should handle negative position", () => {
      agent.onFill({ agentId: "test-agent", qty: -10, price: 100, fee: 0.1 });
      const snap = agent.snapshot(100);
      expect(snap.pos).toBe(-10);
      expect(snap.equity).toBeCloseTo(snap.cash + (-10) * 100, 5);
    });
  });

  describe("edge cases", () => {
    it("should handle zero price", () => {
      const snap = agent.snapshot(0);
      expect(snap.equity).toBe(10000);
    });

    it("should handle negative price", () => {
      agent.onFill({ agentId: "test-agent", qty: 10, price: 100, fee: 0.1 });
      const snap = agent.snapshot(-100);
      expect(Number.isFinite(snap.equity)).toBe(true);
    });

    it("should handle very large price", () => {
      agent.onFill({ agentId: "test-agent", qty: 10, price: 100, fee: 0.1 });
      const snap = agent.snapshot(1e10);
      expect(Number.isFinite(snap.equity)).toBe(true);
    });

    it("should handle zero cash", () => {
      const agent2 = new NoiseAgent({ id: "a", seed: 1, cash0: 0 });
      const snap = agent2.snapshot(100);
      expect(snap.cash).toBe(0);
      expect(snap.equity).toBe(0);
    });

    it("should handle negative cash after fills", () => {
      agent.onFill({ agentId: "test-agent", qty: 200, price: 100, fee: 2 });
      const snap = agent.snapshot(100);
      expect(snap.cash).toBeLessThan(0);
      expect(Number.isFinite(snap.equity)).toBe(true);
    });
  });
});
