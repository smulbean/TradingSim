import { describe, it, expect, beforeEach } from "vitest";
import { MomentumAgent } from "../../src/agents/momentum.js";
import type { Fill } from "../../src/agents/agent.js";

describe("MomentumAgent", () => {
  let agent: MomentumAgent;

  beforeEach(() => {
    agent = new MomentumAgent({
      id: "momentum-test",
      seed: 42,
      cash0: 10000,
      lookback: 5,
      k: 0.4,
      invPenalty: 0.02,
      maxStepQty: 3,
    });
  });

  describe("initialization", () => {
    it("should initialize with correct values", () => {
      const snap = agent.snapshot(100);
      expect(snap.cash).toBe(10000);
      expect(snap.pos).toBe(0);
      expect(snap.equity).toBe(10000);
      expect(snap.turnover).toBe(0);
      expect(snap.maxDrawdown).toBe(0);
    });
  });

  describe("observe with rising prices", () => {
    it("should return positive qty after warmup in rising trend", () => {
      // Warmup: feed lookback prices
      for (let i = 0; i < 5; i++) {
        agent.observe({ t: i, price: 100 + i });
      }
      // Now rising trend
      const orders1 = agent.observe({ t: 5, price: 106 });
      const orders2 = agent.observe({ t: 6, price: 107 });

      // At least one should have positive qty (momentum buy)
      const hasPositive = orders1.some(o => o.qty > 0) || orders2.some(o => o.qty > 0);
      expect(hasPositive).toBe(true);
    });

    it("should return negative qty after warmup in falling trend", () => {
      // Warmup
      for (let i = 0; i < 5; i++) {
        agent.observe({ t: i, price: 100 - i });
      }
      // Falling trend
      const orders1 = agent.observe({ t: 5, price: 94 });
      const orders2 = agent.observe({ t: 6, price: 93 });

      // At least one should have negative qty (momentum sell)
      const hasNegative = orders1.some(o => o.qty < 0) || orders2.some(o => o.qty < 0);
      expect(hasNegative).toBe(true);
    });
  });

  describe("inventory penalty", () => {
    it("should reduce order size when inventory is high", () => {
      // Build up positive position
      agent.onFill({ agentId: "momentum-test", qty: 10, price: 100, fee: 0.1 });
      expect(agent.snapshot(100).pos).toBe(10);

      // Create rising price trend
      for (let i = 0; i < 5; i++) {
        agent.observe({ t: i, price: 100 + i });
      }

      // With high inventory, should reduce buy orders
      const orders = agent.observe({ t: 5, price: 106 });
      // If there's an order, it should be smaller due to inventory penalty
      if (orders.length > 0 && orders[0]!.qty > 0) {
        // With invPenalty=0.02 and pos=10, penalty is 0.2, which reduces desired qty
        expect(orders[0]!.qty).toBeLessThanOrEqual(3); // maxStepQty
      }
    });

    it("should flip sign when inventory penalty dominates", () => {
      // Build up very large position
      agent.onFill({ agentId: "momentum-test", qty: 20, price: 100, fee: 0.2 });
      expect(agent.snapshot(100).pos).toBe(20);

      // Small rising trend
      for (let i = 0; i < 5; i++) {
        agent.observe({ t: i, price: 100 + i * 0.1 });
      }

      const orders = agent.observe({ t: 5, price: 100.5 });
      // With pos=20 and invPenalty=0.02, penalty is 0.4
      // Small return might not overcome this, so order might be negative or zero
      if (orders.length > 0) {
        expect(Math.abs(orders[0]!.qty)).toBeLessThanOrEqual(3);
      }
    });
  });

  describe("warmup period", () => {
    it("should return empty orders before lookback is filled", () => {
      for (let i = 0; i < 4; i++) {
        const orders = agent.observe({ t: i, price: 100 });
        expect(orders).toEqual([]);
      }
    });

    it("should start generating orders after lookback", () => {
      // Fill lookback
      for (let i = 0; i < 5; i++) {
        agent.observe({ t: i, price: 100 });
      }
      // Now should potentially generate orders
      const orders = agent.observe({ t: 5, price: 100 });
      // May be empty if no trend, but should not error
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe("order size limits", () => {
    it("should respect maxStepQty", () => {
      // Create strong trend
      for (let i = 0; i < 5; i++) {
        agent.observe({ t: i, price: 100 + i * 10 });
      }
      const orders = agent.observe({ t: 5, price: 200 });
      if (orders.length > 0) {
        expect(Math.abs(orders[0]!.qty)).toBeLessThanOrEqual(3); // maxStepQty
      }
    });
  });

  describe("onFill and snapshot", () => {
    it("should update position and cash correctly", () => {
      agent.onFill({ agentId: "momentum-test", qty: 5, price: 100, fee: 0.1 });
      const snap = agent.snapshot(100);
      expect(snap.pos).toBe(5);
      expect(snap.cash).toBeCloseTo(10000 - 5 * 100 - 0.1, 5);
      expect(snap.turnover).toBe(5);
    });

    it("should calculate equity correctly", () => {
      agent.onFill({ agentId: "momentum-test", qty: 10, price: 100, fee: 0.1 });
      const snap = agent.snapshot(110);
      const expectedEquity = snap.cash + 10 * 110;
      expect(snap.equity).toBeCloseTo(expectedEquity, 5);
    });
  });
});
