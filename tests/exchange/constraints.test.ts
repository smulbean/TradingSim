import { describe, it, expect } from "vitest";
import { clampOrderQty, type Constraints } from "../../src/exchange/constraints.js";

describe("constraints", () => {
  const constraints: Constraints = {
    positionLimit: 30,
    maxLeverage: 4.0,
  };

  describe("positionLimit", () => {
    it("should allow orders within limit", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 0,
        price: 100,
        equity: 10000,
        constraints,
      });
      expect(qty).toBe(10);
    });

    it("should clamp buy orders that exceed limit", () => {
      const qty = clampOrderQty({
        qty: 50,
        pos: 0,
        price: 100,
        equity: 10000,
        constraints,
      });
      expect(qty).toBe(30); // Clamped to limit
    });

    it("should clamp sell orders that exceed limit", () => {
      const qty = clampOrderQty({
        qty: -50,
        pos: 0,
        price: 100,
        equity: 10000,
        constraints,
      });
      expect(qty).toBe(-30); // Clamped to limit
    });

    it("should clamp when already at limit", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 30, // Already at limit
        price: 100,
        equity: 10000,
        constraints,
      });
      expect(qty).toBe(0); // Can't go beyond limit
    });

    it("should clamp when already at negative limit", () => {
      const qty = clampOrderQty({
        qty: -10,
        pos: -30, // Already at negative limit
        price: 100,
        equity: 10000,
        constraints,
      });
      expect(qty).toBe(0);
    });

    it("should allow partial fill when near limit", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 25, // 5 away from limit
        price: 100,
        equity: 10000,
        constraints,
      });
      expect(qty).toBe(5); // Only 5 allowed
    });
  });

  describe("maxLeverage", () => {
    it("should allow orders within leverage limit", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 0,
        price: 100,
        equity: 10000,
        constraints,
      });
      // 10 * 100 = 1000 notional, 1000/10000 = 0.1 leverage, OK
      expect(qty).toBe(10);
    });

    it("should clamp orders that exceed leverage", () => {
      const qty = clampOrderQty({
        qty: 500, // Would be 500*100 = 50000 notional, 50000/10000 = 5x leverage
        pos: 0,
        price: 100,
        equity: 10000,
        constraints: { positionLimit: 1000, maxLeverage: 4.0 },
      });
      // Max notional = 4 * 10000 = 40000
      // Max pos = 40000 / 100 = 400
      expect(qty).toBeLessThanOrEqual(400);
    });

    it("should handle zero equity", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 0,
        price: 100,
        equity: 0,
        constraints,
      });
      expect(qty).toBe(0);
    });

    it("should handle negative equity", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 0,
        price: 100,
        equity: -1000,
        constraints,
      });
      expect(qty).toBe(0);
    });

    it("should handle very small equity", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 0,
        price: 100,
        equity: 1,
        constraints,
      });
      // Max notional = 4 * 1 = 4, max pos = 4/100 = 0.04, rounded = 0
      expect(qty).toBe(0);
    });
  });

  describe("combined constraints", () => {
    it("should apply position limit first, then leverage", () => {
      const qty = clampOrderQty({
        qty: 100, // Would exceed position limit
        pos: 0,
        price: 100,
        equity: 10000,
        constraints: { positionLimit: 30, maxLeverage: 4.0 },
      });
      // Position limit should win
      expect(qty).toBe(30);
    });

    it("should apply leverage when position limit allows but leverage doesn't", () => {
      const qty = clampOrderQty({
        qty: 100,
        pos: 0,
        price: 1000, // High price
        equity: 10000,
        constraints: { positionLimit: 200, maxLeverage: 4.0 },
      });
      // Max notional = 40000, max pos = 40000/1000 = 40
      expect(qty).toBeLessThanOrEqual(40);
    });
  });

  describe("edge cases", () => {
    it("should handle zero qty", () => {
      const qty = clampOrderQty({
        qty: 0,
        pos: 0,
        price: 100,
        equity: 10000,
        constraints,
      });
      expect(qty).toBe(0);
    });

    it("should handle zero price", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 0,
        price: 0,
        equity: 10000,
        constraints,
      });
      // Should handle gracefully (division by small number protection)
      expect(Number.isFinite(qty)).toBe(true);
    });

    it("should handle very small price", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 0,
        price: 0.0001,
        equity: 10000,
        constraints,
      });
      expect(Number.isFinite(qty)).toBe(true);
    });

    it("should handle negative price", () => {
      const qty = clampOrderQty({
        qty: 10,
        pos: 0,
        price: -100,
        equity: 10000,
        constraints,
      });
      expect(Number.isFinite(qty)).toBe(true);
    });

    it("should handle very large position", () => {
      const qty = clampOrderQty({
        qty: 1,
        pos: 1000,
        price: 100,
        equity: 10000,
        constraints,
      });
      // Should be clamped by position limit
      expect(Math.abs(qty)).toBeLessThanOrEqual(30);
    });
  });
});
