import type { Order, Fill } from "../agents/agent.js";

export type ExchangeConfig = {
  feePerUnit: number;      // txn cost per unit
  slippagePerUnit: number; // adverse selection
  impact: number;          // price += impact * netFlow
};

export class Exchange {
  constructor(public cfg: ExchangeConfig) {}

  clear(orders: Order[], mid: number): { midAfter: number; fills: Fill[] } {
    const netFlow = orders.reduce((s, o) => s + o.qty, 0);
    const midAfter = mid + this.cfg.impact * netFlow;

    const fills: Fill[] = orders.map(o => {
      const sign = Math.sign(o.qty);
      const fillPrice = midAfter + sign * this.cfg.slippagePerUnit;
      const fee = Math.abs(o.qty) * this.cfg.feePerUnit;
      return { agentId: o.agentId, qty: o.qty, price: fillPrice, fee };
    });

    return { midAfter, fills };
  }
}
