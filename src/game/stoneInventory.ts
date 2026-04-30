import type { SpendResult } from './inventory';

export function addStone(currentStone: number, gatheredAmount: number): number {
  if (!Number.isFinite(gatheredAmount) || gatheredAmount <= 0) {
    return currentStone;
  }

  return currentStone + gatheredAmount;
}

export function canSpendStone(currentStone: number, cost: number): boolean {
  return (
    Number.isFinite(currentStone) &&
    Number.isFinite(cost) &&
    cost > 0 &&
    currentStone >= cost
  );
}

export function spendStone(currentStone: number, cost: number): SpendResult {
  if (!canSpendStone(currentStone, cost)) {
    return { ok: false, wood: currentStone };
  }

  return { ok: true, wood: currentStone - cost };
}
