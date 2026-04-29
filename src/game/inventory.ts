export interface SpendResult {
  ok: boolean;
  wood: number;
}

export function addWood(currentWood: number, gatheredAmount: number): number {
  if (!Number.isFinite(gatheredAmount) || gatheredAmount <= 0) {
    return currentWood;
  }

  return currentWood + gatheredAmount;
}

export function canSpendWood(currentWood: number, cost: number): boolean {
  return Number.isFinite(currentWood) && Number.isFinite(cost) && cost > 0 && currentWood >= cost;
}

export function spendWood(currentWood: number, cost: number): SpendResult {
  if (!canSpendWood(currentWood, cost)) {
    return { ok: false, wood: currentWood };
  }

  return { ok: true, wood: currentWood - cost };
}
