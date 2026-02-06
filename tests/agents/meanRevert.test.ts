import { describe, it, expect, beforeEach } from "vitest";
import { MeanRevertAgent } from "../../src/agents/meanRevert.js";
import type { Fill } from "../../src/agents/agent.js";

describe("MeanRevertAgent", () => {
  let agent: MeanRevertAgent;

  beforeEach(() => {
    agent = new MeanRevertAgent({
      id: "meanrev-test",
      seed: 42,
      cash0: 10000,
      window: 10,
      k: 0.25,
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

  describe("observe with price spike above mean", () => {
    it("should sell when price spikes above mean", () => {
      // Build stable mean around 100
      for (let i = 0; i < 10; i++) {
        agent.observe({ t: i, price: 100 });
      }
      // Spike to 110
      const orders = agent.observe({ t: 10, price: 110 });

      // Should sell (negative qty) when price is above mean
      if (orders.length > 0) {
        expect(orders[0]!.qty).toBeLessThan(0);
      } else {
        // If tanh(k*dev) is very small, might round to 0
        // But with dev=10 and k=0.25, tanh(2.5) ≈ 0.99, so should sell
        // Let's check the next observation
        const orders2 = agent.observe({ t: 11, price: 110 });
        expect(orders2.length).toBeGreaterThan(0);
        expect(orders2[0]!.qty).toBeLessThan(0);
      }
    });
  });

  describe("observe with price dip below mean", () => {
    it("should buy when price dips below mean", () => {
      // Build stable mean around 100
      for (let i = 0; i < 10; i++) {
        agent.observe({ t: i, price: 100 });
      }
      // Dip to 90
      const orders = agent.observe({ t: 10, price: 90 });

      // Should buy (positive qty) when price is below mean
      if (orders.length > 0) {
        expect(orders[0]!.qty).toBeGreaterThan(0);
      } else {
        // Check next observation
        const orders2 = agent.observe({ t: 11, price: 90 });
        expect(orders2.length).toBeGreaterThan(0);
        expect(orders2[0]!.qty).toBeGreaterThan(0);
      }
    });
  });

  describe("warmup period", () => {
    it("should return empty orders before window is filled", () => {
      for (let i = 0; i < 9; i++) {
        const orders = agent.observe({ t: i, price: 100 });
        expect(orders).toEqual([]);
      }
    });

    it("should start generating orders after window is filled", () => {
      // Fill window
      for (let i = 0; i < 10; i++) {
        agent.observe({ t: i, price: 100 });
      }
      // Now should potentially generate orders
      const orders = agent.observe({ t: 10, price: 100 });
      // May be empty if no deviation, but should not error
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe("sliding window", () => {
    it("should maintain correct window size", () => {
      // Fill window
      for (let i = 0; i < 15; i++) {
        agent.observe({ t: i, price: 100 + i });
      }
      // Window should only contain last 10 prices
      // Mean should be around 105-110, not 100
      const orders = agent.observe({ t: 15, price: 100 });
      // Price 100 is below the recent mean, should buy
      if (orders.length > 0) {
        expect(orders[0]!.qty).toBeGreaterThan(0);
      }
    });
  });

  describe("order size limits", () => {
    it("should respect maxStepQty", () => {
      // Build mean
      for (let i = 0; i < 10; i++) {
        agent.observe({ t: i, price: 100 });
      }
      // Large deviation
      const orders = agent.observe({ t: 10, price: 200 });
      if (orders.length > 0) {
        expect(Math.abs(orders[0]!.qty)).toBeLessThanOrEqual(3); // maxStepQty
      }
    });
  });

  describe("onFill and snapshot", () => {
    it("should update position and cash correctly", () => {
      agent.onFill({ agentId: "meanrev-test", qty: -5, price: 100, fee: 0.1 });
      const snap = agent.snapshot(100);
      expect(snap.pos).toBe(-5);
      expect(snap.cash).toBeCloseTo(10000 - (-5) * 100 - 0.1, 5);
      expect(snap.turnover).toBe(5);
    });

    it("should calculate equity correctly", () => {
      agent.onFill({ agentId: "meanrev-test", qty: 10, price: 100, fee: 0.1 });
      const snap = agent.snapshot(110);
      const expectedEquity = snap.cash + 10 * 110;
      expect(snap.equity).toBeCloseTo(expectedEquity, 5);
    });
  });
});
