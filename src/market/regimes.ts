// src/market/regimes.ts
export type Regime = "TREND" | "MEANREV" | "CHOP";

export const ALL_REGIMES: Regime[] = ["TREND", "MEANREV", "CHOP"];

export function pickRegime(r: number): Regime {
  // r in [0,1)
  if (r < 1 / 3) return "TREND";
  if (r < 2 / 3) return "MEANREV";
  return "CHOP";
}
