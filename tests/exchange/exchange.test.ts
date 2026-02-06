import { describe, it, expect } from "vitest";
import { Exchange, type ExchangeConfig } from "../../src/exchange/exchange.js";
import type { Order } from "../../src/agents/agent.js";

describe("Exchange", () => {
  const config: ExchangeConfig = {
    feePerUnit: 0.01,
    slippagePerUnit: 0.01,
    impact: 0.0005,
  };

  describe("clear", () => {
    it("should process single buy order", () => {
      const exchange = new Exchange(config);
      const orders: Order[] = [{ agentId: "agent1", qty: 10 }];
      const { midAfter, fills } = exchange.clear(orders, 100);

      expect(fills).toHaveLength(1);
      expect(fills[0]!.agentId).toBe("agent1");
      expect(fills[0]!.qty).toBe(10);
      expect(fills[0]!.price).toBeCloseTo(100 + 0.0005 * 10 + 0.01, 5); // midAfter + slippage
      expect(fills[0]!.fee).toBe(0.1); // 10 * 0.01
      expect(midAfter).toBeCloseTo(100 + 0.0005 * 10, 5); // mid + impact
    });

    it("should process single sell order", () => {
      const exchange = new Exchange(config);
      const orders: Order[] = [{ agentId: "agent1", qty: -10 }];
      const { midAfter, fills } = exchange.clear(orders, 100);

      expect(fills).toHaveLength(1);
      expect(fills[0]!.qty).toBe(-10);
      expect(fills[0]!.price).toBeCloseTo(100 + 0.0005 * -10 - 0.01, 5); // midAfter - slippage
      expect(fills[0]!.fee).toBe(0.1);
      expect(midAfter).toBeCloseTo(100 + 0.0005 * -10, 5);
    });

    it("should process multiple orders", () => {
      const exchange = new Exchange(config);
      const orders: Order[] = [
        { agentId: "agent1", qty: 10 },
        { agentId: "agent2", qty: -5 },
      ];
      const { midAfter, fills } = exchange.clear(orders, 100);

      expect(fills).toHaveLength(2);
      const netFlow = 10 + (-5); // = 5
      expect(midAfter).toBeCloseTo(100 + 0.0005 * 5, 5);
      
      // Buy order: midAfter + slippage
      expect(fills[0]!.price).toBeCloseTo(midAfter + 0.01, 5);
      // Sell order: midAfter - slippage
      expect(fills[1]!.price).toBeCloseTo(midAfter - 0.01, 5);
    });

    it("should apply impact based on net flow", () => {
      const exchange = new Exchange(config);
      const orders: Order[] = [
        { agentId: "agent1", qty: 100 },
        { agentId: "agent2", qty: -50 },
      ];
      const { midAfter } = exchange.clear(orders, 100);
      const netFlow = 100 + (-50); // = 50
      expect(midAfter).toBeCloseTo(100 + 0.0005 * 50, 5);
    });

    it("should apply slippage correctly for buys", () => {
      const exchange = new Exchange({ ...config, slippagePerUnit: 0.05 });
      const orders: Order[] = [{ agentId: "agent1", qty: 10 }];
      const { midAfter, fills } = exchange.clear(orders, 100);
      // Buy: midAfter + slippage
      expect(fills[0]!.price).toBeCloseTo(midAfter + 0.05, 5);
    });

    it("should apply slippage correctly for sells", () => {
      const exchange = new Exchange({ ...config, slippagePerUnit: 0.05 });
      const orders: Order[] = [{ agentId: "agent1", qty: -10 }];
      const { midAfter, fills } = exchange.clear(orders, 100);
      // Sell: midAfter - slippage
      expect(fills[0]!.price).toBeCloseTo(midAfter - 0.05, 5);
    });

    it("should calculate fees correctly", () => {
      const exchange = new Exchange({ ...config, feePerUnit: 0.1 });
      const orders: Order[] = [{ agentId: "agent1", qty: 5 }];
      const { fills } = exchange.clear(orders, 100);
      expect(fills[0]!.fee).toBe(0.5); // 5 * 0.1
    });

    it("should handle zero orders", () => {
      const exchange = new Exchange(config);
      const { midAfter, fills } = exchange.clear([], 100);
      expect(midAfter).toBe(100);
      expect(fills).toHaveLength(0);
    });

    it("should handle zero net flow", () => {
      const exchange = new Exchange(config);
      const orders: Order[] = [
        { agentId: "agent1", qty: 10 },
        { agentId: "agent2", qty: -10 },
      ];
      const { midAfter } = exchange.clear(orders, 100);
      expect(midAfter).toBe(100); // No impact
    });
  });

  describe("edge cases", () => {
    it("should handle zero impact", () => {
      const exchange = new Exchange({ ...config, impact: 0 });
      const orders: Order[] = [{ agentId: "agent1", qty: 100 }];
      const { midAfter } = exchange.clear(orders, 100);
      expect(midAfter).toBe(100);
    });

    it("should handle zero slippage", () => {
      const exchange = new Exchange({ ...config, slippagePerUnit: 0 });
      const orders: Order[] = [{ agentId: "agent1", qty: 10 }];
      const { midAfter, fills } = exchange.clear(orders, 100);
      expect(fills[0]!.price).toBe(midAfter);
    });

    it("should handle zero fees", () => {
      const exchange = new Exchange({ ...config, feePerUnit: 0 });
      const orders: Order[] = [{ agentId: "agent1", qty: 10 }];
      const { fills } = exchange.clear(orders, 100);
      expect(fills[0]!.fee).toBe(0);
    });

    it("should handle very large orders", () => {
      const exchange = new Exchange(config);
      const orders: Order[] = [{ agentId: "agent1", qty: 1000000 }];
      const { midAfter, fills } = exchange.clear(orders, 100);
      expect(Number.isFinite(midAfter)).toBe(true);
      expect(fills[0]!.price).toBeGreaterThan(0);
    });

    it("should handle negative mid price", () => {
      const exchange = new Exchange(config);
      const orders: Order[] = [{ agentId: "agent1", qty: 10 }];
      const { midAfter, fills } = exchange.clear(orders, -100);
      expect(Number.isFinite(midAfter)).toBe(true);
      expect(Number.isFinite(fills[0]!.price)).toBe(true);
    });

    it("should handle zero mid price", () => {
      const exchange = new Exchange(config);
      const orders: Order[] = [{ agentId: "agent1", qty: 10 }];
      const { midAfter, fills } = exchange.clear(orders, 0);
      expect(Number.isFinite(midAfter)).toBe(true);
      expect(Number.isFinite(fills[0]!.price)).toBe(true);
    });
  });
});
