# Pre-Push Checklist

Use this checklist to verify everything is ready before pushing to GitHub.

## ✅ Files to Verify

### Core Files (Should be committed)
- [x] `package.json` - Root package with proper metadata
- [x] `ui/package.json` - UI package
- [x] `tsconfig.json` - TypeScript config
- [x] `ui/tsconfig.json` - UI TypeScript config
- [x] `vitest.config.ts` - Test configuration
- [x] `ui/next.config.js` - Next.js configuration
- [x] `LICENSE` - MIT License
- [x] `README.md` - Main documentation
- [x] `SETUP.md` - Setup guide (new)
- [x] `.gitignore` - Git ignore rules
- [x] `ui/.gitignore` - UI git ignore rules
- [x] `src/` - All source files
- [x] `tests/` - All test files
- [x] `ui/app/` - UI application files
- [x] `ui/src/lib/` - UI utilities (colors.ts, chartData.ts)
- [x] `ui/scripts/` - Wrapper scripts

### Generated Files (Should be gitignored)
- [ ] `dist/` - Compiled JavaScript (should NOT be committed)
- [ ] `out/` - Simulation outputs (should NOT be committed)
- [ ] `node_modules/` - Dependencies (should NOT be committed)
- [ ] `ui/node_modules/` - UI dependencies (should NOT be committed)
- [ ] `ui/.next/` - Next.js build (should NOT be committed)
- [ ] `coverage/` - Test coverage (should NOT be committed)

## ✅ Verification Steps

### 1. Test Build
```bash
npm run build
```
Should compile without errors and create `dist/` directory.

### 2. Test Simulation
```bash
npm run sim
```
Should run successfully and create `out/run_log.json`.

### 3. Test Batch Runner
```bash
npm run batch
```
Should run 20 seeds and create `out/batch_summary.json`.

### 4. Run Tests
```bash
npm test
```
All tests should pass.

### 5. Test Dashboard Setup
```bash
# From root
npm run build
cd ui
npm install
npm run dev
```
Dashboard should start at `http://localhost:3000`.

### 6. Verify No Hardcoded Paths
```bash
# Check for absolute paths
grep -r "/Users/graceyin" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist
```
Should return no results (or only in .git files).

### 7. Check Git Status
```bash
git status
```
Should show:
- Modified: `.gitignore`, `README.md`, `package.json`
- New files: `SETUP.md`, `.github/workflows/ci.yml` (optional)
- Should NOT show: `dist/`, `out/`, `node_modules/`, `ui/.next/`

## ✅ Documentation Checklist

- [x] README has clear quickstart
- [x] README explains what regimes are
- [x] README has setup instructions for sim/batch/ui
- [x] README explains reproducibility (deterministic seeds)
- [x] README has key metrics definitions
- [x] README has evolution documentation
- [x] SETUP.md has troubleshooting section
- [x] UI README updated with correct instructions

## ✅ Code Quality

- [x] No hardcoded absolute paths
- [x] All paths use relative resolution
- [x] Error messages are helpful
- [x] TypeScript compiles without errors
- [x] No linter errors

## ✅ Reproducibility

- [x] Default seed is documented (42)
- [x] README explains deterministic behavior
- [x] Same seed + config = same results

## Ready to Push!

Once all checks pass:

```bash
# Review changes
git status
git diff

# Add files
git add .

# Commit
git commit -m "Add dashboard UI and improve documentation"

# Push
git push origin main
```

## Post-Push Verification

After pushing, verify others can clone and run:

1. Clone in a fresh directory
2. Follow SETUP.md instructions
3. Run `npm run sim` - should work identically
4. Run `npm test` - all tests should pass
5. Start dashboard - should work
