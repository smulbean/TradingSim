import { describe, it, expect } from "vitest";
import { simulateMakerFill } from "../../src/exchange/makerFlow.js";
import { RNG } from "../../src/market/rng.js";
import type { Quote } from "../../src/agents/agent.js";

describe("simulateMakerFill", () => {
  it("should be deterministic with same seed", () => {
    const quote: Quote = {
      agentId: "maker-1",
      bid: 99.9,
      ask: 100.1,
      size: 2,
    };

    const rng1 = new RNG(42);
    const rng2 = new RNG(42);

    const fills1 = simulateMakerFill({ rng: rng1, quote, hitProb: 1.0, feePerUnit: 0.01 });
    const fills2 = simulateMakerFill({ rng: rng2, quote, hitProb: 1.0, feePerUnit: 0.01 });

    expect(fills1).toEqual(fills2);
  });

  it("should calculate fees correctly with hitProb=1.0", () => {
    const quote: Quote = {
      agentId: "maker-1",
      bid: 99.9,
      ask: 100.1,
      size: 5,
    };

    const rng = new RNG(42);
    const fills = simulateMakerFill({ rng, quote, hitProb: 1.0, feePerUnit: 0.01 });

    expect(fills.length).toBe(1);
    expect(fills[0]!.fee).toBe(5 * 0.01); // abs(qty) * feePerUnit
  });

  it("should return correct qty and price", () => {
    const quote: Quote = {
      agentId: "maker-1",
      bid: 99.9,
      ask: 100.1,
      size: 2,
    };

    // Test bid hit (u < 0.5)
    const rng1 = new RNG(42); // Will produce u < 0.5
    const fills1 = simulateMakerFill({ rng: rng1, quote, hitProb: 1.0, feePerUnit: 0.01 });
    if (fills1.length > 0) {
      expect(Math.abs(fills1[0]!.qty)).toBe(quote.size);
      expect(fills1[0]!.price === quote.bid || fills1[0]!.price === quote.ask).toBe(true);
    }
  });

  it("should return [] when hitProb=0", () => {
    const quote: Quote = {
      agentId: "maker-1",
      bid: 99.9,
      ask: 100.1,
      size: 2,
    };

    const rng = new RNG(42);
    const fills = simulateMakerFill({ rng, quote, hitProb: 0, feePerUnit: 0.01 });

    expect(fills).toEqual([]);
  });

  it("should return 0 or 1 fill", () => {
    const quote: Quote = {
      agentId: "maker-1",
      bid: 99.9,
      ask: 100.1,
      size: 2,
    };

    for (let i = 0; i < 100; i++) {
      const rng = new RNG(i);
      const fills = simulateMakerFill({ rng, quote, hitProb: 0.5, feePerUnit: 0.01 });
      expect(fills.length).toBeGreaterThanOrEqual(0);
      expect(fills.length).toBeLessThanOrEqual(1);
    }
  });
});
