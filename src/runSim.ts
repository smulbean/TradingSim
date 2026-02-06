import { Market } from "./market/market.js";
import type { MarketConfig } from "./market/market.js";
import { Exchange } from "./exchange/exchange.js";
import { clampOrderQty } from "./exchange/constraints.js";
import type { Agent, AgentSnapshot, Order, Fill } from "./agents/agent.js";
import { MarketMakerAgent } from "./agents/marketMaker.js";
import { simulateMakerFill } from "./exchange/makerFlow.js";
import { RNG } from "./market/rng.js";
import type { SimConfig } from "./config.js";
import type { Regime } from "./market/regimes.js";
import type { AgentSpec } from "./agents/factory.js";
import { makeAgent } from "./agents/factory.js";
import { computeFitness, evolvePopulation } from "./evolution/evolve.js";
import type { FitnessRow } from "./evolution/evolve.js";

export type RunMode = "full" | "summary";

export type RunResult = {
  finalSnapshots: AgentSnapshot[];
  pnlByRegime: Record<string, Record<Regime, number>>;
  meta: { steps: number; seed: number };
  runLog: any[] | undefined;
  evolutionEvents?: Array<{
    t: number;
    ranking: FitnessRow[];
    replacements: Array<{ oldId: string; newId: string; kind: string; newParams: Record<string, number> }>;
  }> | undefined;
};

export function runSim(cfg: SimConfig, mode: RunMode): RunResult {
  const marketCfg: MarketConfig = {
    seed: cfg.seed,
    startFair: cfg.market.startFair,
    startPrice: cfg.market.startPrice,
    switchProb: cfg.market.switchProb,
    trendDrift: cfg.market.trendDrift,
    meanRevertK: cfg.market.meanRevertK,
    anchor: cfg.market.anchor,
    fairNoiseStd: cfg.market.fairNoiseStd,
    microNoiseStd: cfg.market.microNoiseStd,
  };

  const market = new Market(marketCfg);
  const exchange = new Exchange({
    feePerUnit: cfg.exchange.feePerUnit,
    slippagePerUnit: cfg.exchange.slippagePerUnit,
    impact: cfg.exchange.impact,
  });
  const flowRng = new RNG(cfg.seed + 9999);
  const evolutionRng = cfg.evolution?.enabled ? new RNG(cfg.seed + 12345) : null;

  // Build initial population specs
  const populationSpecs: AgentSpec[] = [];

  // Noise agents
  for (let i = 0; i < cfg.agents.noise.count; i++) {
    populationSpecs.push({
      kind: "noise",
      id: `noise-${i + 1}`,
      seed: 1001 + i,
      params: {},
    });
  }

  // Momentum agent
  populationSpecs.push({
    kind: "momentum",
    id: "momentum-1",
    seed: 2001,
    params: {
      lookback: cfg.agents.momentum.lookback,
      k: cfg.agents.momentum.k,
      invPenalty: cfg.agents.momentum.invPenalty,
      maxStepQty: cfg.agents.momentum.maxStepQty,
    },
  });

  // Mean revert agent
  populationSpecs.push({
    kind: "meanRevert",
    id: "meanrev-1",
    seed: 3001,
    params: {
      window: cfg.agents.meanRevert.window,
      k: cfg.agents.meanRevert.k,
      maxStepQty: cfg.agents.meanRevert.maxStepQty,
    },
  });

  // Market maker agent
  populationSpecs.push({
    kind: "marketMaker",
    id: "marketmaker-1",
    seed: 4001,
    params: {
      baseSpread: cfg.agents.marketMaker.baseSpread,
      volWindow: cfg.agents.marketMaker.volWindow,
      volMultiplier: cfg.agents.marketMaker.volMultiplier,
      invSkew: cfg.agents.marketMaker.invSkew,
      size: cfg.agents.marketMaker.size,
    },
  });

  // Create agents from specs
  let agents: Agent[] = populationSpecs.map(spec => makeAgent(spec, cfg.cash0));

  const runLog: any[] = [];
  const evolutionEvents: Array<{
    t: number;
    ranking: FitnessRow[];
    replacements: Array<{ oldId: string; newId: string; kind: string; newParams: Record<string, number> }>;
  }> = [];
  let lastPrice = cfg.market.startPrice;

  // For summary mode: track previous equities for regime PnL
  const prevEquity: Record<string, number> = {};
  const regimePnLAccum: Record<string, Record<Regime, number>> = {};

  // Initialize regime PnL accumulators
  for (const agent of agents) {
    regimePnLAccum[agent.id] = { TREND: 0, MEANREV: 0, CHOP: 0 };
    prevEquity[agent.id] = cfg.cash0;
  }

  for (let i = 0; i < cfg.T; i++) {
    const step = market.step();
    const price = step.price;
    const regime = step.regime;

    // Collect raw orders
    const rawOrders: Order[] = [];
    for (const a of agents) {
      rawOrders.push(...a.observe({ t: step.t, price }));
    }

    // Clamp orders using constraints
    const clamped: Order[] = rawOrders
      .map(o => {
        const agent = agents.find(x => x.id === o.agentId)!;
        const snap = agent.snapshot(lastPrice);
        const qty = clampOrderQty({
          qty: o.qty,
          pos: snap.pos,
          price,
          equity: snap.equity,
          constraints: cfg.constraints,
        });
        return { agentId: o.agentId, qty };
      })
      .filter(o => o.qty !== 0);

    // Clear exchange (fills & updated mid)
    const { midAfter, fills } = exchange.clear(clamped, price);

    // Apply taker fills
    for (const f of fills) {
      const a = agents.find(x => x.id === f.agentId)!;
      a.onFill(f);
    }

    // Market maker quotes and fills
    const makerAgent = agents.find(a => (a as any).kind === "marketMaker") as MarketMakerAgent | undefined;
    const allFills = mode === "full" ? [...fills] : [];
    if (makerAgent) {
      const quote = makerAgent.quote({ t: step.t, price: midAfter }, midAfter);
      if (quote) {
        const makerFillsRaw = simulateMakerFill({
          rng: flowRng,
          quote,
          hitProb: cfg.exchange.hitProb,
          feePerUnit: exchange.cfg.feePerUnit,
        });

        // Clamp maker fills before applying
        for (const f of makerFillsRaw) {
          const makerSnap = makerAgent.snapshot(midAfter);
          const clampedQty = clampOrderQty({
            qty: f.qty,
            pos: makerSnap.pos,
            price: f.price,
            equity: makerSnap.equity,
            constraints: cfg.constraints,
          });

          if (clampedQty !== 0) {
            const clampedFill: Fill = {
              agentId: f.agentId,
              qty: clampedQty,
              price: f.price,
              fee: Math.abs(clampedQty) * exchange.cfg.feePerUnit,
            };
            makerAgent.onFill(clampedFill);
            if (mode === "full") {
              allFills.push(clampedFill);
            }
          }
        }
      }
    }

    // Mark to market
    for (const a of agents) a.markToMarket(midAfter);

    const snapshots: AgentSnapshot[] = agents.map(a => a.snapshot(midAfter));

    // Compute regime PnL incrementally (for both modes)
    if (i > 0) {
      for (const snap of snapshots) {
        const delta = snap.equity - prevEquity[snap.agentId]!;
        regimePnLAccum[snap.agentId]![regime] += delta;
        prevEquity[snap.agentId] = snap.equity;
      }
    } else {
      // First step: initialize prevEquity
      for (const snap of snapshots) {
        prevEquity[snap.agentId] = snap.equity;
      }
    }

    if (mode === "full") {
      runLog.push({
        t: step.t,
        regime: step.regime,
        fair: step.fair,
        price,
        midAfter,
        fairReturn: step.fairReturn,
        priceReturn: step.priceReturn,
        fills: allFills,
        snapshots,
      });
    }

    // Evolution step
    if (cfg.evolution?.enabled && evolutionRng && step.t > 0 && step.t % cfg.evolution.interval === 0) {
      const snapshots = agents.map(a => a.snapshot(midAfter));
      const rows = agents.map(a => ({
        id: a.id,
        kind: (a as any).kind,
        params: (a as any).params || {},
      }));

      const fitness = computeFitness({
        snapshots,
        cash0: cfg.cash0,
        rows,
        turnoverPenalty: cfg.evolution.fitness.turnoverPenalty,
        drawdownPenalty: cfg.evolution.fitness.drawdownPenalty,
      });

      const { nextPopulation, replacements } = evolvePopulation({
        rng: evolutionRng,
        population: populationSpecs,
        fitness,
        cash0: cfg.cash0,
        eliteFrac: cfg.evolution.eliteFrac,
        mutateSigma: cfg.evolution.mutateSigma,
      });

      // Build map of elite IDs to their current agent state
      const eliteIds = new Set(fitness.slice(0, Math.max(1, Math.floor(agents.length * cfg.evolution.eliteFrac))).map(f => f.id));
      const eliteAgentsMap = new Map<string, Agent>();
      for (const agent of agents) {
        if (eliteIds.has(agent.id)) {
          eliteAgentsMap.set(agent.id, agent);
        }
      }

      // Replace agents: keep elites, create new ones for replaced
      const newAgents: Agent[] = [];
      const agentIdToIndex = new Map<string, number>();
      for (let i = 0; i < nextPopulation.length; i++) {
        const spec = nextPopulation[i]!;
        agentIdToIndex.set(spec.id, i);

        if (eliteIds.has(spec.id)) {
          // Keep existing elite agent (preserve cash/pos/history)
          const existingAgent = eliteAgentsMap.get(spec.id);
          if (existingAgent) {
            newAgents.push(existingAgent);
          } else {
            // Shouldn't happen, but fallback
            newAgents.push(makeAgent(spec, cfg.cash0));
          }
        } else {
          // Create new agent (reset to cash0, pos=0)
          newAgents.push(makeAgent(spec, cfg.cash0));
        }
      }

      agents = newAgents;
      populationSpecs.length = 0;
      populationSpecs.push(...nextPopulation);

      // Update regime PnL tracking for new agents
      for (const agent of agents) {
        if (!regimePnLAccum[agent.id]) {
          regimePnLAccum[agent.id] = { TREND: 0, MEANREV: 0, CHOP: 0 };
        }
        if (prevEquity[agent.id] === undefined) {
          prevEquity[agent.id] = cfg.cash0;
        }
      }

      // Log evolution event
      if (mode === "full") {
        evolutionEvents.push({
          t: step.t,
          ranking: fitness,
          replacements,
        });
      }
    }

    lastPrice = midAfter;
  }

  const finalSnaps = agents.map(a => a.snapshot(lastPrice));

  return {
    finalSnapshots: finalSnaps,
    pnlByRegime: regimePnLAccum,
    meta: { steps: cfg.T, seed: cfg.seed },
    runLog: mode === "full" ? runLog : undefined,
    evolutionEvents: cfg.evolution?.enabled && mode === "full" ? evolutionEvents : undefined,
  };
}
