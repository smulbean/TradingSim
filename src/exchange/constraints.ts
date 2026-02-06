export type Constraints = {
  positionLimit: number;
  maxLeverage: number; // notional/equity
};

export function clampOrderQty(params: {
  qty: number;
  pos: number;
  price: number;
  equity: number;
  constraints: Constraints;
}): number {
  const { constraints } = params;
  let qty = params.qty;

  // Position limit clamp
  const newPos = params.pos + qty;
  if (Math.abs(newPos) > constraints.positionLimit) {
    const allowed = constraints.positionLimit - Math.abs(params.pos);
    qty = Math.sign(qty) * Math.max(0, allowed);
  }
  if (qty === 0) return 0;

  // Leverage clamp (approx)
  const equityAfter = params.equity; // before fill; simple guard
  if (equityAfter <= 0) return 0;

  const newPos2 = params.pos + qty;
  const notional = Math.abs(newPos2 * params.price);
  if (notional / equityAfter > constraints.maxLeverage) {
    // reduce qty until leverage ok
    const maxNotional = constraints.maxLeverage * equityAfter;
    const maxPos = maxNotional / Math.max(params.price, 1e-9);
    const clippedPos = Math.sign(newPos2) * Math.min(Math.abs(newPos2), maxPos);
    qty = Math.round(clippedPos - params.pos);
  }

  return qty;
}
