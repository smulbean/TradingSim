import { RNG } from "../market/rng.js";
import type { Fill, Quote } from "../agents/agent.js";

export function simulateMakerFill(params: {
  rng: RNG;
  quote: Quote;
  hitProb: number;
  feePerUnit: number;
}): Fill[] {
  const { rng, quote, hitProb, feePerUnit } = params;

  // With probability hitProb, generate exactly ONE fill (0 or 1 fills)
  if (rng.nextFloat() >= hitProb) {
    return [];
  }

  // Choose side: u < 0.5 => hit bid (maker buys), else => lift ask (maker sells)
  const u = rng.nextFloat();
  if (u < 0.5) {
    // Hit bid: maker buys
    const qty = quote.size;
    const price = quote.bid;
    const fee = Math.abs(qty) * feePerUnit;
    return [
      {
        agentId: quote.agentId,
        qty,
        price,
        fee,
      },
    ];
  } else {
    // Lift ask: maker sells
    const qty = -quote.size;
    const price = quote.ask;
    const fee = Math.abs(qty) * feePerUnit;
    return [
      {
        agentId: quote.agentId,
        qty,
        price,
        fee,
      },
    ];
  }
}
