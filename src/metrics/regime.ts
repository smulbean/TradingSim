import type { Regime } from "../market/regimes.js";

export type RegimePnL = Record<string, Record<Regime, number>>;

export function regimePnl(params: {
  steps: Array<{
    regime: string;
    snapshots: Array<{ agentId: string; equity: number }>;
  }>;
}): RegimePnL {
  const result: RegimePnL = {};

  // Initialize all agents and regimes to 0
  const allAgentIds = new Set<string>();
  for (const step of params.steps) {
    for (const snap of step.snapshots) {
      allAgentIds.add(snap.agentId);
    }
  }

  for (const agentId of allAgentIds) {
    result[agentId] = { TREND: 0, MEANREV: 0, CHOP: 0 };
  }

  // Process each step transition
  for (let i = 1; i < params.steps.length; i++) {
    const prevStep = params.steps[i - 1]!;
    const currStep = params.steps[i]!;
    const regime = currStep.regime as Regime;

    // Create maps for quick lookup
    const prevEquity = new Map<string, number>();
    for (const snap of prevStep.snapshots) {
      prevEquity.set(snap.agentId, snap.equity);
    }

    // Compute deltas for current step
    for (const snap of currStep.snapshots) {
      const prevEq = prevEquity.get(snap.agentId) ?? snap.equity;
      const delta = snap.equity - prevEq;
      if (!result[snap.agentId]) {
        result[snap.agentId] = { TREND: 0, MEANREV: 0, CHOP: 0 };
      }
      result[snap.agentId]![regime] += delta;
    }
  }

  return result;
}
