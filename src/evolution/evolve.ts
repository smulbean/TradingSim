import { RNG } from "../market/rng.js";
import type { AgentSnapshot } from "../agents/agent.js";
import type { AgentKind, AgentSpec } from "../agents/factory.js";

export type FitnessRow = {
  id: string;
  kind: AgentKind;
  pnl: number;
  turnover: number;
  maxDrawdown: number;
  fitness: number;
  params: Record<string, number>;
};

export function computeFitness(params: {
  snapshots: AgentSnapshot[];
  cash0: number;
  rows: Array<{ id: string; kind: AgentKind; params: Record<string, number> }>;
  turnoverPenalty: number;
  drawdownPenalty: number;
}): FitnessRow[] {
  const { snapshots, cash0, rows, turnoverPenalty, drawdownPenalty } = params;

  const fitnessRows: FitnessRow[] = rows.map(row => {
    const snap = snapshots.find(s => s.agentId === row.id);
    if (!snap) {
      throw new Error(`Snapshot not found for agent ${row.id}`);
    }

    const pnl = snap.equity - cash0;
    const fitness = pnl - turnoverPenalty * snap.turnover - drawdownPenalty * snap.maxDrawdown;

    return {
      id: row.id,
      kind: row.kind,
      pnl,
      turnover: snap.turnover,
      maxDrawdown: snap.maxDrawdown,
      fitness,
      params: row.params,
    };
  });

  // Sort by fitness descending
  fitnessRows.sort((a, b) => b.fitness - a.fitness);

  return fitnessRows;
}

export function mutateParams(
  rng: RNG,
  params: Record<string, number>,
  sigma: number,
  bounds?: Record<string, { min: number; max: number }>
): Record<string, number> {
  const mutated: Record<string, number> = {};

  for (const [key, value] of Object.entries(params)) {
    // Multiplicative mutation: newVal = oldVal * exp(N(0, sigma))
    const noise = rng.nextGaussian(0, sigma);
    let newVal = value * Math.exp(noise);

    // Apply bounds if provided
    if (bounds && bounds[key]) {
      newVal = Math.max(bounds[key]!.min, Math.min(bounds[key]!.max, newVal));
    }

    mutated[key] = newVal;
  }

  return mutated;
}

// Parameter bounds for each agent type
export const PARAM_BOUNDS: Record<AgentKind, Record<string, { min: number; max: number }>> = {
  noise: {},
  momentum: {
    lookback: { min: 2, max: 50 },
    k: { min: 0.01, max: 5 },
    invPenalty: { min: 0, max: 0.2 },
    maxStepQty: { min: 1, max: 10 },
  },
  meanRevert: {
    window: { min: 5, max: 100 },
    k: { min: 0.01, max: 5 },
    maxStepQty: { min: 1, max: 10 },
  },
  marketMaker: {
    baseSpread: { min: 0.01, max: 1.0 },
    volWindow: { min: 5, max: 200 },
    volMultiplier: { min: 0.0, max: 5.0 },
    invSkew: { min: 0.0, max: 0.2 },
    size: { min: 1, max: 10 },
  },
};

// Integer parameter keys (should be rounded after mutation)
export const INTEGER_PARAMS: Record<AgentKind, string[]> = {
  noise: [],
  momentum: ["lookback", "maxStepQty"],
  meanRevert: ["window", "maxStepQty"],
  marketMaker: ["volWindow", "size"],
};

export function evolvePopulation(args: {
  rng: RNG;
  population: AgentSpec[];
  fitness: FitnessRow[];
  cash0: number;
  eliteFrac: number;
  mutateSigma: number;
}): {
  nextPopulation: AgentSpec[];
  replacements: Array<{ oldId: string; newId: string; kind: AgentKind; newParams: Record<string, number> }>;
} {
  const { rng, population, fitness, eliteFrac, mutateSigma } = args;

  const n = population.length;
  const eliteCount = Math.max(1, Math.floor(n * eliteFrac));

  // Get elite agents (top eliteCount by fitness)
  const elites = fitness.slice(0, eliteCount);
  const eliteIds = new Set(elites.map(e => e.id));

  const nextPopulation: AgentSpec[] = [];
  const replacements: Array<{ oldId: string; newId: string; kind: AgentKind; newParams: Record<string, number> }> = [];

  // Track generation for new IDs
  let gen = 0;
  const existingGens = new Set<number>();
  for (const spec of population) {
    const match = spec.id.match(/-(\d+)$/);
    if (match) {
      existingGens.add(parseInt(match[1]!, 10));
    }
  }
  while (existingGens.has(gen)) {
    gen++;
  }

  for (let i = 0; i < n; i++) {
    const currentSpec = population[i]!;
    const currentId = currentSpec.id;

    if (eliteIds.has(currentId)) {
      // Keep elite as-is
      nextPopulation.push(currentSpec);
    } else {
      // Replace non-elite: clone and mutate from a random elite
      const parentElite = elites[Math.floor(rng.nextFloat() * elites.length)]!;
      const parentKind = parentElite.kind;

      // Mutate params
      const bounds = PARAM_BOUNDS[parentKind];
      let mutatedParams = mutateParams(rng, parentElite.params, mutateSigma, bounds);

      // Round integer parameters
      const intParams = INTEGER_PARAMS[parentKind];
      for (const key of intParams) {
        if (mutatedParams[key] !== undefined) {
          mutatedParams[key] = Math.round(mutatedParams[key]!);
          // Re-clamp after rounding
          if (bounds && bounds[key]) {
            mutatedParams[key] = Math.max(
              bounds[key]!.min,
              Math.min(bounds[key]!.max, mutatedParams[key]!)
            );
          }
        }
      }

      // Generate new ID deterministically
      const newSeed = Math.floor(rng.nextFloat() * 1e9);
      const newId = `${parentKind}-${gen}-${i}`;

      const newSpec: AgentSpec = {
        kind: parentKind,
        id: newId,
        seed: newSeed,
        params: mutatedParams,
      };

      nextPopulation.push(newSpec);
      replacements.push({
        oldId: currentId,
        newId,
        kind: parentKind,
        newParams: mutatedParams,
      });
    }
  }

  return { nextPopulation, replacements };
}
