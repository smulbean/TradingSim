import { mean } from "../utils/stats.js";
import type { Regime } from "../market/regimes.js";

export function aggregateRegimePnL(
  results: Array<Record<string, Record<Regime, number>>>
): Record<string, Record<Regime, number>> {
  const agentIds = new Set<string>();
  for (const r of results) {
    for (const agentId of Object.keys(r)) {
      agentIds.add(agentId);
    }
  }

  const aggregated: Record<string, Record<Regime, number>> = {};

  for (const agentId of agentIds) {
    const trendPnls = results.map(r => (r[agentId]?.TREND ?? 0));
    const meanRevPnls = results.map(r => (r[agentId]?.MEANREV ?? 0));
    const chopPnls = results.map(r => (r[agentId]?.CHOP ?? 0));

    aggregated[agentId] = {
      TREND: mean(trendPnls),
      MEANREV: mean(meanRevPnls),
      CHOP: mean(chopPnls),
    };
  }

  return aggregated;
}
