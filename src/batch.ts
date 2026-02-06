import { runBatch } from "./experiments/batch.js";

async function main() {
  await runBatch();
  console.log("\nWrote out/batch_summary.json");
}

main();
