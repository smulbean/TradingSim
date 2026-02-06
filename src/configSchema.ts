import type { SimConfig } from "./config.js";

/**
 * Deep merge utility for config objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || ({} as any), source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }
  
  return result;
}

/**
 * Clamp a number between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sanitize and validate config override from UI
 * Returns a safe Partial<SimConfig> that can be merged with DEFAULT_CONFIG
 */
export function sanitizeConfigOverride(input: unknown): Partial<SimConfig> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const obj = input as Record<string, any>;
  const sanitized: Partial<SimConfig> = {};

  // Seed
  if (typeof obj.seed === "number" && Number.isInteger(obj.seed) && obj.seed >= 0) {
    sanitized.seed = obj.seed;
  }

  // T (steps) - clamp to reasonable range
  if (typeof obj.T === "number" && Number.isInteger(obj.T) && obj.T > 0) {
    sanitized.T = clamp(obj.T, 1, 20000);
  }

  // Cash0
  if (typeof obj.cash0 === "number" && obj.cash0 > 0) {
    sanitized.cash0 = clamp(obj.cash0, 100, 1000000);
  }

  // Market config
  if (obj.market && typeof obj.market === "object") {
    const marketConfig: any = {};
    const market = obj.market as Record<string, any>;

    if (typeof market.startFair === "number" && market.startFair > 0) {
      marketConfig.startFair = clamp(market.startFair, 1, 10000);
    }
    if (typeof market.startPrice === "number" && market.startPrice > 0) {
      marketConfig.startPrice = clamp(market.startPrice, 1, 10000);
    }
    if (typeof market.switchProb === "number") {
      marketConfig.switchProb = clamp(market.switchProb, 0, 1);
    }
    if (typeof market.trendDrift === "number") {
      marketConfig.trendDrift = clamp(market.trendDrift, -1, 1);
    }
    if (typeof market.meanRevertK === "number" && market.meanRevertK >= 0) {
      marketConfig.meanRevertK = clamp(market.meanRevertK, 0, 1);
    }
    if (typeof market.anchor === "number" && market.anchor > 0) {
      marketConfig.anchor = clamp(market.anchor, 1, 10000);
    }
    if (typeof market.fairNoiseStd === "number" && market.fairNoiseStd >= 0) {
      marketConfig.fairNoiseStd = clamp(market.fairNoiseStd, 0, 10);
    }
    if (typeof market.microNoiseStd === "number" && market.microNoiseStd >= 0) {
      marketConfig.microNoiseStd = clamp(market.microNoiseStd, 0, 10);
    }
    
    if (Object.keys(marketConfig).length > 0) {
      sanitized.market = marketConfig;
    }
  }

  // Exchange config
  if (obj.exchange && typeof obj.exchange === "object") {
    const exchangeConfig: any = {};
    const exchange = obj.exchange as Record<string, any>;

    if (typeof exchange.feePerUnit === "number" && exchange.feePerUnit >= 0) {
      exchangeConfig.feePerUnit = clamp(exchange.feePerUnit, 0, 1);
    }
    if (typeof exchange.slippagePerUnit === "number" && exchange.slippagePerUnit >= 0) {
      exchangeConfig.slippagePerUnit = clamp(exchange.slippagePerUnit, 0, 1);
    }
    if (typeof exchange.impact === "number" && exchange.impact >= 0) {
      exchangeConfig.impact = clamp(exchange.impact, 0, 0.01);
    }
    if (typeof exchange.hitProb === "number") {
      exchangeConfig.hitProb = clamp(exchange.hitProb, 0, 1);
    }
    
    if (Object.keys(exchangeConfig).length > 0) {
      sanitized.exchange = exchangeConfig;
    }
  }

  // Evolution config
  if (obj.evolution && typeof obj.evolution === "object") {
    sanitized.evolution = {} as any;
    const evolution = obj.evolution as Record<string, any>;

    const evolutionConfig: any = {};
    
    if (typeof evolution.enabled === "boolean") {
      evolutionConfig.enabled = evolution.enabled;
    }
    if (typeof evolution.interval === "number" && Number.isInteger(evolution.interval) && evolution.interval > 0) {
      evolutionConfig.interval = clamp(evolution.interval, 10, 10000);
    }
    if (typeof evolution.eliteFrac === "number") {
      evolutionConfig.eliteFrac = clamp(evolution.eliteFrac, 0.1, 0.9);
    }
    if (typeof evolution.mutateSigma === "number" && evolution.mutateSigma >= 0) {
      evolutionConfig.mutateSigma = clamp(evolution.mutateSigma, 0, 1);
    }
    if (evolution.fitness && typeof evolution.fitness === "object") {
      const fitness = evolution.fitness as Record<string, any>;
      evolutionConfig.fitness = {
        turnoverPenalty: typeof fitness.turnoverPenalty === "number"
          ? clamp(fitness.turnoverPenalty, 0, 1)
          : undefined,
        drawdownPenalty: typeof fitness.drawdownPenalty === "number"
          ? clamp(fitness.drawdownPenalty, 0, 100000)
          : undefined,
      };
    }
    
    if (Object.keys(evolutionConfig).length > 0) {
      sanitized.evolution = evolutionConfig;
    }
  }

  return sanitized;
}

/**
 * Merge DEFAULT_CONFIG with sanitized override
 */
export function mergeConfig(defaultConfig: SimConfig, override: Partial<SimConfig>): SimConfig {
  return deepMerge(defaultConfig, override);
}
