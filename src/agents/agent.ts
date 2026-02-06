export type MarketObs = {
  t: number;
  price: number;
};

export type Order = {
  agentId: string;
  qty: number; // +buy, -sell
};

export type Quote = {
  agentId: string;
  bid: number;
  ask: number;
  size: number;
};

export type Fill = {
  agentId: string;
  qty: number;
  price: number;
  fee: number;
};

export type AgentSnapshot = {
  agentId: string;
  cash: number;
  pos: number;
  equity: number;
  turnover: number;
  maxDrawdown: number;
};

export interface Agent {
  id: string;
  observe(obs: MarketObs): Order[];
  onFill(fill: Fill): void;
  markToMarket(price: number): void;
  snapshot(price: number): AgentSnapshot;
}
