import { describe, it, expect, beforeEach } from "vitest";
import { MarketMakerAgent } from "../../src/agents/marketMaker.js";
import type { Fill } from "../../src/agents/agent.js";

describe("MarketMakerAgent", () => {
  let agent: MarketMakerAgent;

  beforeEach(() => {
    agent = new MarketMakerAgent({
      id: "maker-test",
      seed: 42,
      cash0: 10000,
      baseSpread: 0.1,
      volWindow: 10,
      volMultiplier: 2.0,
      invSkew: 0.05,
      size: 2,
      maxStepInventory: 20,
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

  describe("quote warmup", () => {
    it("should return null before volWindow is filled", () => {
      for (let i = 0; i < 9; i++) {
        const quote = agent.quote({ t: i, price: 100 + i * 0.1 }, 100);
        expect(quote).toBeNull();
      }
    });

    it("should start generating quotes after volWindow is filled", () => {
      // Fill volWindow
      for (let i = 0; i < 10; i++) {
        agent.quote({ t: i, price: 100 + i * 0.1 }, 100);
      }
      const quote = agent.quote({ t: 10, price: 101 }, 100);
      expect(quote).not.toBeNull();
      if (quote) {
        expect(quote.bid).toBeLessThan(quote.ask);
        expect(quote.size).toBeGreaterThan(0);
      }
    });
  });

  describe("spread widens with volatility", () => {
    it("should have wider spread when volatility increases", () => {
      const agentLowVol = new MarketMakerAgent({
        id: "maker-low-vol",
        seed: 43,
        cash0: 10000,
        baseSpread: 0.1,
        volWindow: 5,
        volMultiplier: 1.0,
        invSkew: 0,
        size: 2,
      });

      // Build low volatility history (constant price)
      for (let i = 0; i < 5; i++) {
        agentLowVol.quote({ t: i, price: 100 }, 100);
      }
      const quoteLowVol = agentLowVol.quote({ t: 5, price: 100 }, 100);
      expect(quoteLowVol).not.toBeNull();

      const agentHighVol = new MarketMakerAgent({
        id: "maker-high-vol",
        seed: 44,
        cash0: 10000,
        baseSpread: 0.1,
        volWindow: 5,
        volMultiplier: 1.0,
        invSkew: 0,
        size: 2,
      });

      // Build high volatility history (alternating prices)
      for (let i = 0; i < 5; i++) {
        agentHighVol.quote({ t: i, price: 100 + (i % 2) * 10 }, 100);
      }
      const quoteHighVol = agentHighVol.quote({ t: 5, price: 100 }, 100);
      expect(quoteHighVol).not.toBeNull();

      if (quoteLowVol && quoteHighVol) {
        const spreadLow = quoteLowVol.ask - quoteLowVol.bid;
        const spreadHigh = quoteHighVol.ask - quoteHighVol.bid;
        expect(spreadHigh).toBeGreaterThan(spreadLow);
      }
    });
  });

  describe("inventory skew", () => {
    it("should skew quotes away from inventory", () => {
      const agentSkew = new MarketMakerAgent({
        id: "maker-skew",
        seed: 45,
        cash0: 10000,
        baseSpread: 0.1,
        volWindow: 10,
        volMultiplier: 0, // No vol effect for stable spread
        invSkew: 0.05,
        size: 2,
      });

      // Warm up with constant price
      for (let i = 0; i < 10; i++) {
        agentSkew.quote({ t: i, price: 100 }, 100);
      }

      // Record bid/ask with pos=0
      const quoteNeutral = agentSkew.quote({ t: 10, price: 100 }, 100);
      expect(quoteNeutral).not.toBeNull();

      // Apply fill to set pos positive
      agentSkew.onFill({ agentId: "maker-skew", qty: 10, price: 100, fee: 0 });
      const quotePositive = agentSkew.quote({ t: 11, price: 100 }, 100);
      expect(quotePositive).not.toBeNull();

      if (quoteNeutral && quotePositive) {
        // With positive inventory, bid and ask should both be LOWER (skew down)
        expect(quotePositive.bid).toBeLessThan(quoteNeutral.bid);
        expect(quotePositive.ask).toBeLessThan(quoteNeutral.ask);
      }
    });

    it("should skew quotes up with negative inventory", () => {
      // Build history
      for (let i = 0; i < 10; i++) {
        agent.quote({ t: i, price: 100 }, 100);
      }

      const quoteNeutral = agent.quote({ t: 10, price: 100 }, 100);
      expect(quoteNeutral).not.toBeNull();

      // Build negative inventory
      agent.onFill({ agentId: "maker-test", qty: -10, price: 100, fee: 0.1 });
      const quoteNegative = agent.quote({ t: 11, price: 100 }, 100);
      expect(quoteNegative).not.toBeNull();

      if (quoteNeutral && quoteNegative) {
        // With negative inventory, bid should be higher (skew up)
        expect(quoteNegative.bid).toBeGreaterThan(quoteNeutral.bid);
        expect(quoteNegative.ask).toBeGreaterThan(quoteNeutral.ask);
      }
    });
  });

  describe("quote validity", () => {
    it("should ensure bid < ask", () => {
      for (let i = 0; i < 10; i++) {
        agent.quote({ t: i, price: 100 }, 100);
      }
      const quote = agent.quote({ t: 10, price: 100 }, 100);
      if (quote) {
        expect(quote.bid).toBeLessThan(quote.ask);
      }
    });

    it("should respect maxStepInventory", () => {
      const agent2 = new MarketMakerAgent({
        id: "maker-test-3",
        seed: 44,
        cash0: 10000,
        baseSpread: 0.1,
        volWindow: 10,
        volMultiplier: 2.0,
        invSkew: 0.05,
        size: 10,
        maxStepInventory: 5,
      });
      for (let i = 0; i < 10; i++) {
        agent2.quote({ t: i, price: 100 }, 100);
      }
      const quote = agent2.quote({ t: 10, price: 100 }, 100);
      if (quote) {
        expect(quote.size).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("onFill and snapshot", () => {
    it("should update position and cash correctly", () => {
      agent.onFill({ agentId: "maker-test", qty: 5, price: 100, fee: 0.1 });
      const snap = agent.snapshot(100);
      expect(snap.pos).toBe(5);
      expect(snap.cash).toBeCloseTo(10000 - 5 * 100 - 0.1, 5);
      expect(snap.turnover).toBe(5);
    });

    it("should calculate equity correctly", () => {
      agent.onFill({ agentId: "maker-test", qty: 10, price: 100, fee: 0.1 });
      const snap = agent.snapshot(110);
      const expectedEquity = snap.cash + 10 * 110;
      expect(snap.equity).toBeCloseTo(expectedEquity, 5);
    });
  });
});
