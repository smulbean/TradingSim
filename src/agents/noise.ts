import { RNG } from "../market/rng.js";
import type { Agent, Fill, MarketObs, Order, AgentSnapshot } from "./agent.js";

export class NoiseAgent implements Agent {
  id: string;
  private rng: RNG;

  private cash: number;
  private pos = 0;

  private equity0: number;
  private equityPeak: number;
  private maxDrawdown = 0;

  private turnover = 0;

  constructor(opts: { id: string; seed: number; cash0: number }) {
    this.id = opts.id;
    this.rng = new RNG(opts.seed);
    this.cash = opts.cash0;
    this.equity0 = opts.cash0;
    this.equityPeak = opts.cash0;
  }

  observe(_obs: MarketObs): Order[] {
    // random signed qty in {-2,-1,0,1,2}
    const x = this.rng.nextGaussian(0, 1);
    const qty = Math.max(-2, Math.min(2, Math.round(x)));
    return qty === 0 ? [] : [{ agentId: this.id, qty }];
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
