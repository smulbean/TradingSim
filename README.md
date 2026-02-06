# Adaptive Trading Game Lab

## Overview

This is a multi-agent market simulator designed to study how trading strategies behave under uncertainty, transaction costs, and competition. The simulator models a market with hidden structure: a latent fair value process that evolves according to regime-dependent dynamics, observed only through noisy price signals.

Agents operate with partial information, facing transaction costs, inventory constraints, and leverage limits. The goal is to understand how different strategy types perform under various market regimes (trend, mean-reversion, chop) and how competition and costs affect expected returns.

This is a research sandbox for studying incentives and expected value in a controlled environment. It is not calibrated to real market data and makes no claims about predictive power or real-world trading performance.

## Market Model

The simulator implements a regime-switching market model:

- **Latent fair value**: A fair value process F_t evolves with regime-dependent drift and volatility. The drift and noise characteristics change based on the current market regime.

- **Observed prices**: Agents observe prices P_t = F_t + ε_t, where ε_t is microstructure noise. This noise represents the gap between fair value and what agents can actually trade at.

- **Regime switching**: The market alternates stochastically between three regimes:

  **TREND**: Fair value exhibits persistent drift in one direction with relatively low noise.

  **MEANREV**: Fair value reverts toward a mean level with moderate noise.

  **CHOP**: Fair value exhibits high-frequency noise with no persistent directional bias.

Regime transitions occur probabilistically, creating periods where different strategy types have varying expected value.

## Agents

The simulator includes several agent types, each implementing a different trading strategy:

**Momentum**: Attempts to profit from trend continuation by increasing position size when price moves favorably. Includes an inventory penalty to manage risk.

**Mean-reversion**: Assumes prices will revert toward a rolling mean, taking positions opposite to recent price movements.

**Market maker**: Provides liquidity by quoting bid-ask spreads, adjusting quotes based on inventory and volatility estimates. Spreads widen with inventory to manage risk.

**Noise traders**: Trade randomly, serving as a source of market noise and liquidity.

All agents face:
- Position limits (maximum long/short exposure)
- Leverage constraints
- Transaction costs (fees, slippage, price impact)
- Partial/noisy information about fair value

Agents do not observe the true regime or fair value directly—they must infer market conditions from noisy price observations.

## Evolution and Selection

An optional evolutionary mechanism models adaptation and competition:

- Periodically (every N steps), agents are ranked by a fitness function: `fitness = PnL - λ_turnover × turnover - λ_drawdown × maxDrawdown`

- Top performers (elites) survive with their current positions and capital.

- Bottom performers are replaced by mutated variants of elite agents. Mutations affect strategy parameters (e.g., lookback windows, sensitivity coefficients) but preserve agent type.

- New agents start with fresh capital and zero position but inherit mutated parameters.

This is a simple model of selection pressure and adaptation, not a learning algorithm. It demonstrates how competition and parameter variation can lead to different strategy distributions over time, but it does not optimize for optimal policies.

## Metrics

Performance is measured along several dimensions:

- **PnL**: Profit and loss (equity - starting capital). The primary return metric.

- **Turnover**: Sum of absolute trade quantities. Measures trading activity and cost exposure.

- **Max drawdown**: Peak-to-trough equity decline, expressed as a fraction of peak equity. Captures tail risk and capital efficiency.

- **Regime-conditioned PnL**: PnL attributed to each market regime (TREND/MEANREV/CHOP). Useful for understanding when strategies gain or lose expected value.

These metrics are tracked per agent and aggregated across simulation runs. The focus is on understanding risk-return tradeoffs and regime sensitivity, not on maximizing any single metric.

## Experimental Use

The simulator is designed for systematic experimentation:

- **Parameter sweeps**: Vary transaction costs, position limits, or market parameters to study sensitivity.

- **Regime comparisons**: Compare strategy performance across different regime transition probabilities or regime characteristics.

- **Cost sensitivity**: Understand how transaction costs affect strategy viability and expected returns.

- **Competition effects**: Study how multiple agents competing in the same market affect individual and aggregate outcomes.

- **Evolution dynamics**: Observe how selection pressure and mutation affect strategy distributions over time.

All simulations are deterministic when using fixed seeds, enabling reproducible experiments and controlled comparisons.

## Limitations

This simulator makes several simplifying assumptions:

- **No latency competition**: All agents observe prices simultaneously. There is no information advantage from faster execution.

- **Simplified impact model**: Price impact is modeled as a linear function of trade size, not a full order book.

- **No asymmetric information**: All agents observe the same noisy prices. There is no private information or information hierarchy.

- **Not calibrated to real data**: Market parameters (drift, volatility, regime transition probabilities) are not fitted to historical data.

- **No order book dynamics**: The exchange clears orders instantaneously at a single price. There is no limit order book, queue position, or order type diversity.

- **Simplified agent models**: Agents use heuristic strategies, not learned policies or optimal control solutions.

Results from this simulator are conceptual and illustrative. They demonstrate how different incentives and constraints affect strategy behavior in a controlled setting, but they should not be interpreted as predictions about real market performance.

## Running the Code

**Prerequisites**: Node.js v18+ and npm.

**Quick start**:
```bash
git clone https://github.com/smulbean/TradingSim.git
cd TradingSim
npm install
npm run build
npm run sim
```

This runs a single simulation with default parameters and writes results to `out/run_log.json`.

**Batch runs**:
```bash
npm run batch
```

Runs multiple seeds in summary mode and aggregates statistics across runs.

**Web dashboard**:
```bash
npm run build  # Required first
cd ui
npm install
npm run dev
```

The dashboard provides interactive parameter controls and visualization. See [SETUP.md](SETUP.md) for detailed setup instructions and troubleshooting.

**Testing**:
```bash
npm test
```

The test suite verifies deterministic behavior and correctness of core components.

## Design Philosophy

The focus is on simple, interpretable models that are easy to reason about analytically. Complexity is introduced only when it clarifies the research question—not for its own sake.

The simulator is designed to be a controlled environment for studying strategy behavior, not a realistic market model. By keeping the model simple, we can isolate the effects of specific mechanisms (regime switching, transaction costs, competition) and understand their impact on expected value and risk.

This is a tool for research and education, not a trading system.

## License

MIT License - see [LICENSE](LICENSE) file for details.
