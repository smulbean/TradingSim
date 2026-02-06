import type { AgentSnapshot } from "../agents/agent.js";

export function leaderboard(snaps: AgentSnapshot[], cash0: number) {
  const rows = snaps.map(s => ({
    agentId: s.agentId,
    pnl: s.equity - cash0,
    equity: s.equity,
    pos: s.pos,
    turnover: s.turnover,
    maxDrawdownPct: 100 * s.maxDrawdown,
  }));

  rows.sort((a, b) => b.equity - a.equity);
  return rows;
}
