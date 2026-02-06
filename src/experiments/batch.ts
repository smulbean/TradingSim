import { runSim } from "../runSim.js";
import type { SimConfig } from "../config.js";
import { DEFAULT_CONFIG } from "../config.js";
import { writeJson } from "../utils/write.js";
import { mean, std } from "../utils/stats.js";
import { aggregateRegimePnL } from "./aggregate.js";
import type { Regime } from "../market/regimes.js";

export type BatchSummary = {
  config: {
    baseConfig: SimConfig;
    n: number;
    seeds: number[];
  };
  agents: Record<
    string,
    {
      pnl: { mean: number; std: number };
      maxDrawdownMean: number;
      turnoverMean: number;
      pnlByRegimeMean: Record<Regime, number>;
    }
  >;
};

export async function runBatch(params?: {
  seeds?: number[];
  n?: number;
  baseConfig?: SimConfig;
}): Promise<BatchSummary> {
  const baseConfig = params?.baseConfig ?? DEFAULT_CONFIG;
  const n = params?.n ?? 20;
  const seeds = params?.seeds ?? Array.from({ length: n }, (_, i) => baseConfig.seed + i);

  console.log(`Running batch: ${seeds.length} seeds...`);

  const finalPnls: Array<Record<string, number>> = [];
  const maxDrawdowns: Array<Record<string, number>> = [];
  const turnovers: Array<Record<string, number>> = [];
  const pnlByRegimes: Array<Record<string, Record<Regime, number>>> = [];

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]!;
    const cfgSeeded = { ...baseConfig, seed };
    const result = runSim(cfgSeeded, "summary");

    const pnl: Record<string, number> = {};
    const dd: Record<string, number> = {};
    const turn: Record<string, number> = {};

    for (const snap of result.finalSnapshots) {
      pnl[snap.agentId] = snap.equity - baseConfig.cash0;
      dd[snap.agentId] = snap.maxDrawdown;
      turn[snap.agentId] = snap.turnover;
    }

    finalPnls.push(pnl);
    maxDrawdowns.push(dd);
    turnovers.push(turn);
    pnlByRegimes.push(result.pnlByRegime);

    if ((i + 1) % 5 === 0) {
      console.log(`  Completed ${i + 1}/${seeds.length} runs...`);
    }
  }

  // Aggregate
  const agentIds = new Set<string>();
  for (const pnl of finalPnls) {
    for (const agentId of Object.keys(pnl)) {
      agentIds.add(agentId);
    }
  }

  const agents: BatchSummary["agents"] = {};

  for (const agentId of agentIds) {
    const pnls = finalPnls.map(r => r[agentId] ?? 0);
    const dds = maxDrawdowns.map(r => r[agentId] ?? 0);
    const turns = turnovers.map(r => r[agentId] ?? 0);

    agents[agentId] = {
      pnl: {
        mean: mean(pnls),
        std: std(pnls),
      },
      maxDrawdownMean: mean(dds),
      turnoverMean: mean(turns),
      pnlByRegimeMean: aggregateRegimePnL(pnlByRegimes)[agentId] ?? { TREND: 0, MEANREV: 0, CHOP: 0 },
    };
  }

  const summary: BatchSummary = {
    config: {
      baseConfig,
      n: seeds.length,
      seeds,
    },
    agents,
  };

  writeJson("out/batch_summary.json", summary);

  // Print ranking table
  const ranking = Object.entries(agents)
    .map(([agentId, stats]) => ({
      agentId,
      meanPnL: stats.pnl.mean.toFixed(2),
      stdPnL: stats.pnl.std.toFixed(2),
      sharpe: (stats.pnl.mean / Math.max(stats.pnl.std, 1e-9)).toFixed(2),
      maxDD: (100 * stats.maxDrawdownMean).toFixed(1) + "%",
      turnover: stats.turnoverMean.toFixed(0),
    }))
    .sort((a, b) => parseFloat(b.meanPnL) - parseFloat(a.meanPnL));

  console.log("\n=== Batch Summary ===");
  console.log(`Runs: ${seeds.length}`);
  console.table(ranking);

  return summary;
}
