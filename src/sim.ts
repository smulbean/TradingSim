import { DEFAULT_CONFIG } from "./config.js";
import { runSim } from "./runSim.js";
import { writeJson } from "./utils/write.js";
import { leaderboard } from "./metrics/equity.js";

function main() {
  const result = runSim(DEFAULT_CONFIG, "full");

  writeJson("out/run_log.json", {
    config: {
      market: DEFAULT_CONFIG.market,
      exchange: DEFAULT_CONFIG.exchange,
      constraints: DEFAULT_CONFIG.constraints,
      cash0: DEFAULT_CONFIG.cash0,
      T: DEFAULT_CONFIG.T,
      seed: DEFAULT_CONFIG.seed,
      evolution: DEFAULT_CONFIG.evolution,
    },
    steps: result.runLog!,
    evolutionEvents: result.evolutionEvents || [],
  });

  const finalSnaps = result.finalSnapshots;
  console.log("\nFinal Leaderboard:");
  console.table(
    leaderboard(finalSnaps, DEFAULT_CONFIG.cash0).map(r => ({
      agentId: r.agentId,
      pnl: r.pnl.toFixed(2),
      equity: r.equity.toFixed(2),
      turnover: r.turnover.toFixed(0),
      dd: r.maxDrawdownPct.toFixed(1) + "%",
    }))
  );

  // Regime breakdown
  console.log("\nPnL by Regime:");
  const regimeTable = Object.entries(result.pnlByRegime).map(([agentId, pnl]) => ({
    agentId,
    TREND: pnl.TREND.toFixed(2),
    MEANREV: pnl.MEANREV.toFixed(2),
    CHOP: pnl.CHOP.toFixed(2),
  }));
  console.table(regimeTable);

  console.log("Wrote out/run_log.json");
}

main();
