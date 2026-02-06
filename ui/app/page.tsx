"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";
import {
  REGIME_COLORS,
  REGIME_BG_COLORS,
  AGENT_COLORS,
  getAgentColor,
  getRegimeColor,
  getRegimeBgColor,
} from "../src/lib/colors";
import { buildTimeSeries } from "../src/lib/chartData";
// Type definitions (simplified for UI)
type SimConfig = {
  seed?: number;
  T?: number;
  cash0?: number;
  market?: {
    switchProb?: number;
    trendDrift?: number;
    meanRevertK?: number;
    anchor?: number;
    fairNoiseStd?: number;
    microNoiseStd?: number;
  };
  exchange?: {
    feePerUnit?: number;
    slippagePerUnit?: number;
    impact?: number;
    hitProb?: number;
  };
  evolution?: {
    enabled?: boolean;
    interval?: number;
    eliteFrac?: number;
    mutateSigma?: number;
    fitness?: {
      turnoverPenalty?: number;
      drawdownPenalty?: number;
    };
  };
};

type SimulationResult = {
  meta: { steps: number; seed: number };
  times: number[];
  price: number[];
  regime: string[];
  equityByAgent: Record<string, number[]>;
  posByAgent: Record<string, number[]>;
  finalLeaderboard: Array<{
    agentId: string;
    pnl: number;
    equity: number;
    pos: number;
    turnover: number;
    maxDrawdownPct: number;
  }>;
  pnlByRegime: Record<string, { TREND: number; MEANREV: number; CHOP: number }>;
  evolutionEventsSummary: Array<{
    t: number;
    topFitnessAgentId: string;
    replacementsCount: number;
  }>;
};

const PRESETS = {
  balanced: {
    seed: 42,
    T: 5000,
    market: { switchProb: 0.01 },
    exchange: { feePerUnit: 0.01, slippagePerUnit: 0.01, impact: 0.0005, hitProb: 0.15 },
    evolution: { enabled: false },
  },
  trendHeavy: {
    seed: 42,
    T: 5000,
    market: { switchProb: 0.005 },
    exchange: { feePerUnit: 0.01, slippagePerUnit: 0.01, impact: 0.0005, hitProb: 0.15 },
    evolution: { enabled: false },
  },
  meanRevHeavy: {
    seed: 42,
    T: 5000,
    market: { switchProb: 0.02 },
    exchange: { feePerUnit: 0.01, slippagePerUnit: 0.01, impact: 0.0005, hitProb: 0.15 },
    evolution: { enabled: false },
  },
  highCost: {
    seed: 42,
    T: 5000,
    market: { switchProb: 0.01 },
    exchange: { feePerUnit: 0.05, slippagePerUnit: 0.05, impact: 0.002, hitProb: 0.15 },
    evolution: { enabled: false },
  },
  evoOn: {
    seed: 42,
    T: 5000,
    market: { switchProb: 0.01 },
    exchange: { feePerUnit: 0.01, slippagePerUnit: 0.01, impact: 0.0005, hitProb: 0.15 },
    evolution: { enabled: true, interval: 1000, eliteFrac: 0.5, mutateSigma: 0.15 },
  },
};

export default function Dashboard() {
  console.log("[Dashboard] Component rendering");
  
  const [config, setConfig] = useState<Partial<SimConfig>>({
    seed: 42,
    T: 5000,
    market: { switchProb: 0.01 },
    exchange: { feePerUnit: 0.01, slippagePerUnit: 0.01, impact: 0.0005, hitProb: 0.15 },
    evolution: { enabled: false, interval: 1000, eliteFrac: 0.5, mutateSigma: 0.15 },
  });
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [normalizeEquity, setNormalizeEquity] = useState(false);
  const [visibleEquityAgents, setVisibleEquityAgents] = useState<Set<string>>(new Set());
  const [visiblePosAgents, setVisiblePosAgents] = useState<Set<string>>(new Set());
  
  // Update visible agents when result changes (separate for equity and position charts)
  useEffect(() => {
    if (result) {
      // Get agent IDs from equity data
      const equityAgentIds = Object.keys(result.equityByAgent || {});
      // Default: show momentum-1, meanrev-1, marketmaker-1, noise-1
      const defaultEquityVisible = equityAgentIds.filter(id => 
        id === "momentum-1" || id === "meanrev-1" || id === "marketmaker-1" || id === "noise-1"
      );
      setVisibleEquityAgents(new Set(defaultEquityVisible.length > 0 ? defaultEquityVisible : equityAgentIds));
      
      // Get agent IDs from position data
      const posAgentIds = Object.keys(result.posByAgent || {});
      // Default: show momentum-1, meanrev-1, marketmaker-1, noise-1
      const defaultPosVisible = posAgentIds.filter(id => 
        id === "momentum-1" || id === "meanrev-1" || id === "marketmaker-1" || id === "noise-1"
      );
      setVisiblePosAgents(new Set(defaultPosVisible.length > 0 ? defaultPosVisible : posAgentIds));
    }
  }, [result]);

  useEffect(() => {
    console.log("[Dashboard] useEffect: Loading default config");
    // Load default config
    fetch("/api/config")
      .then((res) => {
        console.log("[Dashboard] Config API response status:", res.status);
        return res.json();
      })
      .then((data) => {
        console.log("[Dashboard] Config loaded:", data);
        setConfig({
          seed: data.seed,
          T: data.T,
          market: { switchProb: data.market.switchProb },
          exchange: {
            feePerUnit: data.exchange.feePerUnit,
            slippagePerUnit: data.exchange.slippagePerUnit,
            impact: data.exchange.impact,
            hitProb: data.exchange.hitProb,
          },
          evolution: data.evolution || { enabled: false },
        });
      })
      .catch((err) => {
        console.error("[Dashboard] Failed to load config:", err);
        // Don't set error state for config load failure, just use defaults
      });
    
    // Global error handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[Dashboard] Unhandled promise rejection:", event.reason);
      if (event.reason?.message?.includes("out of memory") || event.reason?.message?.includes("clone")) {
        setError("Response too large. Try running in 'summary' mode or reduce simulation steps.");
        setLoading(false);
      }
    };
    
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  const runSimulation = async (mode: "summary" | "full") => {
    console.log("[Dashboard] runSimulation called, mode:", mode, "current loading:", loading);
    
    // Prevent multiple simultaneous runs
    if (loading) {
      console.log("[Dashboard] Already loading, ignoring request");
      return;
    }
    
    // Cancel any existing request
    if (abortController) {
      abortController.abort();
    }
    
    // Create new abort controller
    const newAbortController = new AbortController();
    setAbortController(newAbortController);
    
    setLoading(true);
    setError(null);
    setResult(null); // Clear previous result
    
    try {
      console.log("[Dashboard] Running simulation with config:", config, "mode:", mode);
      
      // Increase stride for full mode to reduce data size (20 instead of 5)
      // This reduces data points from 5000 to 250 for T=5000, which is more manageable
      const stride = mode === "full" ? 20 : 5;
      console.log("[Dashboard] Using stride:", stride, "for mode:", mode);
      
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: config, mode, stride }),
        signal: newAbortController.signal,
      });

      console.log("[Dashboard] Response status:", response.status, response.ok);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const text = await response.text().catch(() => "");
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      console.log("[Dashboard] Parsing response JSON...");
      
      // Use response.json() but parse asynchronously to avoid blocking UI
      const parsedData: SimulationResult = await new Promise((resolve, reject) => {
        // Parse in next tick to yield to browser
        setTimeout(async () => {
          try {
            // Check if aborted
            if (newAbortController.signal.aborted) {
              reject(new Error("Request aborted"));
              return;
            }
            
            const data = await response.json() as SimulationResult;
            
            // Check if aborted after parsing
            if (newAbortController.signal.aborted) {
              reject(new Error("Request aborted"));
              return;
            }
            
            resolve(data);
          } catch (e: any) {
            reject(e);
          }
        }, 0);
      });
      
      console.log("[Dashboard] Simulation result received, keys:", Object.keys(parsedData));
      
      // Warn if response is very large (might cause memory issues)
      const sizeEstimate = JSON.stringify(parsedData).length;
      console.log("[Dashboard] Result size estimate:", sizeEstimate, "chars");
      
      if (sizeEstimate > 10_000_000) {
        console.warn("[Dashboard] Large response detected:", sizeEstimate, "chars. This may cause performance issues.");
        setError("Warning: Large response received. Rendering may be slow.");
      }
      
      // Set result asynchronously to avoid blocking
      setTimeout(() => {
        setResult(parsedData);
        setError(null); // Clear any previous errors
      }, 0);
    } catch (err: any) {
      // Don't set error if request was aborted
      if (err.name === "AbortError") {
        console.log("[Dashboard] Request aborted");
        return;
      }
      
      console.error("[Dashboard] Simulation error:", err);
      let errorMessage = err.message || "Failed to run simulation";
      
      // Handle specific error types
      if (errorMessage.includes("out of memory") || errorMessage.includes("Cannot clone")) {
        errorMessage = "Response too large. Try running in 'summary' mode instead of 'full' mode, or reduce the number of simulation steps (T).";
      } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      setError(errorMessage);
      setResult(null); // Clear result on error
    } finally {
      console.log("[Dashboard] Setting loading to false");
      // Use setTimeout to ensure state update happens even if there's an error
      setTimeout(() => {
        setLoading(false);
        setAbortController(null);
      }, 0);
    }
  };
  
  const cancelSimulation = () => {
    console.log("[Dashboard] Cancelling simulation");
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setLoading(false);
    setError("Simulation cancelled");
  };
  
  const clearError = () => {
    console.log("[Dashboard] Clearing error");
    setError(null);
  };
  
  const clearResult = () => {
    console.log("[Dashboard] Clearing result");
    setResult(null);
    setError(null);
  };

  const applyPreset = (presetName: keyof typeof PRESETS) => {
    console.log("[Dashboard] Applying preset:", presetName);
    setConfig(PRESETS[presetName]);
  };

  // Prepare chart data using useMemo to avoid recalculating on every render
  const chartData = React.useMemo(() => {
    console.log("[Dashboard] Preparing chart data, result:", result ? Object.keys(result) : "null");
    
    if (!result || !result.times || result.times.length === 0) {
      return {
        priceData: [],
        equityData: [],
        posData: [],
        regimeSegments: [],
        priceDomain: [0, 100] as [number, number],
      };
    }
    
    // Use stride based on data length to keep reasonable number of points
    const stride = result.times.length > 500 ? Math.ceil(result.times.length / 500) : 1;
    
    const built = buildTimeSeries(
      {
        times: result.times,
        price: result.price || [],
        regime: result.regime || [],
        equityByAgent: result.equityByAgent || {},
        posByAgent: result.posByAgent || {},
      },
      stride
    );
    
    console.log("[Dashboard] Price data length:", built.priceData.length);
    console.log("[Dashboard] Equity data length:", built.equityData.length);
    console.log("[Dashboard] Position data length:", built.posData.length);
    console.log("[Dashboard] Agent IDs in equity:", Object.keys(result.equityByAgent || {}));
    
    return built;
  }, [result]);
  
  const { priceData, equityData: rawEquityData, posData, regimeSegments, priceDomain } = chartData;
  
  // Normalize equity data if needed (do this once, not per-line)
  const equityData = React.useMemo(() => {
    if (!normalizeEquity || !result) {
      return rawEquityData;
    }
    const cash0 = config.cash0 || 10000;
    return rawEquityData.map((d: any) => {
      const normalized: any = { ...d };
      for (const agentId in result.equityByAgent) {
        if (d[agentId] !== undefined && d[agentId] !== null) {
          normalized[agentId] = (d[agentId] / cash0) * 10000;
        }
      }
      return normalized;
    });
  }, [rawEquityData, normalizeEquity, result, config.cash0]);
  
  // Format X-axis ticks (show ~10-12 ticks max)
  const formatXAxisTick = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  };
  
  // Format Y-axis ticks with multiples of 10 (100, 1000, 10k, 100k)
  const formatYAxisTick = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return value.toString();
    
    const absValue = Math.abs(numValue);
    if (absValue >= 100000) {
      const rounded = Math.round(numValue / 10000) * 10000;
      return `${(rounded / 1000).toFixed(0)}k`;
    } else if (absValue >= 10000) {
      const rounded = Math.round(numValue / 1000) * 1000;
      return `${(rounded / 1000).toFixed(0)}k`;
    } else if (absValue >= 1000) {
      const rounded = Math.round(numValue / 100) * 100;
      return `${(rounded / 1000).toFixed(1)}k`;
    } else if (absValue >= 100) {
      const rounded = Math.round(numValue / 10) * 10;
      return rounded.toString();
    } else if (absValue >= 10) {
      const rounded = Math.round(numValue);
      return rounded.toString();
    } else {
      return numValue.toFixed(1);
    }
  };
  
  // Calculate equity Y-axis domain (tight to data with padding)
  const equityDomain = React.useMemo(() => {
    if (!equityData || equityData.length === 0) {
      return undefined;
    }
    
    // Collect all equity values from visible equity agents
    const allValues: number[] = [];
    const visibleAgentArray = Array.from(visibleEquityAgents);
    for (const point of equityData) {
      for (const agentId of visibleAgentArray) {
        const value = point[agentId];
        if (value !== undefined && value !== null) {
          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
          if (!isNaN(numValue)) {
            allValues.push(numValue);
          }
        }
      }
    }
    
    if (allValues.length === 0) {
      return undefined;
    }
    
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    
    // Add 5% padding
    const padding = range * 0.05 || (maxValue * 0.05);
    return [minValue - padding, maxValue + padding];
  }, [equityData, visibleEquityAgents]);
  
  // Calculate position Y-axis domain (tight to data with padding, but include ±30 limits)
  const positionDomain = React.useMemo(() => {
    if (!posData || posData.length === 0) {
      return [-35, 35]; // Default to show limits
    }
    
    // Collect all position values from visible position agents
    const allValues: number[] = [];
    const visibleAgentArray = Array.from(visiblePosAgents);
    for (const point of posData) {
      for (const agentId of visibleAgentArray) {
        const value = point[agentId];
        if (value !== undefined && value !== null) {
          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
          if (!isNaN(numValue)) {
            allValues.push(numValue);
          }
        }
      }
    }
    
    // Always include ±30 limits
    const minValue = Math.min(...allValues, -30);
    const maxValue = Math.max(...allValues, 30);
    const range = maxValue - minValue;
    
    // Add 5% padding
    const padding = range * 0.05 || 5;
    return [minValue - padding, maxValue + padding];
  }, [posData, visiblePosAgents]);
  
  // Calculate summary stats
  const summaryStats = React.useMemo(() => {
    if (!result || !result.finalLeaderboard || result.finalLeaderboard.length === 0) {
      return null;
    }
    
    const sorted = [...result.finalLeaderboard].sort((a, b) => b.pnl - a.pnl);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const avgPnl = sorted.reduce((sum, a) => sum + a.pnl, 0) / sorted.length;
    
    return {
      totalSteps: result.meta.steps,
      bestAgent: best.agentId,
      bestPnl: best.pnl,
      worstAgent: worst.agentId,
      worstPnl: worst.pnl,
      avgPnl,
    };
  }, [result]);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui" }}>
      {/* Left Sidebar */}
      <div
        style={{
          width: "300px",
          padding: "20px",
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          backgroundColor: "#f9fafb",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Controls</h2>

        {/* Presets */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
            Presets
          </label>
          <select
            onChange={(e) => {
              const preset = e.target.value as keyof typeof PRESETS;
              console.log("[Dashboard] Preset selected:", preset);
              applyPreset(preset);
            }}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #d1d5db" }}
          >
            <option value="balanced">Balanced</option>
            <option value="trendHeavy">Trend-heavy</option>
            <option value="meanRevHeavy">MeanRev-heavy</option>
            <option value="highCost">High-cost</option>
            <option value="evoOn">Evolution On</option>
          </select>
        </div>

        {/* Seed */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>Seed</label>
          <input
            type="number"
            value={config.seed || 42}
            onChange={(e) => {
              const newSeed = parseInt(e.target.value) || 42;
              console.log("[Dashboard] Seed changed to:", newSeed);
              setConfig({ ...config, seed: newSeed });
            }}
            style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db" }}
          />
        </div>

        {/* Steps T */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>Steps (T)</label>
          <input
            type="number"
            value={config.T || 5000}
            onChange={(e) => setConfig({ ...config, T: parseInt(e.target.value) || 5000 })}
            style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db" }}
          />
        </div>

        {/* Market Parameters */}
        <h3 style={{ marginTop: "20px", marginBottom: "10px", fontSize: "16px" }}>Market</h3>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
            Switch Prob: {((config.market?.switchProb || 0) * 100).toFixed(2)}%
          </label>
          <input
            type="range"
            min="0"
            max="0.1"
            step="0.001"
            value={config.market?.switchProb || 0.01}
            onChange={(e) =>
              setConfig({
                ...config,
                market: { ...config.market, switchProb: parseFloat(e.target.value) },
              })
            }
            style={{ width: "100%" }}
          />
        </div>

        {/* Exchange Parameters */}
        <h3 style={{ marginTop: "20px", marginBottom: "10px", fontSize: "16px" }}>Exchange</h3>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
            Fee/Unit: {((config.exchange?.feePerUnit || 0) * 100).toFixed(2)}%
          </label>
          <input
            type="range"
            min="0"
            max="0.1"
            step="0.001"
            value={config.exchange?.feePerUnit || 0.01}
            onChange={(e) =>
              setConfig({
                ...config,
                exchange: { ...config.exchange, feePerUnit: parseFloat(e.target.value) },
              })
            }
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
            Slippage/Unit: {((config.exchange?.slippagePerUnit || 0) * 100).toFixed(2)}%
          </label>
          <input
            type="range"
            min="0"
            max="0.1"
            step="0.001"
            value={config.exchange?.slippagePerUnit || 0.01}
            onChange={(e) =>
              setConfig({
                ...config,
                exchange: { ...config.exchange, slippagePerUnit: parseFloat(e.target.value) },
              })
            }
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
            Impact: {(config.exchange?.impact || 0).toFixed(4)}
          </label>
          <input
            type="range"
            min="0"
            max="0.01"
            step="0.0001"
            value={config.exchange?.impact || 0.0005}
            onChange={(e) =>
              setConfig({
                ...config,
                exchange: { ...config.exchange, impact: parseFloat(e.target.value) },
              })
            }
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
            Hit Prob: {((config.exchange?.hitProb || 0) * 100).toFixed(1)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={config.exchange?.hitProb || 0.15}
            onChange={(e) =>
              setConfig({
                ...config,
                exchange: { ...config.exchange, hitProb: parseFloat(e.target.value) },
              })
            }
            style={{ width: "100%" }}
          />
        </div>

        {/* Evolution Parameters */}
        <h3 style={{ marginTop: "20px", marginBottom: "10px", fontSize: "16px" }}>Evolution</h3>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={config.evolution?.enabled || false}
              onChange={(e) =>
                setConfig({
                  ...config,
                  evolution: { ...config.evolution, enabled: e.target.checked } as any,
                })
              }
            />
            <span style={{ fontSize: "14px" }}>Enabled</span>
          </label>
        </div>
        {config.evolution?.enabled && (
          <>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                Interval: {config.evolution.interval || 1000}
              </label>
              <input
                type="number"
                min="10"
                max="10000"
                value={config.evolution.interval || 1000}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    evolution: { ...config.evolution, interval: parseInt(e.target.value) || 1000 } as any,
                  })
                }
                style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db" }}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                Elite Fraction: {((config.evolution.eliteFrac || 0.5) * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={config.evolution.eliteFrac || 0.5}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    evolution: { ...config.evolution, eliteFrac: parseFloat(e.target.value) } as any,
                  })
                }
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                Mutate Sigma: {(config.evolution.mutateSigma || 0.15).toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.evolution.mutateSigma || 0.15}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    evolution: { ...config.evolution, mutateSigma: parseFloat(e.target.value) } as any,
                  })
                }
                style={{ width: "100%" }}
              />
            </div>
          </>
        )}

        {/* Run Buttons */}
        <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("[Dashboard] Summary button clicked, loading:", loading);
              if (!loading) {
                runSimulation("summary");
              }
            }}
            disabled={loading}
            style={{
              padding: "10px",
              backgroundColor: loading ? "#9ca3af" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Running..." : "Run (Summary)"}
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("[Dashboard] Full button clicked, loading:", loading);
              if (!loading) {
                runSimulation("full");
              }
            }}
            disabled={loading}
            style={{
              padding: "10px",
              backgroundColor: loading ? "#9ca3af" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Running..." : "Run (Full)"}
          </button>
          {loading && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                cancelSimulation();
              }}
              style={{
                padding: "10px",
                backgroundColor: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "600",
                marginTop: "10px",
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {error && (
          <div
            style={{
              marginTop: "20px",
              padding: "10px",
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              borderRadius: "4px",
              fontSize: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{error}</span>
            <button
              onClick={clearError}
              style={{
                padding: "4px 8px",
                backgroundColor: "#991b1b",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              ✕
            </button>
          </div>
        )}
        
        {result && (
          <button
            onClick={clearResult}
            style={{
              marginTop: "10px",
              padding: "8px 16px",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Clear Results
          </button>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "20px", overflowY: "auto", backgroundColor: "#ffffff" }}>
        {/* Project Intro Section */}
        <div style={{ maxWidth: "1200px", margin: "0 auto", marginBottom: "40px", padding: "24px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <h1 style={{ marginTop: 0, marginBottom: "8px", fontSize: "32px", fontWeight: "700" }}>
            Adaptive Trading Game Lab
          </h1>
          <p style={{ fontSize: "18px", color: "#374151", marginBottom: "16px", fontWeight: "500" }}>
            A multi-agent strategy simulator where trading agents compete in a market with hidden structure (trend/mean-reversion/chop), under costs and position limits.
          </p>
          <ul style={{ margin: "16px 0", paddingLeft: "24px", color: "#4b5563", lineHeight: "1.8" }}>
            <li>Hidden fair value + regime switching market generator</li>
            <li>Multiple agent archetypes (momentum, mean reversion, market maker, noise)</li>
            <li>Inventory limits + transaction costs</li>
            <li>Metrics: PnL, turnover, drawdown, regime-conditioned performance</li>
            <li>Optional evolution: selection + parameter mutation over time</li>
          </ul>
          <p style={{ fontSize: "14px", color: "#6b7280", fontStyle: "italic", marginTop: "16px", marginBottom: 0 }}>
            This is a research sandbox for decision-making under uncertainty — not a real trading system.
          </p>
        </div>

        {!result && (
          <div style={{ textAlign: "center", marginTop: "100px", color: "#6b7280" }}>
            <p>Configure parameters and click "Run" to start a simulation</p>
          </div>
        )}

        {result && (
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "24px", fontWeight: "600" }}>
              Simulation Results
            </h2>
            <p style={{ color: "#6b7280", marginBottom: "40px", fontSize: "14px" }}>
              Steps: {result.meta.steps} | Seed: {result.meta.seed}
            </p>
            
            {/* Summary Cards */}
            {summaryStats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "40px" }}>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Total Steps</div>
                  <div style={{ fontSize: "20px", fontWeight: "600" }}>{summaryStats.totalSteps.toLocaleString()}</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Best Agent</div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: "#22c55e" }}>{summaryStats.bestAgent}</div>
                  <div style={{ fontSize: "14px", color: "#22c55e" }}>+{summaryStats.bestPnl.toFixed(2)}</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Worst Agent</div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: "#ef4444" }}>{summaryStats.worstAgent}</div>
                  <div style={{ fontSize: "14px", color: "#ef4444" }}>{summaryStats.worstPnl.toFixed(2)}</div>
                </div>
                <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Avg PnL</div>
                  <div style={{ fontSize: "20px", fontWeight: "600", color: summaryStats.avgPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                    {summaryStats.avgPnl >= 0 ? "+" : ""}{summaryStats.avgPnl.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Regime Explanation */}
            <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginTop: 0, marginBottom: "12px", color: "#0369a1" }}>
                What is a market regime?
              </h3>
              <p style={{ fontSize: "14px", color: "#075985", marginBottom: "12px", lineHeight: "1.6" }}>
                The market alternates between three regimes that describe price behavior:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "16px", height: "16px", backgroundColor: REGIME_COLORS.TREND, borderRadius: "2px" }} />
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#075985" }}>TREND:</span>
                  <span style={{ fontSize: "14px", color: "#075985" }}>Price tends to drift in one direction</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "16px", height: "16px", backgroundColor: REGIME_COLORS.MEANREV, borderRadius: "2px" }} />
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#075985" }}>MEANREV:</span>
                  <span style={{ fontSize: "14px", color: "#075985" }}>Price tends to pull back toward an anchor/value</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "16px", height: "16px", backgroundColor: REGIME_COLORS.CHOP, borderRadius: "2px" }} />
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#075985" }}>CHOP:</span>
                  <span style={{ fontSize: "14px", color: "#075985" }}>Noisy sideways movement with no clear direction</span>
                </div>
              </div>
            </div>

            {/* Regime Timeline */}
            {regimeSegments && regimeSegments.length > 0 && (
              <div style={{ marginBottom: "40px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px" }}>Regime Timeline</h3>
                <div style={{ position: "relative", height: "30px", border: "1px solid #e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
                  {regimeSegments.map((seg, i) => {
                    const totalRange = result.times[result.times.length - 1] - result.times[0];
                    const segRange = seg.end - seg.start;
                    const widthPercent = (segRange / totalRange) * 100;
                    return (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: `${((seg.start - result.times[0]) / totalRange) * 100}%`,
                          width: `${widthPercent}%`,
                          height: "100%",
                          backgroundColor: getRegimeColor(seg.regime),
                          cursor: "pointer",
                        }}
                        title={`t=${seg.start}-${seg.end}, regime=${seg.regime}`}
                      />
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "12px", height: "12px", backgroundColor: REGIME_COLORS.TREND, borderRadius: "2px" }} />
                    <span>Green = Trend</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "12px", height: "12px", backgroundColor: REGIME_COLORS.MEANREV, borderRadius: "2px" }} />
                    <span>Orange = Mean Reversion</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "12px", height: "12px", backgroundColor: REGIME_COLORS.CHOP, borderRadius: "2px" }} />
                    <span>Red = Chop</span>
                  </div>
                </div>
              </div>
            )}

            {/* Price Chart */}
            {priceData && priceData.length > 0 && (
              <div style={{ marginBottom: "40px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px" }}>Price Over Time</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={priceData} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                    <defs>
                      {regimeSegments.map((seg, i) => (
                        <linearGradient key={i} id={`regime-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={getRegimeBgColor(seg.regime)} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={getRegimeBgColor(seg.regime)} stopOpacity={0.1} />
                        </linearGradient>
                      ))}
                    </defs>
                    {regimeSegments.map((seg, i) => {
                      const totalRange = result.times[result.times.length - 1] - result.times[0];
                      const x1 = ((seg.start - result.times[0]) / totalRange) * 100;
                      const x2 = ((seg.end - result.times[0]) / totalRange) * 100;
                      return (
                        <ReferenceArea
                          key={i}
                          x1={seg.start}
                          x2={seg.end}
                          fill={getRegimeBgColor(seg.regime)}
                          fillOpacity={0.2}
                        />
                      );
                    })}
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="t" 
                      stroke="#6b7280" 
                      interval="preserveStartEnd"
                      minTickGap={40}
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis 
                      domain={priceDomain} 
                      stroke="#6b7280" 
                      tickFormatter={formatYAxisTick}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length > 0) {
                          const data = payload[0].payload;
                          const regimeLabel = data.regime === "TREND" ? "Trend" : data.regime === "MEANREV" ? "Mean Reversion" : "Chop";
                          return (
                            <div style={{ backgroundColor: "white", padding: "8px", border: "1px solid #e5e7eb", borderRadius: "4px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Step (t): {data.t}</div>
                              <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>Price: {data.price.toFixed(2)}</div>
                              <div style={{ fontSize: "12px", color: getRegimeColor(data.regime) }}>Regime: {regimeLabel}</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Equity Chart */}
            {equityData && equityData.length > 0 && (
              <div style={{ marginBottom: "40px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>Equity Curves</h3>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={normalizeEquity}
                      onChange={(e) => setNormalizeEquity(e.target.checked)}
                    />
                    <span>Normalize to 10,000 start</span>
                  </label>
                </div>
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={equityData} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="t" 
                      stroke="#6b7280" 
                      interval="preserveStartEnd"
                      minTickGap={40}
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      domain={equityDomain}
                      tickFormatter={formatYAxisTick}
                    />
                    <ReferenceLine y={normalizeEquity ? 10000 : (config.cash0 || 10000)} stroke="#9ca3af" strokeDasharray="3 3" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length > 0) {
                          const cash0 = normalizeEquity ? 10000 : (config.cash0 || 10000);
                          return (
                            <div style={{ backgroundColor: "white", padding: "8px", border: "1px solid #e5e7eb", borderRadius: "4px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Step (t): {label}</div>
                              {payload.map((entry: any) => {
                                const equity = normalizeEquity && entry.payload[entry.dataKey] 
                                  ? (entry.payload[entry.dataKey] / cash0) * 10000 
                                  : entry.payload[entry.dataKey];
                                const pnl = equity - cash0;
                                return (
                                  <div key={entry.dataKey} style={{ marginTop: "4px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "600", color: entry.color }}>
                                      Agent: {entry.dataKey}
                                    </div>
                                    <div style={{ fontSize: "13px", marginTop: "2px" }}>
                                      Equity: {equity.toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: "12px", color: pnl >= 0 ? "#22c55e" : "#ef4444", marginTop: "2px" }}>
                                      PnL: {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} (vs {cash0.toFixed(0)})
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px" }}
                      iconType="line"
                      onClick={(e: any) => {
                        const agentId = e.dataKey;
                        setVisibleEquityAgents((prev) => {
                          const next = new Set(prev);
                          if (next.has(agentId)) {
                            next.delete(agentId);
                          } else {
                            next.add(agentId);
                          }
                          return next;
                        });
                      }}
                    />
                    {Object.keys(result.equityByAgent)
                      .filter((agentId) => visibleEquityAgents.has(agentId))
                      .map((agentId) => (
                        <Line
                          key={agentId}
                          type="monotone"
                          dataKey={agentId}
                          stroke={getAgentColor(agentId)}
                          strokeWidth={2}
                          name={agentId}
                          dot={false}
                          isAnimationActive={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
                
                {/* Agent visibility controls for equity chart */}
                <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "14px" }}>
                  <span style={{ fontWeight: "600", color: "#374151" }}>Show/Hide agents:</span>
                  {Object.keys(result.equityByAgent).map((agentId) => (
                    <label key={agentId} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={visibleEquityAgents.has(agentId)}
                        onChange={(e) => {
                          setVisibleEquityAgents((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) {
                              next.add(agentId);
                            } else {
                              next.delete(agentId);
                            }
                            return next;
                          });
                        }}
                      />
                      <span style={{ color: visibleEquityAgents.has(agentId) ? getAgentColor(agentId) : "#9ca3af" }}>
                        {agentId}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Position Chart */}
            {posData && posData.length > 0 && (
              <div style={{ marginBottom: "40px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "4px" }}>Inventory/Position</h3>
                <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "12px" }}>Position vs limit (±30)</p>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={posData} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="t" 
                      stroke="#6b7280" 
                      interval="preserveStartEnd"
                      minTickGap={40}
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      domain={positionDomain}
                      tickFormatter={formatYAxisTick}
                    />
                    <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "+30", position: "right" }} />
                    <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "-30", position: "right" }} />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="2 2" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length > 0) {
                          return (
                            <div style={{ backgroundColor: "white", padding: "8px", border: "1px solid #e5e7eb", borderRadius: "4px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Step (t): {label}</div>
                              {payload.map((entry: any) => (
                                <div key={entry.dataKey} style={{ marginTop: "4px" }}>
                                  <div style={{ fontSize: "14px", fontWeight: "600", color: entry.color }}>
                                    Agent: {entry.dataKey}
                                  </div>
                                  <div style={{ fontSize: "13px", marginTop: "2px" }}>
                                    Position: {entry.value?.toFixed(2) || "0.00"}
                                  </div>
                                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                                    Position limit: ±30
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px" }}
                      iconType="line"
                      onClick={(e: any) => {
                        const agentId = e.dataKey;
                        setVisiblePosAgents((prev) => {
                          const next = new Set(prev);
                          if (next.has(agentId)) {
                            next.delete(agentId);
                          } else {
                            next.add(agentId);
                          }
                          return next;
                        });
                      }}
                    />
                    {Object.keys(result.posByAgent)
                      .filter((agentId) => visiblePosAgents.has(agentId))
                      .map((agentId) => (
                        <Line
                          key={agentId}
                          type="monotone"
                          dataKey={agentId}
                          stroke={getAgentColor(agentId)}
                          strokeWidth={2}
                          name={agentId}
                          dot={false}
                          isAnimationActive={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
                
                {/* Agent visibility controls for position chart */}
                <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "14px" }}>
                  <span style={{ fontWeight: "600", color: "#374151" }}>Show/Hide agents:</span>
                  {Object.keys(result.posByAgent).map((agentId) => (
                    <label key={agentId} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={visiblePosAgents.has(agentId)}
                        onChange={(e) => {
                          setVisiblePosAgents((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) {
                              next.add(agentId);
                            } else {
                              next.delete(agentId);
                            }
                            return next;
                          });
                        }}
                      />
                      <span style={{ color: visiblePosAgents.has(agentId) ? getAgentColor(agentId) : "#9ca3af" }}>
                        {agentId}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard Table */}
            {result.finalLeaderboard && result.finalLeaderboard.length > 0 && (
              <div style={{ marginBottom: "40px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px" }}>Final Leaderboard</h3>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb" }}>
                      <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "600" }}>
                        Agent
                      </th>
                      <th style={{ padding: "12px", textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "600" }}>
                        PnL
                      </th>
                      <th style={{ padding: "12px", textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "600" }}>
                        Equity
                      </th>
                      <th style={{ padding: "12px", textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "600" }}>
                        Turnover
                      </th>
                      <th style={{ padding: "12px", textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "600" }}>
                        Max DD
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.finalLeaderboard]
                      .sort((a, b) => b.pnl - a.pnl)
                      .map((row, idx) => (
                        <tr key={row.agentId} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f9fafb" }}>
                          <td style={{ padding: "12px", fontWeight: "500" }}>{row.agentId}</td>
                          <td style={{ 
                            padding: "12px", 
                            textAlign: "right", 
                            fontWeight: "600",
                            color: row.pnl >= 0 ? "#22c55e" : "#ef4444"
                          }}>
                            {row.pnl >= 0 ? "+" : ""}{row.pnl.toFixed(2)}
                          </td>
                          <td style={{ padding: "12px", textAlign: "right" }}>{row.equity.toFixed(2)}</td>
                          <td style={{ padding: "12px", textAlign: "right" }}>{row.turnover.toFixed(0)}</td>
                          <td style={{ padding: "12px", textAlign: "right" }}>
                            {(row.maxDrawdownPct * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PnL by Regime Table */}
            {result.pnlByRegime && Object.keys(result.pnlByRegime).length > 0 && (
              <div style={{ marginBottom: "40px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px" }}>PnL by Regime</h3>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb" }}>
                      <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "600" }}>
                        Agent
                      </th>
                      <th style={{ padding: "12px", textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "600", color: REGIME_COLORS.TREND }}>
                        TREND
                      </th>
                      <th style={{ padding: "12px", textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "600", color: REGIME_COLORS.MEANREV }}>
                        MEANREV
                      </th>
                      <th style={{ padding: "12px", textAlign: "right", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: "600", color: REGIME_COLORS.CHOP }}>
                        CHOP
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.pnlByRegime).map(([agentId, pnl], idx) => {
                      const getCellStyle = (value: number) => {
                        const intensity = Math.min(Math.abs(value) / 1000, 1);
                        const bgColor = value >= 0 
                          ? `rgba(34, 197, 94, ${intensity * 0.1})` 
                          : `rgba(239, 68, 68, ${intensity * 0.1})`;
                        return {
                          padding: "12px",
                          textAlign: "right" as const,
                          backgroundColor: bgColor,
                          fontWeight: "500" as const,
                          color: value >= 0 ? "#22c55e" : "#ef4444",
                        };
                      };
                      return (
                        <tr key={agentId} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f9fafb" }}>
                          <td style={{ padding: "12px", fontWeight: "500" }}>{agentId}</td>
                          <td style={getCellStyle(pnl.TREND)}>{pnl.TREND >= 0 ? "+" : ""}{pnl.TREND.toFixed(2)}</td>
                          <td style={getCellStyle(pnl.MEANREV)}>{pnl.MEANREV >= 0 ? "+" : ""}{pnl.MEANREV.toFixed(2)}</td>
                          <td style={getCellStyle(pnl.CHOP)}>{pnl.CHOP >= 0 ? "+" : ""}{pnl.CHOP.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Evolution Events Summary */}
            {result.evolutionEventsSummary && result.evolutionEventsSummary.length > 0 && (
              <div style={{ marginBottom: "40px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "12px" }}>
                  Evolution Events
                </h3>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb" }}>
                      <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                        Step
                      </th>
                      <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                        Top Agent
                      </th>
                      <th style={{ padding: "10px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>
                        Replacements
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.evolutionEventsSummary.map((evt, idx) => (
                      <tr key={evt.t} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f9fafb" }}>
                        <td style={{ padding: "10px" }}>{evt.t}</td>
                        <td style={{ padding: "10px" }}>{evt.topFitnessAgentId}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>{evt.replacementsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
