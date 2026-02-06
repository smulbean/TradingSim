#!/usr/bin/env node
// Wrapper script to run simulator from Next.js API
console.error("[Wrapper] Starting wrapper script");
console.error("[Wrapper] CWD:", process.cwd());
console.error("[Wrapper] Args:", process.argv);

import { runSim } from "../../dist/runSim.js";
import { DEFAULT_CONFIG } from "../../dist/config.js";
import { sanitizeConfigOverride, mergeConfig } from "../../dist/configSchema.js";
import { leaderboard } from "../../dist/metrics/equity.js";

console.error("[Wrapper] Imports successful");

// Read config from stdin
console.error("[Wrapper] Reading input from stdin...");
const input = JSON.parse(await new Promise((resolve) => {
  let data = "";
  process.stdin.on("data", (chunk) => {
    data += chunk;
  });
  process.stdin.on("end", () => {
    resolve(data);
  });
}));

console.error("[Wrapper] Input received, length:", JSON.stringify(input).length);
const { override = {}, mode = "summary", stride = 5 } = input;
console.error("[Wrapper] Parsed:", { mode, stride, overrideKeys: Object.keys(override) });

// Sanitize and merge config
console.error("[Wrapper] Sanitizing config override...");
const sanitized = sanitizeConfigOverride(override);
console.error("[Wrapper] Merging config...");
const cfg = mergeConfig(DEFAULT_CONFIG, sanitized);
console.error("[Wrapper] Config merged, seed:", cfg.seed, "T:", cfg.T);

// Run simulation
console.error("[Wrapper] Running simulation, mode:", mode === "full" ? "full" : "summary");
const result = runSim(cfg, mode === "full" ? "full" : "summary");
console.error("[Wrapper] Simulation complete, runLog length:", result.runLog?.length || 0);

// Prepare response data
const response = {
  meta: result.meta,
  finalLeaderboard: leaderboard(result.finalSnapshots, cfg.cash0),
  pnlByRegime: result.pnlByRegime,
};

// If full mode, downsample runLog for charts
if (mode === "full" && result.runLog) {
  const times = [];
  const price = [];
  const regime = [];
  const equityByAgent = {};
  const posByAgent = {};

  // Initialize agent arrays
  for (const snap of result.finalSnapshots) {
    equityByAgent[snap.agentId] = [];
    posByAgent[snap.agentId] = [];
  }

  // Downsample steps
  for (let i = 0; i < result.runLog.length; i += stride) {
    const step = result.runLog[i];
    times.push(step.t);
    price.push(step.price);
    regime.push(step.regime);

    for (const snap of step.snapshots || []) {
      if (equityByAgent[snap.agentId]) {
        equityByAgent[snap.agentId].push(snap.equity);
        posByAgent[snap.agentId].push(snap.pos);
      }
    }
  }

  response.times = times;
  response.price = price;
  response.regime = regime;
  response.equityByAgent = equityByAgent;
  response.posByAgent = posByAgent;
} else {
  response.times = [];
  response.price = [];
  response.regime = [];
  response.equityByAgent = {};
  response.posByAgent = {};
}

// Evolution events summary
if (result.evolutionEvents && result.evolutionEvents.length > 0) {
  response.evolutionEventsSummary = result.evolutionEvents.map((evt) => ({
    t: evt.t,
    topFitnessAgentId: evt.ranking[0]?.id || "",
    replacementsCount: evt.replacements.length,
  }));
} else {
  response.evolutionEventsSummary = [];
}

// Output JSON to stdout
console.error("[Wrapper] Preparing response, finalLeaderboard length:", response.finalLeaderboard?.length || 0);
console.error("[Wrapper] Response keys:", Object.keys(response));
const responseJson = JSON.stringify(response);
console.error("[Wrapper] Response JSON length:", responseJson.length);
console.log(responseJson);
console.error("[Wrapper] Response sent to stdout");
