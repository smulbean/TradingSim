// src/market/rng.ts
export class RNG {
  private state: number;

  constructor(seed: number) {
    // force uint32
    this.state = seed >>> 0;
  }

  // LCG: fast deterministic RNG (not cryptographic)
  nextU32(): number {
    // Numerical Recipes LCG
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state;
  }

  nextFloat(): number {
    // [0,1)
    return this.nextU32() / 0x100000000;
  }

  // Box-Muller
  nextGaussian(mean = 0, std = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = this.nextFloat();
    while (v === 0) v = this.nextFloat();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + std * z;
  }
}
