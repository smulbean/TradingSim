import { describe, it, expect } from "vitest";
import { RNG } from "../../src/market/rng.js";

describe("RNG", () => {
  describe("deterministic behavior", () => {
    it("should produce same sequence with same seed", () => {
      const rng1 = new RNG(42);
      const rng2 = new RNG(42);

      for (let i = 0; i < 100; i++) {
        expect(rng1.nextU32()).toBe(rng2.nextU32());
        expect(rng1.nextFloat()).toBe(rng2.nextFloat());
      }
    });

    it("should produce different sequences with different seeds", () => {
      const rng1 = new RNG(42);
      const rng2 = new RNG(43);

      // Very unlikely to match
      const vals1 = Array.from({ length: 10 }, () => rng1.nextU32());
      const vals2 = Array.from({ length: 10 }, () => rng2.nextU32());
      expect(vals1).not.toEqual(vals2);
    });
  });

  describe("nextU32", () => {
    it("should return uint32 values", () => {
      const rng = new RNG(12345);
      for (let i = 0; i < 1000; i++) {
        const val = rng.nextU32();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(0xffffffff);
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it("should handle negative seeds by converting to uint32", () => {
      const rng = new RNG(-1);
      const val = rng.nextU32();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(0xffffffff);
    });

    it("should handle large seeds", () => {
      const rng = new RNG(0xffffffff);
      const val = rng.nextU32();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(0xffffffff);
    });
  });

  describe("nextFloat", () => {
    it("should return values in [0, 1)", () => {
      const rng = new RNG(42);
      for (let i = 0; i < 1000; i++) {
        const val = rng.nextFloat();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it("should never return exactly 1", () => {
      const rng = new RNG(42);
      for (let i = 0; i < 10000; i++) {
        expect(rng.nextFloat()).toBeLessThan(1);
      }
    });
  });

  describe("nextGaussian", () => {
    it("should avoid zero values for u and v", () => {
      const rng = new RNG(42);
      // Should not throw or return NaN/Infinity
      for (let i = 0; i < 100; i++) {
        const val = rng.nextGaussian();
        expect(Number.isFinite(val)).toBe(true);
        expect(Number.isNaN(val)).toBe(false);
      }
    });

    it("should respect mean parameter", () => {
      const rng = new RNG(42);
      const mean = 10;
      const samples = Array.from({ length: 1000 }, () => rng.nextGaussian(mean, 1));
      const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length;
      // Should be close to mean (within 3 std errors)
      expect(Math.abs(sampleMean - mean)).toBeLessThan(3 * (1 / Math.sqrt(1000)));
    });

    it("should respect std parameter", () => {
      const rng = new RNG(42);
      const std = 5;
      const samples = Array.from({ length: 1000 }, () => rng.nextGaussian(0, std));
      const sampleStd = Math.sqrt(
        samples.reduce((acc, x) => acc + x ** 2, 0) / (samples.length - 1)
      );
      // Should be close to std (within reasonable tolerance)
      expect(Math.abs(sampleStd - std)).toBeLessThan(1);
    });

    it("should handle zero mean and std", () => {
      const rng = new RNG(42);
      const val = rng.nextGaussian(0, 0);
      expect(Number.isFinite(val)).toBe(true);
    });

    it("should handle negative mean", () => {
      const rng = new RNG(42);
      const val = rng.nextGaussian(-10, 1);
      expect(Number.isFinite(val)).toBe(true);
    });

    it("should handle very large std", () => {
      const rng = new RNG(42);
      const val = rng.nextGaussian(0, 1000);
      expect(Number.isFinite(val)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle seed 0", () => {
      const rng = new RNG(0);
      expect(rng.nextU32()).toBeGreaterThanOrEqual(0);
      expect(rng.nextFloat()).toBeGreaterThanOrEqual(0);
      expect(rng.nextFloat()).toBeLessThan(1);
    });

    it("should produce different values on consecutive calls", () => {
      const rng = new RNG(42);
      const val1 = rng.nextU32();
      const val2 = rng.nextU32();
      // Very unlikely to be equal
      expect(val1).not.toBe(val2);
    });
  });
});
