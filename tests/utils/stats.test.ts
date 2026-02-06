import { describe, it, expect } from "vitest";
import { mean, std } from "../../src/utils/stats.js";

describe("stats", () => {
  describe("mean", () => {
    it("should calculate mean correctly", () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
      expect(mean([10, 20, 30])).toBe(20);
      expect(mean([-1, 0, 1])).toBe(0);
    });

    it("should return 0 for empty array", () => {
      expect(mean([])).toBe(0);
    });

    it("should handle single element", () => {
      expect(mean([42])).toBe(42);
      expect(mean([-10])).toBe(-10);
    });

    it("should handle negative numbers", () => {
      expect(mean([-5, -3, -1])).toBe(-3);
    });

    it("should handle decimals", () => {
      expect(mean([1.5, 2.5, 3.5])).toBeCloseTo(2.5, 10);
    });

    it("should handle large numbers", () => {
      expect(mean([1000000, 2000000, 3000000])).toBe(2000000);
    });

    it("should handle zeros", () => {
      expect(mean([0, 0, 0])).toBe(0);
      expect(mean([0, 5, 10])).toBe(5);
    });
  });

  describe("std", () => {
    it("should calculate standard deviation correctly", () => {
      // Known case: std([1,2,3,4,5]) ≈ 1.581
      const result = std([1, 2, 3, 4, 5]);
      expect(result).toBeCloseTo(1.58113883, 5);
    });

    it("should return 0 for empty array", () => {
      expect(std([])).toBe(0);
    });

    it("should return 0 for single element array", () => {
      expect(std([42])).toBe(0);
    });

    it("should return 0 for array with all same values", () => {
      expect(std([5, 5, 5, 5])).toBe(0);
    });

    it("should handle negative numbers", () => {
      const result = std([-2, -1, 0, 1, 2]);
      expect(result).toBeCloseTo(1.58113883, 5);
    });

    it("should handle decimals", () => {
      const result = std([1.1, 2.2, 3.3]);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it("should handle large variance", () => {
      const result = std([1, 100, 10000]);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it("should use sample standard deviation (n-1)", () => {
      // For [1,2,3], sample std should use denominator 2
      const result = std([1, 2, 3]);
      // Manual calculation: mean=2, variance = ((1-2)^2 + (2-2)^2 + (3-2)^2) / 2 = 2/2 = 1
      expect(result).toBeCloseTo(1.0, 5);
    });
  });

  describe("edge cases", () => {
    it("should handle very small numbers", () => {
      const result = std([0.0001, 0.0002, 0.0003]);
      expect(Number.isFinite(result)).toBe(true);
    });

    it("should handle very large numbers", () => {
      const result = std([1e10, 2e10, 3e10]);
      expect(Number.isFinite(result)).toBe(true);
    });

    it("should handle mixed positive and negative", () => {
      const result = std([-100, 0, 100]);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });
  });
});
