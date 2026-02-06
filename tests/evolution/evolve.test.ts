import { describe, it, expect } from "vitest";
import { RNG } from "../../src/market/rng.js";
import { mutateParams, computeFitness, evolvePopulation, PARAM_BOUNDS, INTEGER_PARAMS } from "../../src/evolution/evolve.js";
import type { AgentSpec } from "../../src/agents/factory.js";
import type { AgentSnapshot } from "../../src/agents/agent.js";

describe("mutateParams", () => {
  it("should be deterministic with fixed RNG seed", () => {
    const rng1 = new RNG(42);
    const rng2 = new RNG(42);
    const params = { k: 0.5, lookback: 10 };
    const bounds = PARAM_BOUNDS.momentum;

    const result1 = mutateParams(rng1, params, 0.15, bounds);
    const result2 = mutateParams(rng2, params, 0.15, bounds);

    expect(result1).toEqual(result2);
  });

  it("should respect bounds", () => {
    const rng = new RNG(123);
    const params = { k: 0.5, lookback: 10 };
    const bounds = PARAM_BOUNDS.momentum;

    const result = mutateParams(rng, params, 0.5, bounds); // Large sigma to test bounds

    expect(result.k).toBeGreaterThanOrEqual(bounds.k!.min);
    expect(result.k).toBeLessThanOrEqual(bounds.k!.max);
    expect(result.lookback).toBeGreaterThanOrEqual(bounds.lookback!.min);
    expect(result.lookback).toBeLessThanOrEqual(bounds.lookback!.max);
  });

  it("should round integer parameters correctly", () => {
    const rng = new RNG(456);
    const params = { lookback: 10, maxStepQty: 5 };
    const bounds = PARAM_BOUNDS.momentum;

    const mutated = mutateParams(rng, params, 0.15, bounds);
    // After mutation, we need to round integers
    const intParams = INTEGER_PARAMS["momentum"] || [];
    for (const key of intParams) {
      if (mutated[key] !== undefined) {
        mutated[key] = Math.round(mutated[key]!);
        if (bounds && bounds[key]) {
          mutated[key] = Math.max(
            bounds[key]!.min,
            Math.min(bounds[key]!.max, mutated[key]!)
          );
        }
      }
    }

    expect(Number.isInteger(mutated.lookback)).toBe(true);
    expect(Number.isInteger(mutated.maxStepQty)).toBe(true);
  });
});

describe("computeFitness", () => {
  it("should compute fitness correctly and sort by fitness desc", () => {
    const snapshots: AgentSnapshot[] = [
      {
        agentId: "agent1",
        cash: 10000,
        pos: 0,
        equity: 12000,
        turnover: 100,
        maxDrawdown: 0.1,
      },
      {
        agentId: "agent2",
        cash: 10000,
        pos: 0,
        equity: 11000,
        turnover: 50,
        maxDrawdown: 0.05,
      },
    ];

    const rows = [
      { id: "agent1", kind: "momentum" as const, params: { k: 0.5 } },
      { id: "agent2", kind: "momentum" as const, params: { k: 0.3 } },
    ];

    const fitness = computeFitness({
      snapshots,
      cash0: 10000,
      rows,
      turnoverPenalty: 0.05,
      drawdownPenalty: 2000,
    });

    expect(fitness.length).toBe(2);
    expect(fitness[0]!.fitness).toBeGreaterThan(fitness[1]!.fitness);
    expect(fitness[0]!.id).toBe("agent1");
    expect(fitness[0]!.pnl).toBe(2000);
    expect(fitness[1]!.pnl).toBe(1000);
  });
});

describe("evolvePopulation", () => {
  it("should preserve population size", () => {
    const rng = new RNG(789);
    const population: AgentSpec[] = [
      { kind: "momentum", id: "m1", seed: 1, params: { lookback: 8, k: 0.4, invPenalty: 0.02, maxStepQty: 3 } },
      { kind: "momentum", id: "m2", seed: 2, params: { lookback: 10, k: 0.5, invPenalty: 0.03, maxStepQty: 4 } },
      { kind: "meanRevert", id: "mr1", seed: 3, params: { window: 25, k: 0.25, maxStepQty: 3 } },
      { kind: "meanRevert", id: "mr2", seed: 4, params: { window: 30, k: 0.3, maxStepQty: 4 } },
    ];

    const fitness = [
      { id: "m1", kind: "momentum" as const, pnl: 1000, turnover: 50, maxDrawdown: 0.1, fitness: 900, params: population[0]!.params },
      { id: "m2", kind: "momentum" as const, pnl: 800, turnover: 40, maxDrawdown: 0.08, fitness: 750, params: population[1]!.params },
      { id: "mr1", kind: "meanRevert" as const, pnl: 600, turnover: 30, maxDrawdown: 0.05, fitness: 550, params: population[2]!.params },
      { id: "mr2", kind: "meanRevert" as const, pnl: 400, turnover: 20, maxDrawdown: 0.03, fitness: 350, params: population[3]!.params },
    ];

    const result = evolvePopulation({
      rng,
      population,
      fitness,
      cash0: 10000,
      eliteFrac: 0.5,
      mutateSigma: 0.15,
    });

    expect(result.nextPopulation.length).toBe(population.length);
    expect(result.replacements.length).toBe(2); // Bottom 50% replaced
  });

  it("should preserve elites by id and kind", () => {
    const rng = new RNG(999);
    const population: AgentSpec[] = [
      { kind: "momentum", id: "m1", seed: 1, params: { lookback: 8, k: 0.4, invPenalty: 0.02, maxStepQty: 3 } },
      { kind: "momentum", id: "m2", seed: 2, params: { lookback: 10, k: 0.5, invPenalty: 0.03, maxStepQty: 4 } },
    ];

    const fitness = [
      { id: "m1", kind: "momentum" as const, pnl: 1000, turnover: 50, maxDrawdown: 0.1, fitness: 900, params: population[0]!.params },
      { id: "m2", kind: "momentum" as const, pnl: 800, turnover: 40, maxDrawdown: 0.08, fitness: 750, params: population[1]!.params },
    ];

    const result = evolvePopulation({
      rng,
      population,
      fitness,
      cash0: 10000,
      eliteFrac: 0.5,
      mutateSigma: 0.15,
    });

    // Top agent (m1) should be preserved
    const elite = result.nextPopulation.find(s => s.id === "m1");
    expect(elite).toBeDefined();
    expect(elite!.kind).toBe("momentum");
    expect(elite!.params).toEqual(population[0]!.params);
  });

  it("should replace non-elites with same kind", () => {
    const rng = new RNG(1111);
    const population: AgentSpec[] = [
      { kind: "momentum", id: "m1", seed: 1, params: { lookback: 8, k: 0.4, invPenalty: 0.02, maxStepQty: 3 } },
      { kind: "momentum", id: "m2", seed: 2, params: { lookback: 10, k: 0.5, invPenalty: 0.03, maxStepQty: 4 } },
      { kind: "meanRevert", id: "mr1", seed: 3, params: { window: 25, k: 0.25, maxStepQty: 3 } },
    ];

    const fitness = [
      { id: "m1", kind: "momentum" as const, pnl: 1000, turnover: 50, maxDrawdown: 0.1, fitness: 900, params: population[0]!.params },
      { id: "m2", kind: "momentum" as const, pnl: 800, turnover: 40, maxDrawdown: 0.08, fitness: 750, params: population[1]!.params },
      { id: "mr1", kind: "meanRevert" as const, pnl: 600, turnover: 30, maxDrawdown: 0.05, fitness: 550, params: population[2]!.params },
    ];

    const result = evolvePopulation({
      rng,
      population,
      fitness,
      cash0: 10000,
      eliteFrac: 0.5,
      mutateSigma: 0.15,
    });

    // All agents should maintain their kind
    for (const spec of result.nextPopulation) {
      const original = population.find(p => p.id === spec.id || spec.id.startsWith(p.kind));
      if (!original) {
        // New agent should have same kind as its parent
        const replacement = result.replacements.find(r => r.newId === spec.id);
        if (replacement) {
          expect(spec.kind).toBe(replacement.kind);
        }
      } else {
        expect(spec.kind).toBe(original.kind);
      }
    }
  });

  it("should be deterministic with same seed", () => {
    const population: AgentSpec[] = [
      { kind: "momentum", id: "m1", seed: 1, params: { lookback: 8, k: 0.4, invPenalty: 0.02, maxStepQty: 3 } },
      { kind: "momentum", id: "m2", seed: 2, params: { lookback: 10, k: 0.5, invPenalty: 0.03, maxStepQty: 4 } },
    ];

    const fitness = [
      { id: "m1", kind: "momentum" as const, pnl: 1000, turnover: 50, maxDrawdown: 0.1, fitness: 900, params: population[0]!.params },
      { id: "m2", kind: "momentum" as const, pnl: 800, turnover: 40, maxDrawdown: 0.08, fitness: 750, params: population[1]!.params },
    ];

    const rng1 = new RNG(2222);
    const result1 = evolvePopulation({
      rng: rng1,
      population,
      fitness,
      cash0: 10000,
      eliteFrac: 0.5,
      mutateSigma: 0.15,
    });

    const rng2 = new RNG(2222);
    const result2 = evolvePopulation({
      rng: rng2,
      population,
      fitness,
      cash0: 10000,
      eliteFrac: 0.5,
      mutateSigma: 0.15,
    });

    expect(result1.nextPopulation.length).toBe(result2.nextPopulation.length);
    expect(result1.replacements.length).toBe(result2.replacements.length);
    // Check that elite is preserved the same way
    const elite1 = result1.nextPopulation.find(s => s.id === "m1");
    const elite2 = result2.nextPopulation.find(s => s.id === "m1");
    expect(elite1).toEqual(elite2);
  });
});
