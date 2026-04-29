export interface SpendResult {
  ok: boolean;
  wood: number;
}

export function addWood(currentWood: number, gatheredAmount: number): number {
  return Math.floor(currentWood + gatheredAmount);
}

export function canSpendWood(currentWood: number, cost: number): boolean {
  return currentWood >= cost;
}

export function spendWood(currentWood: number, cost: number): SpendResult {
  if (!canSpendWood(currentWood, cost)) {
    return { ok: false, wood: currentWood };
  }

  return { ok: true, wood: currentWood - cost };
}
