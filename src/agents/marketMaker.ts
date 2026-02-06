import { RNG } from "../market/rng.js";
import type { Agent, Fill, MarketObs, Order, AgentSnapshot, Quote } from "./agent.js";

export class MarketMakerAgent implements Agent {
  id: string;
  private rng: RNG;

  private cash: number;
  private pos = 0;
  private turnover = 0;

  private prices: number[] = [];
  private equityPeak: number;
  private maxDrawdown = 0;

  private baseSpread: number;
  private volWindow: number;
  private volMultiplier: number;
  private invSkew: number;
  private size: number;
  private maxStepInventory: number;

  constructor(opts: {
    id: string;
    seed: number;
    cash0: number;
    baseSpread: number;
    volWindow: number;
    volMultiplier: number;
    invSkew: number;
    size: number;
    maxStepInventory?: number;
  }) {
    this.id = opts.id;
    this.rng = new RNG(opts.seed);
    this.cash = opts.cash0;
    this.equityPeak = opts.cash0;

    this.baseSpread = opts.baseSpread;
    this.volWindow = opts.volWindow;
    this.volMultiplier = opts.volMultiplier;
    this.invSkew = opts.invSkew;
    this.size = opts.size;
    this.maxStepInventory = opts.maxStepInventory ?? Infinity;
  }

  observe(_obs: MarketObs): Order[] {
    // Market maker doesn't submit market orders via observe
    return [];
  }

  quote(obs: MarketObs, mid: number): Quote | null {
    // Track prices for volatility estimation
    this.prices.push(obs.price);
    if (this.prices.length > this.volWindow) {
      this.prices.shift();
    }

    // Need enough data to estimate volatility
    if (this.prices.length < this.volWindow) {
      return null;
    }

    // Calculate returns from prices
    const returns: number[] = [];
    for (let i = 1; i < this.prices.length; i++) {
      const ret = (this.prices[i]! - this.prices[i - 1]!) / Math.max(this.prices[i - 1]!, 1e-9);
      returns.push(ret);
    }

    // Estimate volatility: sqrt(mean(r^2)) where r = price[i]-price[i-1]
    const meanSquaredRet = returns.reduce((acc, r) => acc + r * r, 0) / returns.length;
    const vol = Math.sqrt(meanSquaredRet);

    // Spread widens with volatility (vol is a percentage return, multiply by mid to get absolute spread)
    const spread = this.baseSpread + this.volMultiplier * vol * mid;

    // Skew away from inventory
    const skew = -this.invSkew * this.pos;

    // Calculate bid/ask
    let bid = mid + skew - spread / 2;
    let ask = mid + skew + spread / 2;

    // Ensure bid < ask (enforce minimal spread if needed)
    if (bid >= ask) {
      const minSpread = 1e-6;
      const center = (bid + ask) / 2;
      bid = center - minSpread / 2;
      ask = center + minSpread / 2;
    }

    // Limit inventory exposure
    const effectiveSize = Math.min(this.size, this.maxStepInventory);

    return {
      agentId: this.id,
      bid,
      ask,
      size: effectiveSize,
    };
  }

  onFill(fill: Fill): void {
    this.cash -= fill.qty * fill.price + fill.fee;
    this.pos += fill.qty;
    this.turnover += Math.abs(fill.qty);
  }

  markToMarket(price: number): void {
    const equity = this.cash + this.pos * price;
    this.equityPeak = Math.max(this.equityPeak, equity);
    const dd = (this.equityPeak - equity) / Math.max(this.equityPeak, 1e-9);
    this.maxDrawdown = Math.max(this.maxDrawdown, dd);
  }

  snapshot(price: number): AgentSnapshot {
    const equity = this.cash + this.pos * price;
    return {
      agentId: this.id,
      cash: this.cash,
      pos: this.pos,
      equity,
      turnover: this.turnover,
      maxDrawdown: this.maxDrawdown,
    };
  }
}
