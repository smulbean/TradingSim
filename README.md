# Adaptive Trading Game Lab

A multi-agent strategy simulator where trading agents compete in a market with hidden structure (trend/mean-reversion/chop), under costs and position limits.

This is a research sandbox for decision-making under uncertainty — not a real trading system.

## What is a Market Regime?

The simulator models a market that alternates between three regimes:

- **TREND**: Price tends to drift in one direction
- **MEANREV**: Price tends to pull back toward an anchor/value  
- **CHOP**: Noisy sideways movement with no clear direction

Agents must adapt their strategies to these changing market conditions. Performance is tracked both overall and separately by regime.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm

## Quickstart

For detailed setup instructions, see [SETUP.md](SETUP.md).

**Quick start:**
```bash
git clone https://github.com/smulbean/TradingSim.git
cd TradingSim
npm install
npm run build
npm run sim
```

This will generate `out/run_log.json` with the full simulation results.

**Need help?** See [SETUP.md](SETUP.md) for step-by-step instructions and troubleshooting.

## Running the Simulation

### Single Simulation Run

```bash
npm run sim
```

This will:
1. Compile TypeScript (`tsc`)
2. Run 5000 steps of market simulation
3. Print final leaderboard and regime breakdown
4. Generate `out/run_log.json` with full simulation log

### Batch Runner (Multiple Seeds)

```bash
npm run batch
```

This will:
1. Run 20 seeds (default) in summary mode (fast, no per-step logs)
2. Aggregate statistics across seeds:
   - Mean and standard deviation of PnL per agent
   - Mean max drawdown and turnover per agent
   - Mean regime-conditioned PnL per agent
3. Print a ranking table sorted by mean PnL
4. Generate `out/batch_summary.json` with aggregated results

The batch runner is memory-efficient and runs much faster than individual sims since it doesn't store per-step data.

### Web Dashboard

**Start the dashboard:**
```bash
npm run build  # Required first!
cd ui
npm install    # First time only
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

**Features:**
- **Interactive controls**: Adjust simulation parameters (seed, steps, market parameters, exchange costs, evolution settings)
- **Presets**: Quick access to common configurations (Balanced, Trend-heavy, MeanRev-heavy, High-cost, Evolution On)
- **Charts**: 
  - Price over time with regime background shading and tooltips
  - Equity curves per agent (with normalize toggle and independent show/hide controls)
  - Inventory/position per agent (with independent show/hide controls)
  - Regime timeline visualization with grouped segments
- **Tables**:
  - Final leaderboard (PnL, equity, turnover, max drawdown) - sorted by PnL with color coding
  - PnL by regime breakdown with color gradients
  - Evolution events summary (if evolution enabled)
- **Summary cards**: Quick overview of total steps, best/worst agents, and average PnL

**Troubleshooting:** See [SETUP.md](SETUP.md) for common issues and solutions.

### Example Output

The simulation prints a leaderboard every 1000 steps and at the end:

```
Step 1000
┌─────────┬───────────┬─────────┬────────────┬─────┬──────────┬────────┐
│ (index) │ agentId   │ pnl     │ equity     │ pos │ turnover │ dd     │
├─────────┼───────────┼─────────┼────────────┼─────┼──────────┼────────┤
│ 0       │ 'noise-1' │ '31.41' │ '10031.41' │ 23  │ '723'    │ '0.8%' │
│ 1       │ 'noise-2' │ '17.38' │ '10017.38' │ -2  │ '766'    │ '0.4%' │
│ 2       │ 'noise-3' │ '-9.54' │ '9990.46'  │ -30 │ '756'    │ '0.8%' │
└─────────┴───────────┴─────────┴────────────┴─────┴──────────┴────────┘
...
```

## Reproducibility

All simulations are **deterministic** when using the same seed. This means:
- Same seed + same config = identical results
- Perfect for research, debugging, and comparing strategies
- The RNG is seeded and produces the same sequence of random numbers

**Example:**
```bash
npm run sim  # Uses seed 42 by default - results identical every time
```

You can change the seed in `src/config.ts` or via the dashboard to explore different market scenarios.

For more details, see the [Reproducibility section in SETUP.md](SETUP.md#reproducibility).

## Key Metrics Definitions

- **PnL** = equity - starting cash
- **Turnover** = sum of absolute trade quantities
- **Max drawdown** = peak-to-trough equity decline (as a fraction of peak equity)
- **Regime-conditioned PnL** = PnL attributed to each market regime (TREND/MEANREV/CHOP)

## Evolution

Evolution enables parameter mutation and selection over time:

- **How to enable**: Set `evolution.enabled: true` in config
- **What it does**: 
  - Every `interval` steps, agents are ranked by fitness
  - Top `eliteFrac` agents survive
  - Bottom agents are replaced by mutated clones of elites
  - Fitness = PnL - turnoverPenalty × turnover - drawdownPenalty × maxDrawdown
  - New agents start fresh (cash0, pos=0) but inherit mutated parameters

See the config section below for details.

## Available Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run sim` - Run a single simulation (compiles first)
- `npm run batch` - Run batch simulations across multiple seeds
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run ui` - Start the dashboard (from root directory)

See [SETUP.md](SETUP.md) for detailed usage instructions.

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. The test suite provides comprehensive coverage of all modules with unit tests, edge cases, and integration tests.

**Quick commands:**
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report

See [SETUP.md](SETUP.md) for troubleshooting test failures.

### Test Coverage

The test suite includes **183 tests** covering:
- 15 RNG tests
- 6 Regime tests
- 14 Market tests
- 42 Agent tests (noise, momentum, meanRevert, marketMaker)
- 18 Constraint tests
- 21 Exchange tests (clearing + maker flow)
- 18 Stats tests
- 17 Metrics tests (equity + regime)
- 5 Experiment tests (batch runner)
- 8 Evolution tests (fitness, mutation, selection)
- 7 Integration tests (sim + evolution)

## Output Format

The simulation outputs `out/run_log.json` containing:
- `config`: Complete configuration including:
  - `market`: Market parameters (seed, drift, noise levels, etc.)
  - `exchange`: Exchange parameters (fees, slippage, impact)
  - `constraints`: Position limits and leverage constraints
  - `cash0`: Starting cash for agents
  - `T`: Number of simulation steps
- `steps`: Array of 5000 simulation steps, each containing:
  - `t`: Time step number
  - `regime`: Current market regime ("TREND", "MEANREV", or "CHOP")
  - `fair`: Hidden fair value F_t
  - `price`: Observed price P_t (fair value + microstructure noise)
  - `midAfter`: Price after exchange impact
  - `fills`: Array of order fills with agentId, qty, price, and fee
  - `snapshots`: Array of agent snapshots with cash, position, equity, turnover, and max drawdown
- `evolutionEvents` (if evolution enabled): Array of evolution events, each containing:
  - `t`: Time step when evolution occurred
  - `ranking`: Fitness ranking of all agents (id, kind, fitness, pnl, turnover, maxDrawdown, params)
  - `replacements`: List of replaced agents (oldId, newId, kind, newParams)

## Repository Structure

```
src/                    # Source code
  sim.ts                # Single-run simulation wrapper
  runSim.ts             # Core simulation engine (full/summary modes)
  batch.ts              # Batch runner CLI entry point
  config.ts             # Simulation configuration types and defaults
  configSchema.ts       # Config sanitization and merging utilities
  market/               # Market simulation
    rng.ts              # Deterministic random number generator
    regimes.ts          # Market regime definitions
    market.ts           # Market model with regime switching
  agents/               # Trading agent implementations
    agent.ts            # Agent interface and shared types
    noise.ts            # Noise trader agent
    momentum.ts         # Momentum strategy agent
    meanRevert.ts       # Mean reversion strategy agent
    marketMaker.ts      # Market maker agent
    factory.ts          # Agent factory for parameter-driven construction
  evolution/            # Evolution logic (fitness, mutation, selection)
    evolve.ts           # Evolution engine
  exchange/             # Exchange clearing and constraints
    exchange.ts         # Exchange clearing (fills, fees, slippage, impact)
    constraints.ts      # Position limits and leverage constraints
    makerFlow.ts        # Market maker fill simulation
  metrics/              # Performance metrics and leaderboard
    equity.ts           # Leaderboard and performance metrics
    regime.ts           # Regime-conditioned PnL attribution
  experiments/          # Batch runner and aggregation
    batch.ts            # Batch runner for multiple seeds
    aggregate.ts        # Aggregation utilities for batch results
  utils/                # Utilities (stats, file I/O)
    stats.ts            # Statistical functions (mean, std)
    write.ts            # File writing utilities

ui/                     # Next.js dashboard
  app/                  # Next.js app directory
    page.tsx            # Main dashboard page
    api/                # API routes
      config/           # Config endpoint
      run/              # Simulation run endpoint
    layout.tsx          # Root layout
    globals.css         # Global styles
  src/lib/              # Shared utilities
    colors.ts           # Semantic color system (regimes, agents)
    chartData.ts        # Chart data helpers (time series building)
  scripts/              # Wrapper scripts
    runSimWrapper.mjs   # ESM wrapper for running simulator
  package.json          # UI dependencies
  tsconfig.json         # TypeScript config for UI
  next.config.js        # Next.js configuration

tests/                  # Test files (mirrors src/ structure)
  market/               # Market module tests
  agents/               # Agent tests
  exchange/             # Exchange tests
  utils/                # Utility tests
  metrics/              # Metrics tests
  experiments/          # Experiment tests
  evolution/            # Evolution tests
  integration/          # Integration tests

dist/                   # Compiled JavaScript (generated, gitignored)
out/                    # Simulation output files (generated, gitignored)
coverage/               # Test coverage reports (generated, gitignored)
```

## Features

### Day 1: Market Simulation
- **Deterministic RNG**: Seeded random number generator for reproducible simulations
- **Regime Switching**: Market alternates between TREND, MEANREV, and CHOP regimes
- **Hidden Fair Value**: Simulates unobservable fair value with regime-dependent dynamics
- **Microstructure Noise**: Observed prices include noise around fair value
- **Gaussian Noise**: Box-Muller transform for normally distributed random variables

### Day 2: Trading Agents & Exchange
- **Trading Agents**: Multiple agents submit market orders each step
- **Exchange Clearing**: Processes orders with fees, slippage, and price impact
- **Constraints**: Position limits and leverage caps enforced on orders
- **Performance Tracking**: Real-time tracking of cash, positions, equity, turnover, and max drawdown
- **Leaderboard**: Periodic and final rankings by equity/PnL

### Day 3: Strategy Diversity
- **Momentum Agent**: Trend-following strategy with inventory penalty
- **Mean Reversion Agent**: Counter-trend strategy based on rolling mean
- **Regime-Conditioned PnL**: Performance attribution by market regime

### Day 4: Market Making
- **Market Maker Agent**: Provides liquidity with volatility-aware spreads
- **Inventory Management**: Quotes skew away from inventory to manage risk
- **Maker Flow Simulation**: Deterministic taker flow hitting/lifting quotes

### Day 5: Experimental Framework
- **Configuration System**: Centralized `SimConfig` type with `DEFAULT_CONFIG`
- **Reusable Simulation Engine**: `runSim()` supports "full" (with logs) and "summary" (memory-efficient) modes
- **Batch Runner**: Run multiple seeds, aggregate statistics (mean/std PnL, max drawdown, turnover, regime PnL)
- **Research-Ready**: Enables systematic parameter sweeps and comparative analysis

### Day 6: Evolutionary Selection
- **Parameter Evolution**: Agents evolve strategy parameters over time through mutation and selection
- **Fitness-Based Selection**: Top-performing agents (elites) survive; bottom performers are replaced by mutated clones
- **Deterministic Evolution**: Evolution events are seeded and reproducible
- **Type Preservation**: Agents maintain their strategy type (momentum stays momentum, etc.)
- **Evolution Logging**: Evolution events (rankings, replacements) logged in full mode for inspection
- **Configurable**: Evolution can be enabled/disabled via config with customizable interval, elite fraction, and mutation strength

#### Enabling Evolution

To enable evolution, modify the config in `src/config.ts` or use the dashboard:

```typescript
const cfg: SimConfig = {
  // ... other config ...
  evolution: {
    enabled: true,
    interval: 1000,        // Evolve every 1000 steps
    eliteFrac: 0.5,        // Keep top 50% as elites
    mutateSigma: 0.15,     // Mutation strength (multiplicative)
    fitness: {
      turnoverPenalty: 0.05,    // Penalty per unit of turnover
      drawdownPenalty: 2000,   // Penalty per unit of max drawdown
    },
  },
};
```

**Fitness formula**: `fitness = pnl - turnoverPenalty × turnover - drawdownPenalty × maxDrawdown`

**Evolution process**:
1. Agents are ranked by fitness
2. Top `eliteFrac` agents survive (keep their cash/position/history)
3. Bottom agents are replaced by mutated clones of elites
4. New agents start fresh (cash0, pos=0) but inherit mutated parameters
5. Evolution events are logged to `evolutionEvents` in the run log

Evolution events in `out/run_log.json` include:
- `t`: Time step when evolution occurred
- `ranking`: Full fitness ranking of all agents
- `replacements`: List of replaced agents with their new IDs and parameters

## Getting Help

- **Setup issues?** See [SETUP.md](SETUP.md) for troubleshooting
- **Questions about features?** Check the sections above or explore the code
- **Found a bug?** Open an issue on GitHub with:
  - Steps to reproduce (seed, config, expected vs actual behavior)
  - Error messages or unexpected output

## Contributing

This is a research project. If you find bugs or have suggestions:
1. Check existing issues on GitHub
2. Open a new issue with details
3. Include steps to reproduce (seed, config, expected vs actual behavior)

## License

MIT License - see [LICENSE](LICENSE) file for details.