import { RNG } from "../market/rng.js";
import type { Agent, Fill, MarketObs, Order, AgentSnapshot } from "./agent.js";

export class MomentumAgent implements Agent {
  id: string;
  private rng: RNG;

  private cash: number;
  private pos = 0;
  private turnover = 0;

  private prices: number[] = [];
  private equityPeak: number;
  private maxDrawdown = 0;

  private lookback: number;
  private k: number;
  private invPenalty: number;
  private maxStepQty: number;

  constructor(opts: {
    id: string;
    seed: number;
    cash0: number;
    lookback: number;
    k: number; // aggressiveness
    invPenalty: number;
    maxStepQty: number;
  }) {
    this.id = opts.id;
    this.rng = new RNG(opts.seed);
    this.cash = opts.cash0;
    this.equityPeak = opts.cash0;

    this.lookback = opts.lookback;
    this.k = opts.k;
    this.invPenalty = opts.invPenalty;
    this.maxStepQty = opts.maxStepQty;
  }

  observe(obs: MarketObs): Order[] {
    this.prices.push(obs.price);
    if (this.prices.length <= this.lookback) return [];
    if (this.prices.length > this.lookback + 1) this.prices.shift();

    const ret = this.prices[this.prices.length - 1]! - this.prices[0]!;
    let desired = Math.tanh(this.k * ret);

    // penalize large inventory
    desired -= this.invPenalty * this.pos;

    let qty = Math.round(desired * this.maxStepQty);
    qty = Math.max(-this.maxStepQty, Math.min(this.maxStepQty, qty));
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
