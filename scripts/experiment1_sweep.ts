#!/usr/bin/env -S node
/*
Experiment 1 — Transaction Cost Phase Transition
================================================

Sweeps friction parameters in *dollars per unit* (NOT percent):
- feePerUnit:      fee = |qty| * feePerUnit
- slippagePerUnit: fillPrice = midAfter + sign * slippagePerUnit

Outputs JSON + CSV under: outputs/experiment1/

Run:
  npx tsx scripts/experiment1_sweep.ts
*/

import fs from "fs/promises";
import path from "path";
import { DEFAULT_CONFIG } from "../src/config.ts";
import { sanitizeConfigOverride, mergeConfig } from "../src/configSchema.ts";
import { runSim } from "../src/runSim.ts";

type SweepKind = "fee" | "slippage" | "combined";

const OUTPUT_DIR = path.join(process.cwd(), "outputs", "experiment1");

// ------------------------- utils -------------------------

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
 * Sharpe-like metric for sims:
 * - use step PnL increments (equity deltas) rather than % returns
 * - scale by sqrt(N) where N is number of increments, so it's comparable across same-T runs
 */
function sharpeLikeFromEquity(eqs: number[]) {
  if (eqs.length <= 2) return NaN;
  const deltas: number[] = [];
  for (let i = 1; i < eqs.length; i++) deltas.push(eqs[i] - eqs[i - 1]);

  const m = mean(deltas);
  const s = std(deltas);
  if (s === 0) return NaN;

  // scale by sqrt(number of steps) (episode-level Sharpe-like)
  return (m / s) * Math.sqrt(deltas.length);
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

// ------------------------- core run -------------------------

async function runSweep(kind: SweepKind, values: number[], seeds: number[], baseOverride: any) {
  const results: Array<any> = [];

  for (const v of values) {
    console.log(`Running sweep kind=${kind} value=$${v.toFixed(4)} for ${seeds.length} seeds`);

    const perSeed: Array<any> = [];

    for (const s of seeds) {
      const override = deepClone(baseOverride);

      override.exchange = override.exchange || {};
      if (kind === "fee") {
        override.exchange.feePerUnit = v;
        override.exchange.slippagePerUnit = 0;
      } else if (kind === "slippage") {
        override.exchange.feePerUnit = 0;
        override.exchange.slippagePerUnit = v;
      } else {
        override.exchange.feePerUnit = v;
        override.exchange.slippagePerUnit = v;
      }

      override.seed = s;

      // merge + sanitize once so we can use the actual cash0 used in the run
      const cfgMerged = mergeConfig(DEFAULT_CONFIG, sanitizeConfigOverride(override));
      const sim = runSim(cfgMerged, "full");

      // Build per-agent equity series from runLog
      const equitySeries: Record<string, number[]> = {};
      for (const step of sim.runLog || []) {
        for (const snap of step.snapshots || []) {
          (equitySeries[snap.agentId] ||= []).push(snap.equity);
        }
      }

      // Final per-agent metrics
      const final = sim.finalSnapshots;
      const perAgent: Record<string, any> = {};

      for (const fsnap of final) {
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

    // Aggregate across seeds per agent
    const agentIds = new Set<string>();
    for (const ps of perSeed) for (const aid of Object.keys(ps.agents)) agentIds.add(aid);

    const aggregated: Record<string, any> = {};
    for (const aid of agentIds) {
      const sharps: number[] = [];
      const pnls: number[] = [];
      const turnovers: number[] = [];
      const mdds: number[] = [];

      for (const ps of perSeed) {
        const a = ps.agents[aid];
        if (!a) continue;
        if (!Number.isNaN(a.sharpeLike)) sharps.push(a.sharpeLike);
        pnls.push(a.pnl);
        turnovers.push(a.turnover);
        mdds.push(a.maxDrawdownPct);
      }

      aggregated[aid] = {
        meanSharpeLike: mean(sharps),
        seSharpeLike: se(sharps),
        ci95SharpeLike: 1.96 * se(sharps),

        meanPnl: mean(pnls),
        sePnl: se(pnls),
        ci95Pnl: 1.96 * se(pnls),

        meanTurnover: mean(turnovers),
        seTurnover: se(turnovers),
        ci95Turnover: 1.96 * se(turnovers),

        meanMaxDrawdownPct: mean(mdds),

        // mechanism proxy: friction × turnover (using v as the swept friction magnitude)
        // For combined, total per-unit friction is (fee+slippage) = 2v; for single sweeps it's v.
        meanCostDragProxy:
          mean(turnovers) *
          (kind === "combined" ? 2 * v : v),
      };
    }

    results.push({
      units: "dollars_per_unit",
      kind,
      value: v,
      seeds: seeds.length,
      perSeed,
      aggregated,
    });
  }

  return results;
}

// ------------------------- csv writer -------------------------

async function writeCsv(filename: string, sweepRes: any[]) {
  const rows: string[] = [];
  rows.push(
    [
      "kind",
      "value_dollars_per_unit",
      "agentId",
      "meanSharpeLike",
      "ci95SharpeLike",
      "meanPnl",
      "ci95Pnl",
      "meanTurnover",
      "ci95Turnover",
      "meanMaxDrawdownPct",
      "meanCostDragProxy",
    ].join(",")
  );

  for (const r of sweepRes) {
    for (const aid of Object.keys(r.aggregated)) {
      const a = r.aggregated[aid];
      rows.push(
        [
          r.kind,
          r.value,
          aid,
          a.meanSharpeLike ?? "",
          a.ci95SharpeLike ?? "",
          a.meanPnl ?? "",
          a.ci95Pnl ?? "",
          a.meanTurnover ?? "",
          a.ci95Turnover ?? "",
          a.meanMaxDrawdownPct ?? "",
          a.meanCostDragProxy ?? "",
        ].join(",")
      );
    }
  }

  await fs.writeFile(path.join(OUTPUT_DIR, filename), rows.join("\n"), "utf8");
}

// ------------------------- main -------------------------

async function main() {
  await ensureDir(OUTPUT_DIR);

  // Match your UI controls / baseline
  const T = 5000;
  const switchProb = 0.01;  // 1%
  const impact = 0.0005;
  const hitProb = 0.15;
  const evolution = { enabled: false };

  const baseOverride = {
    T,
    market: { switchProb },
    exchange: { impact, hitProb },
    evolution,
  } as any;

  // IMPORTANT: These are *dollars per unit*, clamped to [0,1] by configSchema.
  // This grid is designed to bracket the phase transition.
  const values = [0, 0.001, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2];

  // 30 seeds is a solid default for CIs
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  // A) Fee-only
  const feeResults = await runSweep("fee", values, seeds, baseOverride);
  await fs.writeFile(
    path.join(OUTPUT_DIR, "sweep_fee.json"),
    JSON.stringify({ meta: { experiment: "experiment1", kind: "fee", units: "dollars_per_unit" }, data: feeResults }, null, 2),
    "utf8"
  );
  await writeCsv("sweep_fee.csv", feeResults);

  // B) Slippage-only
  const slipResults = await runSweep("slippage", values, seeds, baseOverride);
  await fs.writeFile(
    path.join(OUTPUT_DIR, "sweep_slippage.json"),
    JSON.stringify({ meta: { experiment: "experiment1", kind: "slippage", units: "dollars_per_unit" }, data: slipResults }, null, 2),
    "utf8"
  );
  await writeCsv("sweep_slippage.csv", slipResults);

  // C) Combined (fee = slippage)
  const combinedResults = await runSweep("combined", values, seeds, baseOverride);
  await fs.writeFile(
    path.join(OUTPUT_DIR, "sweep_combined.json"),
    JSON.stringify({ meta: { experiment: "experiment1", kind: "combined", units: "dollars_per_unit" }, data: combinedResults }, null, 2),
    "utf8"
  );
  await writeCsv("sweep_combined.csv", combinedResults);

  console.log("✅ Experiment 1 complete.");
  console.log("Outputs written to:", OUTPUT_DIR);
}

main().catch((err) => {
  console.error("❌ Experiment 1 failed:", err);
  process.exit(1);
});
