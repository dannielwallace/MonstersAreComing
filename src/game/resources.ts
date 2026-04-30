export type ResourceType = 'wood' | 'stone' | 'gold' | 'xp';
export type WalletResourceType = ResourceType | 'meta';

export type ResourceAmounts = Partial<Record<WalletResourceType, number>>;

export interface ResourceWallet {
  wood: number;
  stone: number;
  gold: number;
  xp: number;
  meta: number;
}

export interface CarriedResources {
  wood: number;
  stone: number;
  gold: number;
  xp: number;
}

export interface HarvestableNode {
  id: string;
  type: ResourceType;
  remaining: number;
}

export interface HarvestResult {
  node: HarvestableNode;
  gathered: { type: ResourceType; amount: number };
  depleted: boolean;
}

export function createResourceWallet(): ResourceWallet {
  return { wood: 0, stone: 0, gold: 0, xp: 0, meta: 0 };
}

export function createCarriedResources(): CarriedResources {
  return { wood: 0, stone: 0, gold: 0, xp: 0 };
}

function cleanAmount(amount: number): number {
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function isValidCost(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

function safeHealth(health: number): number {
  return Number.isFinite(health) ? health : 0;
}

export function addCarriedResource(
  carried: CarriedResources,
  type: ResourceType,
  amount: number,
): CarriedResources {
  return { ...carried, [type]: carried[type] + cleanAmount(amount) };
}

export function depositCarriedResources(
  wallet: ResourceWallet,
  carried: CarriedResources,
): { wallet: ResourceWallet; carried: CarriedResources; deposited: CarriedResources } {
  return {
    wallet: {
      ...wallet,
      wood: wallet.wood + carried.wood,
      stone: wallet.stone + carried.stone,
      gold: wallet.gold + carried.gold,
      xp: wallet.xp + carried.xp,
    },
    carried: createCarriedResources(),
    deposited: { ...carried },
  };
}

export function canAfford(wallet: ResourceWallet, cost: ResourceAmounts): boolean {
  return (Object.entries(cost) as [WalletResourceType, number][]).every(
    ([type, amount]) => isValidCost(amount) && wallet[type] >= amount,
  );
}

export function spendResources(
  wallet: ResourceWallet,
  cost: ResourceAmounts,
): { ok: boolean; wallet: ResourceWallet } {
  if (!canAfford(wallet, cost)) {
    return { ok: false, wallet };
  }
  const next = { ...wallet };
  for (const [type, amount] of Object.entries(cost) as [WalletResourceType, number][]) {
    next[type] -= amount;
  }
  return { ok: true, wallet: next };
}

export function harvestNode(
  node: HarvestableNode,
  gatherRate: number,
  deltaSeconds: number,
): HarvestResult {
  const remaining = cleanAmount(node.remaining);
  const amount = Math.min(remaining, cleanAmount(gatherRate) * cleanAmount(deltaSeconds));
  const nextNode = { ...node, remaining: Math.max(0, remaining - amount) };
  return {
    node: nextNode,
    gathered: { type: node.type, amount },
    depleted: nextNode.remaining <= 0,
  };
}

export function repairCaravanWithStone(
  wallet: ResourceWallet,
  caravanHealth: number,
  caravanMaxHealth: number,
  healthPerStone: number,
): { wallet: ResourceWallet; caravanHealth: number; repaired: number } {
  const fallbackHealth = safeHealth(caravanHealth);
  if (
    !Number.isFinite(wallet.stone) ||
    !Number.isFinite(caravanHealth) ||
    !Number.isFinite(caravanMaxHealth) ||
    !Number.isFinite(healthPerStone) ||
    wallet.stone <= 0 ||
    healthPerStone <= 0
  ) {
    return { wallet, caravanHealth: fallbackHealth, repaired: 0 };
  }
  const missingHealth = Math.max(0, caravanMaxHealth - caravanHealth);
  if (missingHealth <= 0) {
    return { wallet, caravanHealth: fallbackHealth, repaired: 0 };
  }
  const stoneNeeded = Math.ceil(missingHealth / healthPerStone);
  const stoneSpent = Math.min(wallet.stone, stoneNeeded);
  const repaired = Math.min(missingHealth, stoneSpent * healthPerStone);
  return {
    wallet: { ...wallet, stone: wallet.stone - stoneSpent },
    caravanHealth: caravanHealth + repaired,
    repaired,
  };
}
