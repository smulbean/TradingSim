// Helper to build consistent time series data for Recharts

export interface ChartDataInput {
  times: number[];
  price: number[];
  regime: string[];
  equityByAgent: Record<string, number[]>;
  posByAgent: Record<string, number[]>;
}

export interface TimeSeriesPoint {
  t: number;
  price?: number;
  regime?: string;
  [agentId: string]: number | string | undefined;
}

/**
 * Build time series data with consistent structure for all agents.
 * Carries forward last known value if missing.
 */
export function buildTimeSeries(
  input: ChartDataInput,
  stride: number = 1
): {
  priceData: Array<{ t: number; price: number; regime: string }>;
  equityData: TimeSeriesPoint[];
  posData: TimeSeriesPoint[];
  regimeSegments: Array<{ start: number; end: number; regime: string }>;
  priceDomain: [number, number];
} {
  const { times, price, regime, equityByAgent, posByAgent } = input;

  if (times.length === 0) {
    return {
      priceData: [],
      equityData: [],
      posData: [],
      regimeSegments: [],
      priceDomain: [0, 100],
    };
  }

  // Downsample indices
  const indices: number[] = [];
  for (let i = 0; i < times.length; i += stride) {
    indices.push(i);
  }
  // Always include last index
  if (indices[indices.length - 1] !== times.length - 1) {
    indices.push(times.length - 1);
  }

  // Build price data
  const priceData = indices.map((i) => ({
    t: times[i],
    price: price[i] ?? 0,
    regime: regime[i] ?? "CHOP",
  }));

  // Calculate price domain
  const validPrices = price.filter((p) => p !== undefined && p !== null && !isNaN(p));
  if (validPrices.length === 0) {
    return {
      priceData,
      equityData: [],
      posData: [],
      regimeSegments: [],
      priceDomain: [0, 100],
    };
  }
  const minPrice = Math.min(...validPrices);
  const maxPrice = Math.max(...validPrices);
  const priceRange = maxPrice - minPrice;
  const priceDomain: [number, number] = [
    minPrice - priceRange * 0.05,
    maxPrice + priceRange * 0.05,
  ];

  // Group regime segments
  const regimeSegments: Array<{ start: number; end: number; regime: string }> = [];
  let currentRegime = regime[0] || "CHOP";
  let segmentStart = times[0] || 0;

  for (let i = 1; i < times.length; i++) {
    if (regime[i] !== currentRegime) {
      regimeSegments.push({
        start: segmentStart,
        end: times[i - 1],
        regime: currentRegime,
      });
      currentRegime = regime[i];
      segmentStart = times[i];
    }
  }
  regimeSegments.push({
    start: segmentStart,
    end: times[times.length - 1],
    regime: currentRegime,
  });

  // Get all agent IDs
  const allAgentIds = new Set<string>();
  Object.keys(equityByAgent).forEach((id) => allAgentIds.add(id));
  Object.keys(posByAgent).forEach((id) => allAgentIds.add(id));

  // Build equity and position data with carry-forward
  const equityData: TimeSeriesPoint[] = [];
  const posData: TimeSeriesPoint[] = [];

  // Track last known values for each agent
  const lastEquity: Record<string, number> = {};
  const lastPos: Record<string, number> = {};

  for (const idx of indices) {
    const t = times[idx];

    // Build equity point
    const equityPoint: TimeSeriesPoint = { t };
    for (const agentId of allAgentIds) {
      const equityArray = equityByAgent[agentId];
      if (equityArray && equityArray[idx] !== undefined && equityArray[idx] !== null) {
        lastEquity[agentId] = equityArray[idx];
        equityPoint[agentId] = equityArray[idx];
      } else if (lastEquity[agentId] !== undefined) {
        // Carry forward last value
        equityPoint[agentId] = lastEquity[agentId];
      }
      // If no value and no last value, leave undefined (will be filtered)
    }
    equityData.push(equityPoint);

    // Build position point
    const posPoint: TimeSeriesPoint = { t };
    for (const agentId of allAgentIds) {
      const posArray = posByAgent[agentId];
      if (posArray && posArray[idx] !== undefined && posArray[idx] !== null) {
        lastPos[agentId] = posArray[idx];
        posPoint[agentId] = posArray[idx];
      } else if (lastPos[agentId] !== undefined) {
        // Carry forward last value
        posPoint[agentId] = lastPos[agentId];
      }
    }
    posData.push(posPoint);
  }

  return {
    priceData,
    equityData,
    posData,
    regimeSegments,
    priceDomain,
  };
}
