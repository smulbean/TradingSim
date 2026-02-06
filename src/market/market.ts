// src/market/market.ts
import { RNG } from "./rng.js";
import { pickRegime } from "./regimes.js";
import type { Regime } from "./regimes.js";

export type MarketConfig = {
  seed: number;
  startFair: number;
  startPrice: number;

  // regime switching
  switchProb: number;

  // fair value dynamics
  trendDrift: number;      // per step
  meanRevertK: number;     // strength toward anchor
  anchor: number;          // long-run level for mean reversion
  fairNoiseStd: number;    // noise on fair value

  // observed price microstructure
  microNoiseStd: number;
};

export type MarketStep = {
  t: number;
  regime: Regime;
  fair: number;     // hidden fair value F_t
  price: number;    // observed P_t
  fairReturn: number;
  priceReturn: number;
};

export class Market {
  private rng: RNG;
  private t = 0;
  private regime: Regime = "CHOP";
  private fair: number;
  private price: number;

  constructor(private cfg: MarketConfig) {
    this.rng = new RNG(cfg.seed);
    this.fair = cfg.startFair;
    this.price = cfg.startPrice;
    this.regime = pickRegime(this.rng.nextFloat());
  }

  step(): MarketStep {
    this.t += 1;

    // Possibly switch regime
    if (this.rng.nextFloat() < this.cfg.switchProb) {
      this.regime = pickRegime(this.rng.nextFloat());
    }

    const prevFair = this.fair;
    const prevPrice = this.price;

    // Regime-dependent drift term
    let drift = 0;
    if (this.regime === "TREND") {
      drift = this.cfg.trendDrift;
    } else if (this.regime === "MEANREV") {
      drift = -this.cfg.meanRevertK * (this.fair - this.cfg.anchor);
    } else {
      drift = 0;
    }

    // Hidden fair value evolution
    this.fair = this.fair + drift + this.rng.nextGaussian(0, this.cfg.fairNoiseStd);

    // Observed price
    this.price = this.fair + this.rng.nextGaussian(0, this.cfg.microNoiseStd);

    const fairReturn = this.fair - prevFair;
    const priceReturn = this.price - prevPrice;

    return {
      t: this.t,
      regime: this.regime,
      fair: this.fair,
      price: this.price,
      fairReturn,
      priceReturn,
    };
  }
}
