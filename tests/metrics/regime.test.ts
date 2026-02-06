import { describe, it, expect } from "vitest";
import { regimePnl } from "../../src/metrics/regime.js";

describe("regimePnl", () => {
  it("should allocate PnL to correct regime buckets", () => {
    const steps = [
      {
        regime: "TREND",
        snapshots: [
          { agentId: "A", equity: 100 },
          { agentId: "B", equity: 100 },
        ],
      },
      {
        regime: "TREND",
        snapshots: [
          { agentId: "A", equity: 103 },
          { agentId: "B", equity: 99 },
        ],
      },
      {
        regime: "CHOP",
        snapshots: [
          { agentId: "A", equity: 101 },
          { agentId: "B", equity: 102 },
        ],
      },
    ];

    const result = regimePnl({ steps });

    // Step 1: A +3, B -1, allocated to TREND (step[1].regime)
    expect(result.A?.TREND).toBe(3);
    expect(result.B?.TREND).toBe(-1);

    // Step 2: A -2, B +3, allocated to CHOP (step[2].regime)
    expect(result.A?.CHOP).toBe(-2);
    expect(result.B?.CHOP).toBe(3);

    // MEANREV should be 0
    expect(result.A?.MEANREV).toBe(0);
    expect(result.B?.MEANREV).toBe(0);
  });

  it("should handle all three regimes", () => {
    const steps = [
      {
        regime: "TREND",
        snapshots: [{ agentId: "A", equity: 100 }],
      },
      {
        regime: "MEANREV",
        snapshots: [{ agentId: "A", equity: 105 }],
      },
      {
        regime: "CHOP",
        snapshots: [{ agentId: "A", equity: 103 }],
      },
    ];

    const result = regimePnl({ steps });

    expect(result.A?.TREND).toBe(0); // First step has no prior
    expect(result.A?.MEANREV).toBe(5); // +5 in MEANREV
    expect(result.A?.CHOP).toBe(-2); // -2 in CHOP
  });

  it("should handle missing agents gracefully", () => {
    const steps = [
      {
        regime: "TREND",
        snapshots: [{ agentId: "A", equity: 100 }],
      },
      {
        regime: "TREND",
        snapshots: [
          { agentId: "A", equity: 105 },
          { agentId: "B", equity: 200 }, // New agent
        ],
      },
    ];

    const result = regimePnl({ steps });

    expect(result.A?.TREND).toBe(5);
    // B appears in step 1 but not step 0, so delta is 200 - 200 = 0
    expect(result.B?.TREND).toBe(0);
  });

  it("should initialize all regimes to 0", () => {
    const steps = [
      {
        regime: "TREND",
        snapshots: [{ agentId: "A", equity: 100 }],
      },
    ];

    const result = regimePnl({ steps });

    expect(result.A?.TREND).toBe(0);
    expect(result.A?.MEANREV).toBe(0);
    expect(result.A?.CHOP).toBe(0);
  });

  it("should handle multiple agents", () => {
    const steps = [
      {
        regime: "TREND",
        snapshots: [
          { agentId: "A", equity: 100 },
          { agentId: "B", equity: 200 },
        ],
      },
      {
        regime: "MEANREV",
        snapshots: [
          { agentId: "A", equity: 110 },
          { agentId: "B", equity: 190 },
        ],
      },
    ];

    const result = regimePnl({ steps });

    expect(result.A?.MEANREV).toBe(10);
    expect(result.B?.MEANREV).toBe(-10);
    expect(result.A?.TREND).toBe(0);
    expect(result.B?.TREND).toBe(0);
  });
});
