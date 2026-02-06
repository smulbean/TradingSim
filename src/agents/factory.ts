import { RNG } from "../market/rng.js";
import type { Agent } from "./agent.js";
import { NoiseAgent } from "./noise.js";
import { MomentumAgent } from "./momentum.js";
import { MeanRevertAgent } from "./meanRevert.js";
import { MarketMakerAgent } from "./marketMaker.js";

export type AgentKind = "noise" | "momentum" | "meanRevert" | "marketMaker";

export type AgentSpec = {
  kind: AgentKind;
  id: string;
  seed: number;
  params: Record<string, number>;
};

export function makeAgent(spec: AgentSpec, cash0: number): Agent {
  switch (spec.kind) {
    case "noise": {
      const agent = new NoiseAgent({
        id: spec.id,
        seed: spec.seed,
        cash0,
      });
      // Add kind and params fields
      (agent as any).kind = "noise" as const;
      (agent as any).params = spec.params;
      return agent;
    }
    case "momentum": {
      const agent = new MomentumAgent({
        id: spec.id,
        seed: spec.seed,
        cash0,
        lookback: spec.params.lookback!,
        k: spec.params.k!,
        invPenalty: spec.params.invPenalty!,
        maxStepQty: spec.params.maxStepQty!,
      });
      (agent as any).kind = "momentum" as const;
      (agent as any).params = spec.params;
      return agent;
    }
    case "meanRevert": {
      const agent = new MeanRevertAgent({
        id: spec.id,
        seed: spec.seed,
        cash0,
        window: spec.params.window!,
        k: spec.params.k!,
        maxStepQty: spec.params.maxStepQty!,
      });
      (agent as any).kind = "meanRevert" as const;
      (agent as any).params = spec.params;
      return agent;
    }
    case "marketMaker": {
      const agent = new MarketMakerAgent({
        id: spec.id,
        seed: spec.seed,
        cash0,
        baseSpread: spec.params.baseSpread!,
        volWindow: spec.params.volWindow!,
        volMultiplier: spec.params.volMultiplier!,
        invSkew: spec.params.invSkew!,
        size: spec.params.size!,
      });
      (agent as any).kind = "marketMaker" as const;
      (agent as any).params = spec.params;
      return agent;
    }
    default:
      throw new Error(`Unknown agent kind: ${(spec as any).kind}`);
  }
}
