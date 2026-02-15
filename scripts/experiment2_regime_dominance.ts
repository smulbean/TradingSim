#!/usr/bin/env -S node
/*
Experiment 2 — Market Dynamics Dominance (schema-compatible)
===========================================================

You don't have explicit regime weights/transition matrices.
Instead, we construct three "worlds" by setting market parameters:

- TREND:    higher trendDrift, low meanRevertK, lower noise
- MEANREV:  high meanRevertK, trendDrift ~ 0, lower noise, anchor matters
- CHOP:     trendDrift ~ 0, meanRevertK ~ 0, high noise

Run:
  npx tsx scripts/experiment2_market_dominance.ts

Outputs:
  outputs/experiment2/
    market_dominance.json
    market_dominance.csv
*/

import fs from "fs/promises";
import path from "path";
import { DEFAULT_CONFIG } from "../src/config.ts";
import { sanitizeConfigOverride, mergeConfig } from "../src/configSchema.ts";
import { runSim } from "../src/runSim.ts";

const OUTPUT_DIR = path.join(process.cwd(), "outputs", "experiment2");

type World = "TREND" | "MEANREV" | "CHOP";

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function mean(xs: number[]) {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]) {
  if (xs.length <= 1) return 0;
  const m = mean(xs);
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function se(xs: number[]) {
  if (xs.length === 0) return NaN;
  return std(xs) / Math.sqrt(xs.length);
}

/**
 * Sharpe-like metric:
 * use equity deltas (step PnL increments), scaled by sqrt(N).
 */
function sharpeLikeFromEquity(eqs: number[]) {
  if (eqs.length <= 2) return NaN;
  const deltas: number[] = [];
  for (let i = 1; i < eqs.length; i++) deltas.push(eqs[i] - eqs[i - 1]);
  const m = mean(deltas);
  const s = std(deltas);
  if (s === 0) return NaN;
  return (m / s) * Math.sqrt(deltas.length);
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/**
 * Construct world-specific market overrides using keys that actually exist:
 * [startFair, startPrice, switchProb, trendDrift, meanRevertK, anchor, fairNoiseStd, microNoiseStd]
 *
 * Notes:
 * - We keep switchProb small; since you don't have explicit regimes, switchProb
 *   likely controls some internal switching behavior. To keep experiments stable,
 *   we set it to a low number by default in all worlds.
 * - You can tune these numbers later; the point is clean separation.
 */
function marketOverridesFor(world: World) {
  const base = {
    // keep low to reduce hidden switching confounds (you can also set to 0)
    switchProb: 0.0025,
  } as any;

  if (world === "TREND") {
    return {
      ...base,
      trendDrift: 0.02,        // stronger persistent drift
      meanRevertK: 0.02,       // weak pull-back
      fairNoiseStd: 0.02,      // smoother fair value
      microNoiseStd: 0.02,     // less microstructure noise
      // anchor left as default; not central in trend
    };
  }

  if (world === "MEANREV") {
    return {
      ...base,
      trendDrift: 0.0,         // no drift
      meanRevertK: 0.25,       // strong pull-back to anchor
      fairNoiseStd: 0.02,      // smoother fair value
      microNoiseStd: 0.02,
      // keep anchor meaningful; if your config uses a numeric anchor, leave default
      // or set anchor = startFair; we keep default unless you prefer explicit:
      // anchor: (DEFAULT_CONFIG as any).market?.startFair ?? 0,
    };
  }

  // CHOP
  return {
    ...base,
    trendDrift: 0.0,
    meanRevertK: 0.0,
    fairNoiseStd: 0.10,        // fair value jumps around more
    microNoiseStd: 0.10,       // observed price is noisy / choppy
  };
}

async function runWorld(world: World, seeds: number[], baseOverride: any) {
  console.log(`\n=== Running world: ${world} ===`);

  const perSeed: any[] = [];
  const worldMarket = marketOverridesFor(world);

  for (const s of seeds) {
    const override = deepClone(baseOverride);
    override.seed = s;
    override.market = { ...(override.market || {}), ...worldMarket };

    const cfgMerged = mergeConfig(DEFAULT_CONFIG, sanitizeConfigOverride(override));
    const sim = runSim(cfgMerged, "full");

    // equity time series per agent
    const equitySeries: Record<string, number[]> = {};
    for (const step of sim.runLog || []) {
      for (const snap of step.snapshots || []) {
        (equitySeries[snap.agentId] ||= []).push(snap.equity);
      }
    }

    // final per-agent metrics
    const perAgent: Record<string, any> = {};
    for (const fsnap of sim.finalSnapshots) {
      const id = fsnap.agentId;
      const eqs = equitySeries[id] || [fsnap.equity];

      perAgent[id] = {
        pnl: fsnap.equity - cfgMerged.cash0,
        sharpeLike: sharpeLikeFromEquity(eqs),
        turnover: fsnap.turnover,
        maxDrawdownPct: 100 * fsnap.maxDrawdown,
      };
    }

    perSeed.push({ seed: s, agents: perAgent });
  }

  // aggregate per agent
  const agentIds = new Set<string>();
  for (const ps of perSeed) for (const aid of Object.keys(ps.agents)) agentIds.add(aid);

  const aggregated: Record<string, any> = {};
  for (const aid of agentIds) {
    const sharps: number[] = [];
    const pnls: number[] = [];
    const turns: number[] = [];
    const mdds: number[] = [];

    for (const ps of perSeed) {
      const a = ps.agents[aid];
      if (!a) continue;
      if (!Number.isNaN(a.sharpeLike)) sharps.push(a.sharpeLike);
      pnls.push(a.pnl);
      turns.push(a.turnover);
      mdds.push(a.maxDrawdownPct);
    }

    aggregated[aid] = {
      meanSharpeLike: mean(sharps),
      ci95SharpeLike: 1.96 * se(sharps),
      meanPnl: mean(pnls),
      ci95Pnl: 1.96 * se(pnls),
      meanTurnover: mean(turns),
      ci95Turnover: 1.96 * se(turns),
      meanMaxDrawdownPct: mean(mdds),
    };
  }

  return {
    world,
    worldMarket,
    seeds: seeds.length,
    perSeed,
    aggregated,
  };
}

async function writeCsv(allWorlds: any[]) {
  const rows: string[] = [];
  rows.push(
    [
      "world",
      "agentId",
      "meanSharpeLike",
      "ci95SharpeLike",
      "meanPnl",
      "ci95Pnl",
      "meanTurnover",
      "ci95Turnover",
      "meanMaxDrawdownPct",
      "trendDrift",
      "meanRevertK",
      "fairNoiseStd",
      "microNoiseStd",
      "switchProb",
    ].join(",")
  );

  for (const w of allWorlds) {
    const m = w.worldMarket || {};
    for (const aid of Object.keys(w.aggregated)) {
      const a = w.aggregated[aid];
      rows.push(
        [
          w.world,
          aid,
          a.meanSharpeLike ?? "",
          a.ci95SharpeLike ?? "",
          a.meanPnl ?? "",
          a.ci95Pnl ?? "",
          a.meanTurnover ?? "",
          a.ci95Turnover ?? "",
          a.meanMaxDrawdownPct ?? "",
          m.trendDrift ?? "",
          m.meanRevertK ?? "",
          m.fairNoiseStd ?? "",
          m.microNoiseStd ?? "",
          m.switchProb ?? "",
        ].join(",")
      );
    }
  }

  await fs.writeFile(path.join(OUTPUT_DIR, "market_dominance.csv"), rows.join("\n"), "utf8");
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  // Controls (keep consistent with Experiment 1)
  const T = 5000;
  const impact = 0.0005;
  const hitProb = 0.15;
  const evolution = { enabled: false };

  // For regime/dynamics dominance, it's cleaner to set friction = 0
  // so you isolate environment effects.
  const feePerUnit = 0;
  const slippagePerUnit = 0;

  const baseOverride = {
    T,
    exchange: { impact, hitProb, feePerUnit, slippagePerUnit },
    evolution,
  } as any;

  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  const worlds: World[] = ["TREND", "MEANREV", "CHOP"];
  const outputs: any[] = [];
  for (const w of worlds) {
    outputs.push(await runWorld(w, seeds, baseOverride));
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, "market_dominance.json"),
    JSON.stringify(
      {
        meta: {
          experiment: "experiment2_market_dominance",
          note:
            "Worlds are constructed by tuning market parameters (trendDrift/meanRevertK/noise) because the market schema has no explicit regime probabilities.",
          controls: { T, impact, hitProb, feePerUnit, slippagePerUnit, evolution },
        },
        data: outputs,
      },
      null,
      2
    ),
    "utf8"
  );

  await writeCsv(outputs);

  console.log("\n✅ Experiment 2 complete.");
  console.log("Outputs written to:", OUTPUT_DIR);
}

main().catch((err) => {
  console.error("❌ Experiment 2 failed:", err);
  process.exit(1);
});
