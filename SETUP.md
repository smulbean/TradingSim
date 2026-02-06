# Setup Guide

This guide will help you get the Adaptive Trading Game Lab running on your machine.

## Prerequisites

- **Node.js**: v18 or higher (v20+ recommended)
- **npm**: Comes with Node.js
- **Git**: For cloning the repository

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/smulbean/TradingSim.git
cd TradingSim
```

### 2. Install Root Dependencies

```bash
npm install
```

This installs TypeScript, Vitest, and other development dependencies.

### 3. Build the Simulator

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory. **This step is required** before running simulations or the dashboard.

### 4. Verify Installation

Run a test simulation:

```bash
npm run sim
```

You should see:
- Compilation output
- Simulation running (5000 steps)
- Final leaderboard printed to console
- `out/run_log.json` file created

### 5. (Optional) Run Tests

```bash
npm test
```

All tests should pass. This verifies the installation is correct.

### 6. (Optional) Start the Dashboard

```bash
# Install UI dependencies (first time only)
cd ui
npm install

# Start the development server
npm run dev
```

Then open `http://localhost:3000` in your browser.

**Important**: Make sure you ran `npm run build` in the root directory before starting the dashboard!

## Troubleshooting

### "Simulator not compiled" error

**Problem**: Dashboard shows error about missing `dist/` directory.

**Solution**: Run `npm run build` in the root directory.

### "Cannot find module" errors

**Problem**: TypeScript compilation errors or module not found.

**Solution**: 
1. Make sure you ran `npm install` in both root and `ui/` directories
2. Delete `node_modules` and `package-lock.json`, then reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Tests failing

**Problem**: `npm test` fails with errors.

**Solution**:
1. Make sure Node.js version is v18+
2. Check that all dependencies are installed: `npm install`
3. Try clearing cache: `rm -rf node_modules && npm install`

### Dashboard not loading

**Problem**: Dashboard shows blank page or errors.

**Solution**:
1. Check that simulator is compiled: `npm run build`
2. Check browser console for errors
3. Make sure you're running from `ui/` directory: `cd ui && npm run dev`
4. Try clearing Next.js cache: `rm -rf ui/.next && cd ui && npm run dev`

## Reproducibility

All simulations are **deterministic** - same seed + same config = identical results.

To reproduce specific results:
1. Note the seed used (default is 42)
2. Note the configuration parameters
3. Run with the same seed and config
4. Results will be identical

Example:
```bash
# Default seed is 42, so running:
npm run sim

# Will always produce the same results
```

## Next Steps

- Read the main [README.md](README.md) for detailed documentation
- Explore the dashboard at `http://localhost:3000`
- Try different presets and parameters
- Run batch simulations: `npm run batch`
- Check `out/run_log.json` for detailed simulation data
