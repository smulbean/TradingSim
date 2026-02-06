export type SimConfig = {
  seed: number;
  T: number;
  cash0: number;

  market: {
    startFair: number;
    startPrice: number;
    switchProb: number;
    trendDrift: number;
    meanRevertK: number;
    anchor: number;
    fairNoiseStd: number;
    microNoiseStd: number;
  };

  exchange: {
    feePerUnit: number;
    slippagePerUnit: number;
    impact: number;
    hitProb: number;
  };

  constraints: {
    positionLimit: number;
    maxLeverage: number;
  };

  agents: {
    noise: { count: number; qtyScale?: number };
    momentum: { lookback: number; k: number; invPenalty: number; maxStepQty: number };
    meanRevert: { window: number; k: number; maxStepQty: number };
    marketMaker: {
      baseSpread: number;
      volWindow: number;
      volMultiplier: number;
      invSkew: number;
      size: number;
    };
  };

  evolution?: {
    enabled: boolean;
    interval: number;
    eliteFrac: number;
    mutateSigma: number;
    fitness: {
      turnoverPenalty: number;
      drawdownPenalty: number;
    };
  };
};

export const DEFAULT_CONFIG: SimConfig = {
  seed: 42,
  T: 5000,
  cash0: 10_000,
  market: {
    startFair: 100,
    startPrice: 100,
    switchProb: 0.01,
    trendDrift: 0.03,
    meanRevertK: 0.02,
    anchor: 100,
    fairNoiseStd: 0.1,
    microNoiseStd: 0.25,
  },
  exchange: {
    feePerUnit: 0.01,
    slippagePerUnit: 0.01,
    impact: 0.0005,
    hitProb: 0.15,
  },
  constraints: {
    positionLimit: 30,
    maxLeverage: 4.0,
  },
  agents: {
    noise: { count: 3 },
    momentum: { lookback: 8, k: 0.4, invPenalty: 0.02, maxStepQty: 3 },
    meanRevert: { window: 25, k: 0.25, maxStepQty: 3 },
    marketMaker: { baseSpread: 0.1, volWindow: 30, volMultiplier: 0.5, invSkew: 0.02, size: 2 },
  },
  evolution: {
    enabled: false,
    interval: 1000,
    eliteFrac: 0.5,
    mutateSigma: 0.15,
    fitness: {
      turnoverPenalty: 0.05,
      drawdownPenalty: 2000,
    },
  },
};
