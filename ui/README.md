# Trading Simulator Dashboard

Web-based dashboard for running and visualizing trading simulations.

**Note:** This is part of the Adaptive Trading Game Lab. See the main [README](../README.md) for full project documentation.

## Quick Start

1. **From the root directory**, compile the simulator:
   ```bash
   npm run build
   ```

2. **In this directory**, install UI dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Interactive Controls**: Adjust simulation parameters (seed, steps, market parameters, exchange costs, evolution settings)
- **Presets**: Quick access to common configurations
- **Interactive Charts**: 
  - Price over time with regime background shading
  - Equity curves with normalize toggle and show/hide controls
  - Inventory/position with show/hide controls
  - Regime timeline visualization
- **Results Tables**: Leaderboards, regime breakdowns, evolution events
- **Summary Cards**: Quick overview of simulation results

## API Routes

- `GET /api/config` - Returns default configuration
- `POST /api/run` - Runs a simulation with provided config override

## Building for Production

```bash
npm run build
npm start
```

See the main [README](../README.md) for complete documentation.
