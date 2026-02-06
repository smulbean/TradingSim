/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use webpack explicitly (since we don't need Turbopack features)
  // Or remove webpack config and let Turbopack handle it
  // For now, let's use webpack explicitly by adding empty turbopack config
  turbopack: {},
  
  // Note: We're using child processes for simulator, so no need for webpack externals
  // If you want to use webpack instead of Turbopack, run: npm run dev -- --webpack
};

module.exports = nextConfig;
