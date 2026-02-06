// Semantic color system for quant research dashboard

export const REGIME_COLORS = {
  TREND: "#22c55e",      // green
  MEANREV: "#f59e0b",    // orange
  CHOP: "#ef4444",       // red
} as const;

export const REGIME_BG_COLORS = {
  TREND: "#dcfce7",      // light green
  MEANREV: "#fed7aa",    // light orange
  CHOP: "#fee2e2",       // light red
} as const;

export const AGENT_COLORS: Record<string, string> = {
  "noise-1": "#3b82f6",      // blue
  "noise-2": "#10b981",      // green
  "noise-3": "#f59e0b",      // orange
  "momentum-1": "#ef4444",  // red
  "meanrev-1": "#8b5cf6",    // purple
  "marketmaker-1": "#ec4899", // pink
};

export function getAgentColor(agentId: string): string {
  return AGENT_COLORS[agentId] || "#6b7280"; // default gray
}

export function getRegimeColor(regime: string): string {
  return REGIME_COLORS[regime as keyof typeof REGIME_COLORS] || "#9ca3af";
}

export function getRegimeBgColor(regime: string): string {
  return REGIME_BG_COLORS[regime as keyof typeof REGIME_BG_COLORS] || "#f3f4f6";
}
