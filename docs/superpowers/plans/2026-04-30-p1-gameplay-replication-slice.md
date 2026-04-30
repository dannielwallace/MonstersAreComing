# P1 Gameplay Replication Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable 10-15 minute moving-city tower-survivor slice with carried resources, gold shop, expanded buildings, weapons, summons, map events, Boss pressure, and detailed results.

**Architecture:** Keep game rules in small pure TypeScript modules under `src/game`, then wire them into `GameScene.ts` in thin integration passes. `GameScene.ts` remains responsible for Phaser visuals, input, UI, tweens, and object lifetime, while new modules own deterministic rules that can be tested with Vitest.

**Tech Stack:** Phaser 3.90, TypeScript, Vite, Vitest, Playwright.

---

## Scope Check

The approved P1 spec spans several subsystems. This plan keeps one vertical-slice plan because each task leaves the project testable and the final tasks integrate those subsystems into one playable loop.

## File Map

- Create `src/game/resources.ts`: resource wallet, carried resources, deposit, repair, node harvest rules.
- Create `tests/resources.test.ts`: resource and deposit rule tests.
- Create `src/game/buildings.ts`: expanded building definitions, costs, adjacency bonuses, build affordability.
- Modify `src/game/buildSlots.ts`: import `BuildingType` from `buildings.ts` and read names/costs from the catalog.
- Create `tests/buildings.test.ts`: catalog, affordability, adjacency tests.
- Create `src/game/shop.ts`: shop stock generation, reroll, purchase flow.
- Create `tests/shop.test.ts`: deterministic stock and purchase tests.
- Create `src/game/weapons.ts`: hero weapon definitions, upgrades, cooldown updates, target selection.
- Create `tests/weapons.test.ts`: weapon upgrade and attack tests.
- Create `src/game/summons.ts`: minion definitions, spawn/update/death-effect rules.
- Create `tests/summons.test.ts`: minion behavior tests.
- Create `src/game/events.ts`: reward circle, chest, fork reward, event scheduling.
- Create `tests/events.test.ts`: event timer and reward tests.
- Create `src/game/boss.ts`: Boss phase state and spawn triggers.
- Create `tests/boss.test.ts`: Boss phase tests.
- Create `src/game/results.ts`: run-stat accumulator and result formatting data.
- Modify `src/game/victory.ts`: delegate result summary data to `results.ts` while preserving current text path until scene integration is complete.
- Create `tests/results.test.ts`: damage and result aggregation tests.
- Modify `src/game/upgrades.ts`: add upgrade IDs that award building cards, weapon upgrades, hero stats, city stats, and summon stats.
- Modify `src/scenes/GameScene.ts`: integrate modules in narrow passes.
- Modify `e2e/game.spec.ts`: verify resource deposit, build/shop visibility, minion/Boss/result surface.

## Task 1: Resource Wallet, Carry, Deposit, and Repair Rules

**Files:**
- Create: `src/game/resources.ts`
- Create: `tests/resources.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/resources.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addCarriedResource,
  createCarriedResources,
  createResourceWallet,
  depositCarriedResources,
  harvestNode,
  repairCaravanWithStone,
  spendResources,
  type HarvestableNode,
} from '../src/game/resources';

describe('resource wallet', () => {
  it('creates an empty wallet and carry bag', () => {
    expect(createResourceWallet()).toEqual({ wood: 0, stone: 0, gold: 0, xp: 0, meta: 0 });
    expect(createCarriedResources()).toEqual({ wood: 0, stone: 0, gold: 0, xp: 0 });
  });

  it('adds finite positive carried amounts only', () => {
    const carried = addCarriedResource(createCarriedResources(), 'wood', 5);
    expect(addCarriedResource(carried, 'wood', -2)).toEqual({ wood: 5, stone: 0, gold: 0, xp: 0 });
  });

  it('deposits carried resources into wallet and clears carried state', () => {
    const result = depositCarriedResources(
      { wood: 2, stone: 3, gold: 4, xp: 5, meta: 1 },
      { wood: 10, stone: 20, gold: 30, xp: 40 },
    );
    expect(result.wallet).toEqual({ wood: 12, stone: 23, gold: 34, xp: 45, meta: 1 });
    expect(result.carried).toEqual({ wood: 0, stone: 0, gold: 0, xp: 0 });
    expect(result.deposited).toEqual({ wood: 10, stone: 20, gold: 30, xp: 40 });
  });

  it('spends multiple resource costs atomically', () => {
    expect(spendResources({ wood: 20, stone: 5, gold: 10, xp: 0, meta: 0 }, { wood: 15, gold: 8 })).toEqual({
      ok: true,
      wallet: { wood: 5, stone: 5, gold: 2, xp: 0, meta: 0 },
    });
    expect(spendResources({ wood: 4, stone: 5, gold: 10, xp: 0, meta: 0 }, { wood: 15, gold: 8 })).toEqual({
      ok: false,
      wallet: { wood: 4, stone: 5, gold: 10, xp: 0, meta: 0 },
    });
  });

  it('harvests from a node without going below zero', () => {
    const node: HarvestableNode = { id: 'tree-1', type: 'wood', remaining: 4 };
    const result = harvestNode(node, 10, 0.5);
    expect(result.node.remaining).toBe(0);
    expect(result.gathered).toEqual({ type: 'wood', amount: 4 });
    expect(result.depleted).toBe(true);
  });

  it('repairs caravan using stone and caps at max health', () => {
    const result = repairCaravanWithStone({ wood: 0, stone: 10, gold: 0, xp: 0, meta: 0 }, 70, 100, 2);
    expect(result).toEqual({
      wallet: { wood: 0, stone: 0, gold: 0, xp: 0, meta: 0 },
      caravanHealth: 90,
      repaired: 20,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/resources.test.ts`

Expected: FAIL with an import error for `../src/game/resources`.

- [ ] **Step 3: Add resource rules**

Create `src/game/resources.ts`:

```ts
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
  return (Object.entries(cost) as [WalletResourceType, number][]).every(([type, amount]) => {
    const normalized = cleanAmount(amount);
    return normalized === 0 || wallet[type] >= normalized;
  });
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
    next[type] -= cleanAmount(amount);
  }
  return { ok: true, wallet: next };
}

export function harvestNode(
  node: HarvestableNode,
  gatherRate: number,
  deltaSeconds: number,
): HarvestResult {
  const amount = Math.min(node.remaining, cleanAmount(gatherRate) * cleanAmount(deltaSeconds));
  const nextNode = { ...node, remaining: Math.max(0, node.remaining - amount) };
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
  if (wallet.stone <= 0 || caravanHealth >= caravanMaxHealth || healthPerStone <= 0) {
    return { wallet, caravanHealth, repaired: 0 };
  }
  const missingHealth = Math.max(0, caravanMaxHealth - caravanHealth);
  const stoneNeeded = Math.ceil(missingHealth / healthPerStone);
  const stoneSpent = Math.min(wallet.stone, stoneNeeded);
  const repaired = Math.min(missingHealth, stoneSpent * healthPerStone);
  return {
    wallet: { ...wallet, stone: wallet.stone - stoneSpent },
    caravanHealth: caravanHealth + repaired,
    repaired,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/resources.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/resources.ts tests/resources.test.ts
git commit -m "feat: add resource wallet rules"
```

## Task 2: Building Catalog and Adjacency Rules

**Files:**
- Create: `src/game/buildings.ts`
- Modify: `src/game/buildSlots.ts`
- Create: `tests/buildings.test.ts`
- Modify: `tests/buildSlots.test.ts`

- [ ] **Step 1: Write failing building tests**

Create `tests/buildings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  BUILDING_DEFINITIONS,
  canBuild,
  computeAdjacencyBonus,
  getAdjacentSlotIds,
  getBuildingCostText,
  getBuildingDefinition,
} from '../src/game/buildings';
import { GRID_BUILD_SLOTS } from '../src/game/buildSlots';
import type { ResourceWallet } from '../src/game/resources';

describe('building catalog', () => {
  it('defines the eight P1 building types', () => {
    expect(Object.keys(BUILDING_DEFINITIONS).sort()).toEqual([
      'arrow',
      'attack-banner',
      'blast-minion',
      'catapult',
      'fire',
      'ice',
      'minion',
      'speed-banner',
      'wall',
    ].sort());
  });

  it('returns safe undefined for unknown building ids', () => {
    expect(getBuildingDefinition('missing')).toBeUndefined();
  });

  it('formats mixed resource costs', () => {
    expect(getBuildingCostText('catapult')).toBe('25 木材, 10 石料');
    expect(getBuildingCostText('fire')).toBe('20 木材, 8 金币');
  });

  it('checks affordability using the resource wallet', () => {
    const wallet: ResourceWallet = { wood: 25, stone: 10, gold: 8, xp: 0, meta: 0 };
    expect(canBuild(wallet, 'fire')).toBe(true);
    expect(canBuild({ ...wallet, gold: 7 }, 'fire')).toBe(false);
  });
});

describe('building adjacency', () => {
  it('returns orthogonal adjacent slot ids', () => {
    expect(getAdjacentSlotIds('cell-0--1', GRID_BUILD_SLOTS).sort()).toEqual([
      'cell--1--1',
      'cell-1--1',
    ]);
  });

  it('computes support bonuses from neighboring banners', () => {
    const bonus = computeAdjacencyBonus('cell-0--1', GRID_BUILD_SLOTS, [
      { slotId: 'cell--1--1', type: 'attack-banner' },
      { slotId: 'cell-1--1', type: 'speed-banner' },
      { slotId: 'cell--1-0', type: 'fire' },
    ]);
    expect(bonus).toEqual({ damageMultiplier: 1.35, fireIntervalMultiplier: 0.75 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/buildings.test.ts`

Expected: FAIL with an import error for `../src/game/buildings`.

- [ ] **Step 3: Add building catalog**

Create `src/game/buildings.ts`:

```ts
import { canAfford, spendResources, type ResourceAmounts, type ResourceWallet } from './resources';

export interface GridSlotRef {
  id: string;
  gridOffset: {
    col: number;
    row: number;
  };
}

export type BuildingType =
  | 'arrow'
  | 'catapult'
  | 'wall'
  | 'fire'
  | 'ice'
  | 'minion'
  | 'blast-minion'
  | 'attack-banner'
  | 'speed-banner';

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  shortLabel: string;
  category: 'attack' | 'defense' | 'summon' | 'support';
  cost: ResourceAmounts;
  range: number;
  damage: number;
  fireInterval: number;
  splashRadius: number;
  summonType?: 'basic' | 'bomber';
  support?: {
    damageMultiplier?: number;
    fireIntervalMultiplier?: number;
  };
}

export interface PlacedBuilding {
  slotId: string;
  type: BuildingType;
}

export interface AdjacencyBonus {
  damageMultiplier: number;
  fireIntervalMultiplier: number;
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  arrow: {
    type: 'arrow', name: '箭塔', shortLabel: '箭', category: 'attack',
    cost: { wood: 20 }, range: 190, damage: 10, fireInterval: 0.55, splashRadius: 0,
  },
  catapult: {
    type: 'catapult', name: '投石车', shortLabel: '投', category: 'attack',
    cost: { wood: 25, stone: 10 }, range: 180, damage: 25, fireInterval: 1.8, splashRadius: 60,
  },
  wall: {
    type: 'wall', name: '城墙', shortLabel: '墙', category: 'defense',
    cost: { wood: 15 }, range: 0, damage: 0, fireInterval: 0, splashRadius: 0,
  },
  fire: {
    type: 'fire', name: '火塔', shortLabel: '火', category: 'attack',
    cost: { wood: 20, gold: 8 }, range: 155, damage: 8, fireInterval: 0.35, splashRadius: 34,
  },
  ice: {
    type: 'ice', name: '冰塔', shortLabel: '冰', category: 'attack',
    cost: { stone: 14, gold: 6 }, range: 170, damage: 4, fireInterval: 0.75, splashRadius: 0,
  },
  minion: {
    type: 'minion', name: '召唤塔', shortLabel: '召', category: 'summon',
    cost: { wood: 18, gold: 10 }, range: 0, damage: 0, fireInterval: 3.5, splashRadius: 0, summonType: 'basic',
  },
  'blast-minion': {
    type: 'blast-minion', name: '爆仆塔', shortLabel: '爆仆', category: 'summon',
    cost: { stone: 18, gold: 12 }, range: 0, damage: 0, fireInterval: 5, splashRadius: 0, summonType: 'bomber',
  },
  'attack-banner': {
    type: 'attack-banner', name: '战旗', shortLabel: '伤', category: 'support',
    cost: { wood: 12, gold: 12 }, range: 0, damage: 0, fireInterval: 0, splashRadius: 0,
    support: { damageMultiplier: 1.35 },
  },
  'speed-banner': {
    type: 'speed-banner', name: '鼓楼', shortLabel: '速', category: 'support',
    cost: { wood: 12, gold: 12 }, range: 0, damage: 0, fireInterval: 0, splashRadius: 0,
    support: { fireIntervalMultiplier: 0.75 },
  },
};

export function getBuildingDefinition(type: string): BuildingDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(BUILDING_DEFINITIONS, type)
    ? BUILDING_DEFINITIONS[type as BuildingType]
    : undefined;
}

export function getBuildingCostText(type: BuildingType): string {
  const cost = BUILDING_DEFINITIONS[type].cost;
  const parts: string[] = [];
  if (cost.wood) parts.push(`${cost.wood} 木材`);
  if (cost.stone) parts.push(`${cost.stone} 石料`);
  if (cost.gold) parts.push(`${cost.gold} 金币`);
  return parts.join(', ');
}

export function canBuild(wallet: ResourceWallet, type: BuildingType): boolean {
  return canAfford(wallet, BUILDING_DEFINITIONS[type].cost);
}

export function spendBuildingCost(wallet: ResourceWallet, type: BuildingType): { ok: boolean; wallet: ResourceWallet } {
  return spendResources(wallet, BUILDING_DEFINITIONS[type].cost);
}

function slotKeyToCoord(slotId: string, slots: GridSlotRef[]): { col: number; row: number } | undefined {
  const slot = slots.find((candidate) => candidate.id === slotId);
  return slot ? slot.gridOffset : undefined;
}

export function getAdjacentSlotIds(slotId: string, slots: GridSlotRef[]): string[] {
  const coord = slotKeyToCoord(slotId, slots);
  if (!coord) return [];
  return slots
    .filter((slot) => Math.abs(slot.gridOffset.col - coord.col) + Math.abs(slot.gridOffset.row - coord.row) === 1)
    .map((slot) => slot.id);
}

export function computeAdjacencyBonus(slotId: string, slots: GridSlotRef[], buildings: PlacedBuilding[]): AdjacencyBonus {
  const adjacent = new Set(getAdjacentSlotIds(slotId, slots));
  let damageMultiplier = 1;
  let fireIntervalMultiplier = 1;
  for (const building of buildings) {
    if (!adjacent.has(building.slotId)) continue;
    const support = BUILDING_DEFINITIONS[building.type].support;
    if (support?.damageMultiplier) damageMultiplier *= support.damageMultiplier;
    if (support?.fireIntervalMultiplier) fireIntervalMultiplier *= support.fireIntervalMultiplier;
  }
  return { damageMultiplier, fireIntervalMultiplier };
}
```

- [ ] **Step 4: Update build slots to use the catalog**

Modify `src/game/buildSlots.ts`:

```ts
import {
  getBuildingCostText as getCatalogCostText,
  getBuildingDefinition,
  type BuildingType,
} from './buildings';
import type { Point } from './math';
```

Remove the local `BuildingType` union, keep `BuildSlot`, and replace the name/cost functions:

```ts
export function getBuildingName(type: BuildingType): string {
  return getBuildingDefinition(type)?.name ?? type;
}

export function getBuildingCostText(type: BuildingType): string {
  return getCatalogCostText(type);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/buildings.test.ts tests/buildSlots.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/buildings.ts src/game/buildSlots.ts tests/buildings.test.ts tests/buildSlots.test.ts
git commit -m "feat: add expanded building catalog"
```

## Task 3: Shop Stock, Purchase, and Reroll Rules

**Files:**
- Create: `src/game/shop.ts`
- Create: `tests/shop.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/shop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createShopState,
  purchaseShopItem,
  rerollShop,
  type ShopItem,
} from '../src/game/shop';

const pool: ShopItem[] = [
  { id: 'b-fire', kind: 'building', buildingType: 'fire', name: '火塔', cost: { gold: 8 } },
  { id: 'w-saw', kind: 'weapon', weaponType: 'saw', name: '旋锯', cost: { gold: 10 } },
  { id: 'heal', kind: 'repair', repairAmount: 25, name: '修理', cost: { stone: 5 } },
  { id: 'gold', kind: 'resource', grant: { gold: 5 }, name: '金币包', cost: {} },
];

describe('shop', () => {
  it('creates deterministic stock', () => {
    const shop = createShopState(pool, 3, () => 0);
    expect(shop.stock.map((item) => item.id)).toEqual(['b-fire', 'w-saw', 'heal']);
    expect(shop.rerollCost).toBe(5);
  });

  it('purchases an affordable item and removes it from stock', () => {
    const shop = createShopState(pool, 3, () => 0);
    const result = purchaseShopItem(shop, { wood: 0, stone: 5, gold: 8, xp: 0, meta: 0 }, 'b-fire');
    expect(result.ok).toBe(true);
    expect(result.wallet).toEqual({ wood: 0, stone: 5, gold: 0, xp: 0, meta: 0 });
    expect(result.shop.stock.map((item) => item.id)).toEqual(['w-saw', 'heal']);
    expect(result.item?.id).toBe('b-fire');
  });

  it('does not buy missing or unaffordable items', () => {
    const shop = createShopState(pool, 3, () => 0);
    expect(purchaseShopItem(shop, { wood: 0, stone: 0, gold: 0, xp: 0, meta: 0 }, 'b-fire').ok).toBe(false);
    expect(purchaseShopItem(shop, { wood: 0, stone: 0, gold: 99, xp: 0, meta: 0 }, 'missing').ok).toBe(false);
  });

  it('rerolls stock and increases reroll cost', () => {
    const shop = createShopState(pool, 2, () => 0);
    const result = rerollShop(shop, { wood: 0, stone: 0, gold: 5, xp: 0, meta: 0 }, () => 0.75);
    expect(result.ok).toBe(true);
    expect(result.wallet.gold).toBe(0);
    expect(result.shop.rerollCost).toBe(8);
    expect(result.shop.stock).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/shop.test.ts`

Expected: FAIL with an import error for `../src/game/shop`.

- [ ] **Step 3: Add shop rules**

Create `src/game/shop.ts`:

```ts
import type { BuildingType } from './buildings';
import { spendResources, type ResourceAmounts, type ResourceWallet } from './resources';

export type ShopItemKind = 'building' | 'weapon' | 'repair' | 'resource';

export interface ShopItem {
  id: string;
  kind: ShopItemKind;
  name: string;
  cost: ResourceAmounts;
  buildingType?: BuildingType;
  weaponType?: 'axe' | 'saw' | 'ritual-dagger' | 'drill';
  repairAmount?: number;
  grant?: ResourceAmounts;
}

export interface ShopState {
  stock: ShopItem[];
  pool: ShopItem[];
  stockSize: number;
  rerollCost: number;
}

export const DEFAULT_SHOP_POOL: ShopItem[] = [
  { id: 'shop-arrow', kind: 'building', buildingType: 'arrow', name: '箭塔', cost: { gold: 6 } },
  { id: 'shop-fire', kind: 'building', buildingType: 'fire', name: '火塔', cost: { gold: 8 } },
  { id: 'shop-ice', kind: 'building', buildingType: 'ice', name: '冰塔', cost: { gold: 8 } },
  { id: 'shop-minion', kind: 'building', buildingType: 'minion', name: '召唤塔', cost: { gold: 10 } },
  { id: 'shop-saw', kind: 'weapon', weaponType: 'saw', name: '旋锯', cost: { gold: 10 } },
  { id: 'shop-dagger', kind: 'weapon', weaponType: 'ritual-dagger', name: '仪式弹', cost: { gold: 12 } },
  { id: 'shop-repair', kind: 'repair', repairAmount: 25, name: '修理行城', cost: { stone: 5 } },
  { id: 'shop-gold-cache', kind: 'resource', grant: { gold: 6 }, name: '金币箱', cost: {} },
];

function pickStock(pool: ShopItem[], stockSize: number, random: () => number): ShopItem[] {
  const candidates = [...pool];
  const stock: ShopItem[] = [];
  while (stock.length < stockSize && candidates.length > 0) {
    const index = Math.min(candidates.length - 1, Math.floor(Math.max(0, Math.min(0.999999, random())) * candidates.length));
    const [item] = candidates.splice(index, 1);
    stock.push(item);
  }
  return stock;
}

export function createShopState(
  pool: ShopItem[] = DEFAULT_SHOP_POOL,
  stockSize = 4,
  random: () => number = Math.random,
): ShopState {
  return {
    stock: pickStock(pool, stockSize, random),
    pool,
    stockSize,
    rerollCost: 5,
  };
}

export function purchaseShopItem(
  shop: ShopState,
  wallet: ResourceWallet,
  itemId: string,
): { ok: boolean; shop: ShopState; wallet: ResourceWallet; item?: ShopItem } {
  const item = shop.stock.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, shop, wallet };
  const spent = spendResources(wallet, item.cost);
  if (!spent.ok) return { ok: false, shop, wallet };
  return {
    ok: true,
    wallet: spent.wallet,
    item,
    shop: { ...shop, stock: shop.stock.filter((candidate) => candidate.id !== itemId) },
  };
}

export function rerollShop(
  shop: ShopState,
  wallet: ResourceWallet,
  random: () => number = Math.random,
): { ok: boolean; shop: ShopState; wallet: ResourceWallet } {
  const spent = spendResources(wallet, { gold: shop.rerollCost });
  if (!spent.ok) return { ok: false, shop, wallet };
  return {
    ok: true,
    wallet: spent.wallet,
    shop: {
      ...shop,
      stock: pickStock(shop.pool, shop.stockSize, random),
      rerollCost: shop.rerollCost + 3,
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/shop.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/shop.ts tests/shop.test.ts
git commit -m "feat: add shop purchase rules"
```

## Task 4: Weapon Definitions and Attack Rules

**Files:**
- Create: `src/game/weapons.ts`
- Create: `tests/weapons.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/weapons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addWeapon,
  createWeaponState,
  getWeaponDefinition,
  updateWeaponTimers,
  upgradeWeapon,
} from '../src/game/weapons';

describe('weapons', () => {
  it('starts with the axe weapon', () => {
    expect(createWeaponState().owned.map((weapon) => weapon.type)).toEqual(['axe']);
  });

  it('adds a missing weapon but does not duplicate owned weapons', () => {
    const state = addWeapon(createWeaponState(), 'saw');
    expect(addWeapon(state, 'saw').owned.filter((weapon) => weapon.type === 'saw')).toHaveLength(1);
  });

  it('upgrades damage and cooldown multipliers', () => {
    const state = upgradeWeapon(addWeapon(createWeaponState(), 'saw'), 'saw', { damageMultiplier: 1.5, cooldownMultiplier: 0.8 });
    const saw = state.owned.find((weapon) => weapon.type === 'saw')!;
    expect(saw.damageMultiplier).toBeCloseTo(1.5);
    expect(saw.cooldownMultiplier).toBeCloseTo(0.8);
  });

  it('reduces weapon timers without going below zero', () => {
    const state = addWeapon(createWeaponState(), 'saw');
    state.owned[0].cooldownTimer = 0.2;
    expect(updateWeaponTimers(state, 1).owned[0].cooldownTimer).toBe(0);
  });

  it('returns undefined for unknown definitions', () => {
    expect(getWeaponDefinition('missing')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/weapons.test.ts`

Expected: FAIL with an import error for `../src/game/weapons`.

- [ ] **Step 3: Add weapons module**

Create `src/game/weapons.ts`:

```ts
export type WeaponType = 'axe' | 'saw' | 'ritual-dagger' | 'drill';

export interface WeaponDefinition {
  type: WeaponType;
  name: string;
  range: number;
  damage: number;
  cooldown: number;
  hitCount: number;
  createsMinionOnKill?: boolean;
  harvestMultiplier?: number;
}

export interface OwnedWeapon {
  type: WeaponType;
  cooldownTimer: number;
  damageMultiplier: number;
  cooldownMultiplier: number;
  rangeBonus: number;
}

export interface WeaponState {
  owned: OwnedWeapon[];
}

export interface WeaponUpgrade {
  damageMultiplier?: number;
  cooldownMultiplier?: number;
  rangeBonus?: number;
}

export const WEAPON_DEFINITIONS: Record<WeaponType, WeaponDefinition> = {
  axe: { type: 'axe', name: '斧头', range: 56, damage: 8, cooldown: 0.6, hitCount: 3, harvestMultiplier: 1.2 },
  saw: { type: 'saw', name: '旋锯', range: 80, damage: 5, cooldown: 0.35, hitCount: 6, harvestMultiplier: 1.8 },
  'ritual-dagger': { type: 'ritual-dagger', name: '仪式弹', range: 160, damage: 7, cooldown: 0.7, hitCount: 1, createsMinionOnKill: true },
  drill: { type: 'drill', name: '钻头', range: 110, damage: 14, cooldown: 0.9, hitCount: 2, harvestMultiplier: 2.2 },
};

export function getWeaponDefinition(type: string): WeaponDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(WEAPON_DEFINITIONS, type)
    ? WEAPON_DEFINITIONS[type as WeaponType]
    : undefined;
}

function createOwnedWeapon(type: WeaponType): OwnedWeapon {
  return { type, cooldownTimer: 0, damageMultiplier: 1, cooldownMultiplier: 1, rangeBonus: 0 };
}

export function createWeaponState(): WeaponState {
  return { owned: [createOwnedWeapon('axe')] };
}

export function addWeapon(state: WeaponState, type: WeaponType): WeaponState {
  if (state.owned.some((weapon) => weapon.type === type)) return state;
  return { owned: [...state.owned, createOwnedWeapon(type)] };
}

export function upgradeWeapon(state: WeaponState, type: WeaponType, upgrade: WeaponUpgrade): WeaponState {
  return {
    owned: state.owned.map((weapon) => {
      if (weapon.type !== type) return weapon;
      return {
        ...weapon,
        damageMultiplier: weapon.damageMultiplier * (upgrade.damageMultiplier ?? 1),
        cooldownMultiplier: weapon.cooldownMultiplier * (upgrade.cooldownMultiplier ?? 1),
        rangeBonus: weapon.rangeBonus + (upgrade.rangeBonus ?? 0),
      };
    }),
  };
}

export function updateWeaponTimers(state: WeaponState, deltaSeconds: number): WeaponState {
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  return {
    owned: state.owned.map((weapon) => ({
      ...weapon,
      cooldownTimer: Math.max(0, weapon.cooldownTimer - delta),
    })),
  };
}

export function markWeaponFired(weapon: OwnedWeapon): OwnedWeapon {
  const definition = WEAPON_DEFINITIONS[weapon.type];
  return { ...weapon, cooldownTimer: definition.cooldown * weapon.cooldownMultiplier };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/weapons.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/weapons.ts tests/weapons.test.ts
git commit -m "feat: add weapon progression rules"
```

## Task 5: Summon and Minion Rules

**Files:**
- Create: `src/game/summons.ts`
- Create: `tests/summons.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/summons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createSummonState,
  getMinionDefinition,
  killMinion,
  spawnMinion,
  updateMinionLifetime,
} from '../src/game/summons';

describe('summons', () => {
  it('spawns minions with definitions and sequence ids', () => {
    const state = spawnMinion(createSummonState(), 'basic', { x: 10, y: 20 });
    expect(state.minions[0]).toMatchObject({ id: 'minion-0', type: 'basic', health: 18, position: { x: 10, y: 20 } });
    expect(state.nextId).toBe(1);
  });

  it('tracks temporary minion lifetime', () => {
    const state = spawnMinion(createSummonState(), 'decaying', { x: 0, y: 0 });
    expect(updateMinionLifetime(state, 8).minions).toHaveLength(0);
  });

  it('returns death effects for bomber minions', () => {
    const state = spawnMinion(createSummonState(), 'bomber', { x: 0, y: 0 });
    const result = killMinion(state, 'minion-0');
    expect(result.effects).toEqual([{ type: 'explosion', damage: 30, radius: 48, position: { x: 0, y: 0 } }]);
    expect(result.state.minions).toHaveLength(0);
  });

  it('returns undefined for unknown minion definitions', () => {
    expect(getMinionDefinition('missing')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/summons.test.ts`

Expected: FAIL with an import error for `../src/game/summons`.

- [ ] **Step 3: Add summon rules**

Create `src/game/summons.ts`:

```ts
import type { Point } from './math';

export type MinionType = 'basic' | 'bomber' | 'decaying';

export interface MinionDefinition {
  type: MinionType;
  name: string;
  health: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  lifetime?: number;
  deathExplosion?: { damage: number; radius: number };
}

export interface MinionState {
  id: string;
  type: MinionType;
  position: Point;
  health: number;
  attackTimer: number;
  lifetimeRemaining?: number;
}

export interface SummonState {
  minions: MinionState[];
  nextId: number;
  damageMultiplier: number;
}

export type MinionDeathEffect = {
  type: 'explosion';
  damage: number;
  radius: number;
  position: Point;
};

export const MINION_DEFINITIONS: Record<MinionType, MinionDefinition> = {
  basic: { type: 'basic', name: '仆从', health: 18, damage: 6, speed: 96, attackRange: 24, attackCooldown: 0.7 },
  bomber: {
    type: 'bomber', name: '爆仆', health: 10, damage: 0, speed: 118, attackRange: 20, attackCooldown: 1,
    deathExplosion: { damage: 30, radius: 48 },
  },
  decaying: { type: 'decaying', name: '残影', health: 8, damage: 5, speed: 110, attackRange: 22, attackCooldown: 0.6, lifetime: 7 },
};

export function getMinionDefinition(type: string): MinionDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(MINION_DEFINITIONS, type)
    ? MINION_DEFINITIONS[type as MinionType]
    : undefined;
}

export function createSummonState(): SummonState {
  return { minions: [], nextId: 0, damageMultiplier: 1 };
}

export function spawnMinion(state: SummonState, type: MinionType, position: Point): SummonState {
  const definition = MINION_DEFINITIONS[type];
  const minion: MinionState = {
    id: `minion-${state.nextId}`,
    type,
    position: { ...position },
    health: definition.health,
    attackTimer: 0,
    lifetimeRemaining: definition.lifetime,
  };
  return { ...state, minions: [...state.minions, minion], nextId: state.nextId + 1 };
}

export function updateMinionLifetime(state: SummonState, deltaSeconds: number): SummonState {
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  return {
    ...state,
    minions: state.minions
      .map((minion) => minion.lifetimeRemaining === undefined
        ? minion
        : { ...minion, lifetimeRemaining: minion.lifetimeRemaining - delta })
      .filter((minion) => minion.lifetimeRemaining === undefined || minion.lifetimeRemaining > 0),
  };
}

export function killMinion(
  state: SummonState,
  minionId: string,
): { state: SummonState; effects: MinionDeathEffect[] } {
  const minion = state.minions.find((candidate) => candidate.id === minionId);
  if (!minion) return { state, effects: [] };
  const explosion = MINION_DEFINITIONS[minion.type].deathExplosion;
  return {
    state: { ...state, minions: state.minions.filter((candidate) => candidate.id !== minionId) },
    effects: explosion
      ? [{ type: 'explosion', damage: explosion.damage, radius: explosion.radius, position: { ...minion.position } }]
      : [],
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/summons.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/summons.ts tests/summons.test.ts
git commit -m "feat: add summon rules"
```

## Task 6: Map Events and Boss Rules

**Files:**
- Create: `src/game/events.ts`
- Create: `src/game/boss.ts`
- Create: `tests/events.test.ts`
- Create: `tests/boss.test.ts`

- [ ] **Step 1: Write failing event and Boss tests**

Create `tests/events.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createRewardCircle,
  completeRewardCircle,
  createRouteEventState,
  updateRewardCircle,
} from '../src/game/events';

describe('route events', () => {
  it('creates a reward circle with a timer and reward', () => {
    expect(createRewardCircle('circle-1', { x: 100, y: 120 }, { gold: 12 }, 6)).toMatchObject({
      id: 'circle-1',
      kind: 'reward-circle',
      position: { x: 100, y: 120 },
      remaining: 6,
      reward: { gold: 12 },
      completed: false,
    });
  });

  it('only advances reward circles when occupied', () => {
    const event = createRewardCircle('circle-1', { x: 0, y: 0 }, { wood: 20 }, 3);
    expect(updateRewardCircle(event, 1, false).remaining).toBe(3);
    expect(updateRewardCircle(event, 1, true).remaining).toBe(2);
  });

  it('completes reward circles and grants once', () => {
    const event = updateRewardCircle(createRewardCircle('circle-1', { x: 0, y: 0 }, { gold: 5 }, 1), 2, true);
    expect(event.completed).toBe(true);
    expect(completeRewardCircle(event).reward).toEqual({ gold: 5 });
    expect(completeRewardCircle({ ...event, claimed: true }).reward).toEqual({});
  });

  it('starts with no active events', () => {
    expect(createRouteEventState()).toEqual({ active: [], nextId: 0 });
  });
});
```

Create `tests/boss.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createBossState,
  startBoss,
  updateBossState,
} from '../src/game/boss';

describe('boss state', () => {
  it('starts inactive', () => {
    expect(createBossState()).toEqual({ active: false, health: 0, maxHealth: 0, phase: 0, summonTimer: 0 });
  });

  it('starts with health and summon timer', () => {
    expect(startBoss(500)).toEqual({ active: true, health: 500, maxHealth: 500, phase: 1, summonTimer: 4 });
  });

  it('emits summon triggers on timer expiry', () => {
    const result = updateBossState(startBoss(500), 4.5);
    expect(result.spawnEggs).toBe(2);
    expect(result.state.summonTimer).toBe(5);
  });

  it('moves to phase two below half health', () => {
    const boss = { ...startBoss(500), health: 200 };
    expect(updateBossState(boss, 1).state.phase).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/events.test.ts tests/boss.test.ts`

Expected: FAIL with import errors for `events` and `boss`.

- [ ] **Step 3: Add event module**

Create `src/game/events.ts`:

```ts
import type { Point } from './math';
import type { ResourceAmounts } from './resources';

export type RouteEventKind = 'reward-circle' | 'chest' | 'fork-reward' | 'shop';

export interface RouteEvent {
  id: string;
  kind: RouteEventKind;
  position: Point;
  reward: ResourceAmounts;
  remaining: number;
  completed: boolean;
  claimed: boolean;
}

export interface RouteEventState {
  active: RouteEvent[];
  nextId: number;
}

export function createRouteEventState(): RouteEventState {
  return { active: [], nextId: 0 };
}

export function createRewardCircle(
  id: string,
  position: Point,
  reward: ResourceAmounts,
  duration = 6,
): RouteEvent {
  return {
    id,
    kind: 'reward-circle',
    position: { ...position },
    reward,
    remaining: duration,
    completed: false,
    claimed: false,
  };
}

export function updateRewardCircle(event: RouteEvent, deltaSeconds: number, occupied: boolean): RouteEvent {
  if (event.completed || !occupied) return event;
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const remaining = Math.max(0, event.remaining - delta);
  return { ...event, remaining, completed: remaining === 0 };
}

export function completeRewardCircle(event: RouteEvent): { event: RouteEvent; reward: ResourceAmounts } {
  if (!event.completed || event.claimed) {
    return { event, reward: {} };
  }
  return { event: { ...event, claimed: true }, reward: event.reward };
}
```

- [ ] **Step 4: Add Boss module**

Create `src/game/boss.ts`:

```ts
export interface BossState {
  active: boolean;
  health: number;
  maxHealth: number;
  phase: number;
  summonTimer: number;
}

export interface BossUpdateResult {
  state: BossState;
  spawnEggs: number;
}

export function createBossState(): BossState {
  return { active: false, health: 0, maxHealth: 0, phase: 0, summonTimer: 0 };
}

export function startBoss(maxHealth = 500): BossState {
  return { active: true, health: maxHealth, maxHealth, phase: 1, summonTimer: 4 };
}

export function updateBossState(state: BossState, deltaSeconds: number): BossUpdateResult {
  if (!state.active) return { state, spawnEggs: 0 };
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const phase = state.health <= state.maxHealth * 0.5 ? 2 : 1;
  const summonTimer = state.summonTimer - delta;
  if (summonTimer <= 0) {
    return {
      state: { ...state, phase, summonTimer: phase === 2 ? 3.5 : 5 },
      spawnEggs: phase === 2 ? 3 : 2,
    };
  }
  return { state: { ...state, phase, summonTimer }, spawnEggs: 0 };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/events.test.ts tests/boss.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/events.ts src/game/boss.ts tests/events.test.ts tests/boss.test.ts
git commit -m "feat: add route event and boss rules"
```

## Task 7: Result Statistics

**Files:**
- Create: `src/game/results.ts`
- Modify: `src/game/victory.ts`
- Create: `tests/results.test.ts`
- Modify: `tests/victory.test.ts`

- [ ] **Step 1: Write failing result tests**

Create `tests/results.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addBuildingDamage,
  addHeroDamage,
  createRunResults,
  formatBuildingDpsRows,
} from '../src/game/results';

describe('run results', () => {
  it('tracks hero and building damage separately', () => {
    const results = addBuildingDamage(addHeroDamage(createRunResults(), 20), 'tower-1', '箭塔', 30);
    expect(results.heroDamage).toBe(20);
    expect(results.cityDamage).toBe(30);
    expect(results.buildings['tower-1']).toEqual({ id: 'tower-1', name: '箭塔', damage: 30, kills: 0 });
  });

  it('formats building DPS rows sorted by damage', () => {
    let results = createRunResults();
    results = addBuildingDamage(results, 'a', '箭塔', 20);
    results = addBuildingDamage(results, 'b', '火塔', 60);
    expect(formatBuildingDpsRows(results, 10)).toEqual(['火塔 b：伤害 60 DPS 6.0 击杀 0', '箭塔 a：伤害 20 DPS 2.0 击杀 0']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/results.test.ts`

Expected: FAIL with an import error for `../src/game/results`.

- [ ] **Step 3: Add results module**

Create `src/game/results.ts`:

```ts
export interface BuildingResult {
  id: string;
  name: string;
  damage: number;
  kills: number;
}

export interface RunResults {
  heroDamage: number;
  cityDamage: number;
  buildings: Record<string, BuildingResult>;
}

export function createRunResults(): RunResults {
  return { heroDamage: 0, cityDamage: 0, buildings: {} };
}

function cleanDamage(damage: number): number {
  return Number.isFinite(damage) && damage > 0 ? damage : 0;
}

export function addHeroDamage(results: RunResults, damage: number): RunResults {
  return { ...results, heroDamage: results.heroDamage + cleanDamage(damage) };
}

export function addBuildingDamage(
  results: RunResults,
  id: string,
  name: string,
  damage: number,
): RunResults {
  const current = results.buildings[id] ?? { id, name, damage: 0, kills: 0 };
  const nextBuilding = { ...current, damage: current.damage + cleanDamage(damage) };
  return {
    ...results,
    cityDamage: results.cityDamage + cleanDamage(damage),
    buildings: { ...results.buildings, [id]: nextBuilding },
  };
}

export function addBuildingKill(results: RunResults, id: string): RunResults {
  const current = results.buildings[id];
  if (!current) return results;
  return {
    ...results,
    buildings: { ...results.buildings, [id]: { ...current, kills: current.kills + 1 } },
  };
}

export function formatBuildingDpsRows(results: RunResults, elapsedSeconds: number): string[] {
  const duration = Math.max(1, elapsedSeconds);
  return Object.values(results.buildings)
    .sort((a, b) => b.damage - a.damage)
    .map((building) => `${building.name} ${building.id}：伤害 ${Math.floor(building.damage)} DPS ${(building.damage / duration).toFixed(1)} 击杀 ${building.kills}`);
}
```

- [ ] **Step 4: Keep victory compatibility**

Modify `src/game/victory.ts` only if existing tests need new fields. Keep `formatVictoryStats` exported so current scene code keeps compiling.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/results.test.ts tests/victory.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/results.ts src/game/victory.ts tests/results.test.ts tests/victory.test.ts
git commit -m "feat: add run result statistics"
```

## Task 8: Integrate Carried Resources, Gold, and Deposit in GameScene

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `tests/inventory.test.ts`
- Modify: `tests/stoneInventory.test.ts`
- Modify: `e2e/game.spec.ts`

- [ ] **Step 1: Add scene state fields**

In `src/scenes/GameScene.ts`, add imports:

```ts
import {
  addCarriedResource,
  createCarriedResources,
  createResourceWallet,
  depositCarriedResources,
  harvestNode,
  repairCaravanWithStone,
  type CarriedResources,
  type ResourceAmounts,
  type ResourceWallet,
} from '../game/resources';
```

Add constants near `GATHER_RANGE`:

```ts
const DEPOSIT_RANGE = 88;
const STONE_REPAIR_RATE = 2;
```

Replace `private wood = 0; private stone = 0;` with:

```ts
private wallet: ResourceWallet = createResourceWallet();
private carried: CarriedResources = createCarriedResources();
```

- [ ] **Step 2: Reset resource state**

In `resetState`, replace resource resets:

```ts
this.wallet = createResourceWallet();
this.carried = createCarriedResources();
```

- [ ] **Step 3: Update gathering to fill carried resources**

Inside `updateGathering`, replace direct `addWood` and `addStone` calls with `harvestNode` and `addCarriedResource`:

```ts
const result = harvestNode(node, this.stats.gatherRate, deltaSeconds);
node.remaining = result.node.remaining;
this.carried = addCarriedResource(this.carried, result.gathered.type, result.gathered.amount);
this.totalWoodGathered += node.type === 'wood' ? result.gathered.amount : 0;
```

For stone nodes:

```ts
const result = harvestNode(node, this.stats.gatherRate, deltaSeconds);
node.remaining = result.node.remaining;
this.carried = addCarriedResource(this.carried, result.gathered.type, result.gathered.amount);
this.totalStoneGathered += node.type === 'stone' ? result.gathered.amount : 0;
```

- [ ] **Step 4: Add deposit update**

Add method:

```ts
private updateResourceDeposit(): void {
  const caravanCenter = getCaravanCenter(this.caravanTopLeft);
  if (distanceSquared(this.playerPosition, caravanCenter) > DEPOSIT_RANGE * DEPOSIT_RANGE) return;
  const hadResources = this.carried.wood > 0 || this.carried.stone > 0 || this.carried.gold > 0 || this.carried.xp > 0;
  if (!hadResources) return;
  const result = depositCarriedResources(this.wallet, this.carried);
  this.wallet = result.wallet;
  this.carried = result.carried;
  if (result.deposited.xp > 0) {
    this.experience = addExperience(this.experience, result.deposited.xp);
    this.tryOpenUpgradeChoices();
  }
  const repair = repairCaravanWithStone(this.wallet, this.stats.caravanHealth, this.stats.caravanMaxHealth, STONE_REPAIR_RATE);
  this.wallet = repair.wallet;
  this.stats.caravanHealth = repair.caravanHealth;
  this.showFeedback(`存入 木${Math.floor(result.deposited.wood)} 石${Math.floor(result.deposited.stone)} 金${Math.floor(result.deposited.gold)}`, '#c0d8a0');
}
```

Call it after `this.updateGathering(deltaSeconds);`:

```ts
this.updateResourceDeposit();
```

- [ ] **Step 5: Replace wood and stone usages**

Replace build, objective, HUD, and victory references:

```ts
this.wallet.wood
this.wallet.stone
this.wallet.gold
```

Examples:

```ts
wood: this.wallet.wood,
`木材：${Math.floor(this.wallet.wood)}  石料：${Math.floor(this.wallet.stone)}  金币：${Math.floor(this.wallet.gold)}`
`携带：木${Math.floor(this.carried.wood)} 石${Math.floor(this.carried.stone)} 金${Math.floor(this.carried.gold)}`
```

- [ ] **Step 6: Run tests and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Manual check**

Run: `npm run dev`

Expected: the game starts, resources are gathered into a carried line, and standing near the行城 deposits them into the HUD wallet.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/GameScene.ts tests/inventory.test.ts tests/stoneInventory.test.ts e2e/game.spec.ts
git commit -m "feat: require resource deposit at caravan"
```

## Task 9: Integrate Expanded Buildings and Adjacency

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/game/upgrades.ts`
- Modify: `tests/upgrades.test.ts`
- Modify: `e2e/game.spec.ts`

- [ ] **Step 1: Expand tower type and imports**

Import building helpers:

```ts
import {
  BUILDING_DEFINITIONS,
  computeAdjacencyBonus,
  getBuildingDefinition,
  spendBuildingCost,
  type BuildingType,
} from '../game/buildings';
```

Update `Tower`:

```ts
interface Tower {
  id: string;
  slotId: string;
  position: Point;
  fireTimer: number;
  base: Phaser.GameObjects.Container;
  type: Exclude<BuildingType, 'wall'>;
  label: Phaser.GameObjects.Text;
  rangeShape: Phaser.GameObjects.Arc;
}
```

- [ ] **Step 2: Replace build menu options with catalog entries**

In `showBuildMenu`, build options from definitions:

```ts
const options: BuildingType[] = slot.buildingType === 'wall'
  ? ['wall']
  : ['arrow', 'catapult', 'fire', 'ice', 'minion', 'blast-minion', 'attack-banner', 'speed-banner'];
```

Render labels with:

```ts
const definition = BUILDING_DEFINITIONS[option];
const labelText = `${definition.shortLabel} ${definition.name}`;
const costText = getBuildingCostText(option);
```

- [ ] **Step 3: Use wallet costs for all buildings**

Replace `buildFromMenu` with:

```ts
private buildFromMenu(buildingType: BuildingType, slot: BuildSlot): void {
  const result = spendBuildingCost(this.wallet, buildingType);
  if (!result.ok) {
    this.showFeedback(`资源不足：${getBuildingCostText(buildingType)}`, '#c8a860');
    return;
  }
  this.wallet = result.wallet;
  const center = this.getSlotCenter(slot);
  if (buildingType === 'wall') {
    this.buildWall(slot, center);
  } else {
    this.buildTower(slot, center, buildingType);
  }
  this.hideBuildMenu();
  this.removeBuildSlotHighlight(slot.id);
  this.updateHud();
}
```

Add `buildTower` and keep `buildArrowTower` / `buildCatapult` as wrappers only if tests require names:

```ts
private buildTower(slot: BuildSlot, center: Point, buildingType: Exclude<BuildingType, 'wall'>): void {
  const definition = BUILDING_DEFINITIONS[buildingType];
  const rangeShape = this.add.circle(center.x, center.y, Math.max(1, definition.range), 0x000000, 0);
  rangeShape.setStrokeStyle(1, 0x6a5a48, definition.range > 0 ? 0.25 : 0);
  rangeShape.setDepth(5);
  const base = this.add.container(center.x, center.y);
  base.setDepth(7);
  base.add(this.add.rectangle(0, 0, 28, 28, this.getBuildingColor(buildingType)));
  base.add(this.add.text(0, 0, definition.shortLabel, {
    color: '#0a0805',
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
    fontSize: '11px',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  const label = this.add.text(center.x, center.y - 26, definition.name, {
    color: '#c0b090',
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
    fontSize: '10px',
  }).setOrigin(0.5);
  label.setDepth(9);
  this.towers.push({
    id: `tower-${this.towerSequence++}`,
    slotId: slot.id,
    position: { x: center.x, y: center.y },
    fireTimer: 0,
    base,
    type: buildingType,
    label,
    rangeShape,
  });
  this.totalTowersBuilt++;
}
```

- [ ] **Step 4: Apply adjacency bonus in attacks**

In `updateTowers`, before targeting:

```ts
const definition = BUILDING_DEFINITIONS[tower.type];
const placed = this.towers.map((candidate) => ({ slotId: candidate.slotId, type: candidate.type }));
const adjacency = computeAdjacencyBonus(tower.slotId, GRID_BUILD_SLOTS, placed);
const damage = definition.damage * adjacency.damageMultiplier;
const interval = Math.max(0.15, definition.fireInterval * adjacency.fireIntervalMultiplier);
```

Use `definition.range`, `damage`, `interval`, and `definition.splashRadius` for arrow, catapult, fire, and ice attack behavior. Skip direct attack for support and summon buildings:

```ts
if (definition.category === 'support' || definition.category === 'summon') {
  continue;
}
```

- [ ] **Step 5: Run tests and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.ts src/game/upgrades.ts tests/upgrades.test.ts e2e/game.spec.ts
git commit -m "feat: integrate expanded building catalog"
```

## Task 10: Integrate Shop and Upgrade Cards

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/game/upgrades.ts`
- Modify: `tests/upgrades.test.ts`

- [ ] **Step 1: Add shop imports and state**

```ts
import {
  createShopState,
  purchaseShopItem,
  rerollShop,
  type ShopItem,
  type ShopState,
} from '../game/shop';
```

Add fields:

```ts
private shop?: ShopState;
private shopOverlay?: Phaser.GameObjects.Container;
private shopOpen = false;
private nextShopAtSeconds = 180;
```

Reset:

```ts
this.shop = undefined;
this.shopOpen = false;
this.nextShopAtSeconds = 180;
this.hideShopOverlay();
```

- [ ] **Step 2: Add shop opening trigger**

For P1, open shop at fixed progress intervals using elapsed time:

```ts
private maybeOpenShop(): void {
  if (this.shopOpen || this.upgradeSelecting || this.gameOver) return;
  if (this.elapsedSeconds < this.nextShopAtSeconds) return;
  this.nextShopAtSeconds += 180;
  this.shop = createShopState();
  this.shopOpen = true;
  this.showShopOverlay();
}
```

Call after `this.updateResourceDeposit();`.

- [ ] **Step 3: Add shop overlay interactions**

Add methods:

```ts
private showShopOverlay(): void {
  this.hideShopOverlay();
  if (!this.shop) return;
  const overlay = this.add.container(640, 360);
  overlay.setScrollFactor(0);
  overlay.setDepth(OVERLAY_DEPTH + 22);
  overlay.add(this.add.rectangle(0, 0, 1280, 720, 0x0a0805, 0.72));
  overlay.add(this.add.rectangle(0, 0, 680, 420, 0x2a2018, 0.96).setStrokeStyle(2, 0x8a7a58, 0.7));
  overlay.add(this.add.text(0, -170, '商店', {
    color: '#d4a843',
    fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
    fontSize: '30px',
    fontStyle: 'bold',
  }).setOrigin(0.5));
  this.shop.stock.forEach((item, index) => {
    const y = -90 + index * 58;
    const button = this.add.rectangle(0, y, 560, 44, 0x3a3020, 1).setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => this.buyShopItem(item.id));
    overlay.add(button);
    overlay.add(this.add.text(-250, y, item.name, { color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '15px' }).setOrigin(0, 0.5));
    overlay.add(this.add.text(250, y, this.formatCost(item.cost), { color: '#c8a860', fontFamily: 'monospace', fontSize: '13px' }).setOrigin(1, 0.5));
  });
  const reroll = this.add.rectangle(-120, 165, 160, 38, 0x3a3020, 1).setInteractive({ useHandCursor: true });
  reroll.on('pointerdown', () => this.rerollCurrentShop());
  const close = this.add.rectangle(120, 165, 160, 38, 0x3a3020, 1).setInteractive({ useHandCursor: true });
  close.on('pointerdown', () => this.closeShop());
  overlay.add([reroll, close]);
  overlay.add(this.add.text(-120, 165, `重随 ${this.shop.rerollCost} 金`, { color: '#e0d8c8', fontFamily: 'Arial', fontSize: '14px' }).setOrigin(0.5));
  overlay.add(this.add.text(120, 165, '离开', { color: '#e0d8c8', fontFamily: 'Arial', fontSize: '14px' }).setOrigin(0.5));
  this.shopOverlay = overlay;
}
```

- [ ] **Step 4: Add purchase effects**

```ts
private buyShopItem(itemId: string): void {
  if (!this.shop) return;
  const result = purchaseShopItem(this.shop, this.wallet, itemId);
  if (!result.ok || !result.item) {
    this.showFeedback('资源不足', '#c8a860');
    return;
  }
  this.shop = result.shop;
  this.wallet = result.wallet;
  this.applyShopItem(result.item);
  this.showShopOverlay();
  this.updateHud();
}

private rerollCurrentShop(): void {
  if (!this.shop) return;
  const result = rerollShop(this.shop, this.wallet);
  if (!result.ok) {
    this.showFeedback('金币不足，无法重随', '#c8a860');
    return;
  }
  this.shop = result.shop;
  this.wallet = result.wallet;
  this.showShopOverlay();
}

private closeShop(): void {
  this.shopOpen = false;
  this.hideShopOverlay();
}
```

Implement `applyShopItem` with building cards first by storing pending card choices in `upgradeChoices`, and with weapon items after Task 11:

```ts
private applyShopItem(item: ShopItem): void {
  if (item.kind === 'resource' && item.grant) {
    this.wallet = { ...this.wallet, gold: this.wallet.gold + (item.grant.gold ?? 0), wood: this.wallet.wood + (item.grant.wood ?? 0), stone: this.wallet.stone + (item.grant.stone ?? 0), xp: this.wallet.xp + (item.grant.xp ?? 0) };
  }
  if (item.kind === 'repair' && item.repairAmount) {
    this.stats.caravanHealth = Math.min(this.stats.caravanMaxHealth, this.stats.caravanHealth + item.repairAmount);
  }
  if (item.kind === 'building' && item.buildingType) {
    this.showFeedback(`获得建筑：${getBuildingDefinition(item.buildingType)?.name ?? item.buildingType}`, '#d4a843');
  }
}
```

Add cost formatting used by the shop overlay:

```ts
private formatCost(cost: ResourceAmounts): string {
  const parts: string[] = [];
  if (cost.wood) parts.push(`${cost.wood} 木`);
  if (cost.stone) parts.push(`${cost.stone} 石`);
  if (cost.gold) parts.push(`${cost.gold} 金`);
  if (cost.xp) parts.push(`${cost.xp} XP`);
  return parts.length > 0 ? parts.join(' ') : '免费';
}
```

- [ ] **Step 5: Run tests and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.ts src/game/upgrades.ts tests/upgrades.test.ts
git commit -m "feat: add in-run shop interface"
```

## Task 11: Integrate Weapons and Summons

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `e2e/game.spec.ts`

- [ ] **Step 1: Add imports and scene state**

```ts
import {
  addWeapon,
  createWeaponState,
  getWeaponDefinition,
  markWeaponFired,
  updateWeaponTimers,
  type WeaponState,
} from '../game/weapons';
import {
  createSummonState,
  getMinionDefinition,
  killMinion,
  spawnMinion,
  updateMinionLifetime,
  type MinionState,
  type SummonState,
} from '../game/summons';
```

Add fields:

```ts
private weapons: WeaponState = createWeaponState();
private summons: SummonState = createSummonState();
private minionVisuals: Map<string, Phaser.GameObjects.Container> = new Map();
```

Reset:

```ts
this.weapons = createWeaponState();
this.summons = createSummonState();
for (const visual of this.minionVisuals.values()) visual.destroy(true);
this.minionVisuals.clear();
```

- [ ] **Step 2: Replace hero-only attack with weapon update**

Keep existing sword slash for axe, then add:

```ts
private updateWeapons(deltaSeconds: number): void {
  this.weapons = updateWeaponTimers(this.weapons, deltaSeconds);
  this.weapons.owned = this.weapons.owned.map((weapon) => {
    if (weapon.cooldownTimer > 0) return weapon;
    const definition = getWeaponDefinition(weapon.type);
    if (!definition) return weapon;
    const target = selectNearestTarget(this.playerPosition, this.enemies, definition.range + weapon.rangeBonus);
    if (!target) return weapon;
    const damage = definition.damage * weapon.damageMultiplier;
    const result = applyDamage(target.health, damage);
    target.health = result.health;
    this.showDamageNumber(target.position.x, target.position.y, damage);
    if (definition.createsMinionOnKill && result.dead) {
      this.summons = spawnMinion(this.summons, 'decaying', target.position);
      this.createMissingMinionVisuals();
    }
    if (result.dead) this.removeEnemy(target as Enemy);
    this.drawProjectileToTarget(this.playerPosition, target.position, 0xd4a843, 380);
    return markWeaponFired(weapon);
  });
}
```

Call after `this.updateHeroAttack(deltaSeconds);`.

- [ ] **Step 3: Generate minions from summon buildings**

In `updateTowers`, for summon building definitions:

```ts
if (definition.category === 'summon' && definition.summonType) {
  tower.fireTimer = Math.max(0, tower.fireTimer - deltaSeconds);
  if (tower.fireTimer <= 0) {
    this.summons = spawnMinion(this.summons, definition.summonType, tower.position);
    this.createMissingMinionVisuals();
    tower.fireTimer = definition.fireInterval;
  }
  continue;
}
```

- [ ] **Step 4: Add minion visuals and update**

```ts
private createMissingMinionVisuals(): void {
  for (const minion of this.summons.minions) {
    if (this.minionVisuals.has(minion.id)) continue;
    const definition = getMinionDefinition(minion.type)!;
    const visual = this.add.container(minion.position.x, minion.position.y);
    visual.setDepth(11);
    visual.add(this.add.circle(0, 0, minion.type === 'bomber' ? 7 : 6, minion.type === 'bomber' ? 0xffa726 : 0x9dd6a3));
    visual.add(this.add.text(0, -12, definition.name[0], { color: '#102010', fontFamily: 'Arial', fontSize: '9px' }).setOrigin(0.5));
    this.minionVisuals.set(minion.id, visual);
  }
}

private updateMinions(deltaSeconds: number): void {
  this.summons = updateMinionLifetime(this.summons, deltaSeconds);
  for (const minion of this.summons.minions) {
    const definition = getMinionDefinition(minion.type);
    if (!definition) continue;
    const target = selectNearestTarget(minion.position, this.enemies, 240);
    if (target) {
      const dx = target.position.x - minion.position.x;
      const dy = target.position.y - minion.position.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      minion.position.x += (dx / length) * definition.speed * deltaSeconds;
      minion.position.y += (dy / length) * definition.speed * deltaSeconds;
      if (distanceSquared(minion.position, target.position) <= definition.attackRange ** 2) {
        const result = applyDamage(target.health, definition.damage * this.summons.damageMultiplier);
        target.health = result.health;
        if (result.dead) this.removeEnemy(target as Enemy);
        if (minion.type === 'bomber') this.detonateMinion(minion.id);
      }
    }
    this.minionVisuals.get(minion.id)?.setPosition(minion.position.x, minion.position.y);
  }
  this.cleanupMissingMinionVisuals();
}
```

Call `this.updateMinions(deltaSeconds);` before `this.updateEnemies(deltaSeconds);`.

- [ ] **Step 5: Add minion detonation**

```ts
private detonateMinion(minionId: string): void {
  const result = killMinion(this.summons, minionId);
  this.summons = result.state;
  for (const effect of result.effects) {
    this.drawSplashCircle(effect.position, effect.radius);
    for (const enemy of [...this.enemies]) {
      if (distanceSquared(enemy.position, effect.position) <= effect.radius ** 2) {
        const damage = applyDamage(enemy.health, effect.damage);
        enemy.health = damage.health;
        if (damage.dead) this.removeEnemy(enemy);
      }
    }
  }
  this.cleanupMissingMinionVisuals();
}
```

- [ ] **Step 6: Run tests and build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/GameScene.ts e2e/game.spec.ts
git commit -m "feat: integrate weapons and summons"
```

## Task 12: Integrate Events, Boss, Results, and E2E Acceptance

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `e2e/game.spec.ts`

- [ ] **Step 1: Add imports and state**

```ts
import {
  completeRewardCircle,
  createRewardCircle,
  createRouteEventState,
  updateRewardCircle,
  type RouteEvent,
  type RouteEventState,
} from '../game/events';
import {
  createBossState,
  startBoss,
  updateBossState,
  type BossState,
} from '../game/boss';
import {
  addBuildingDamage,
  addBuildingKill,
  addHeroDamage,
  createRunResults,
  formatBuildingDpsRows,
  type RunResults,
} from '../game/results';
```

Add fields:

```ts
private routeEvents: RouteEventState = createRouteEventState();
private boss: BossState = createBossState();
private bossStarted = false;
private results: RunResults = createRunResults();
private eventVisuals: Map<string, Phaser.GameObjects.Container> = new Map();
```

Reset these fields in `resetState`:

```ts
this.routeEvents = createRouteEventState();
this.boss = createBossState();
this.bossStarted = false;
this.results = createRunResults();
for (const visual of this.eventVisuals.values()) visual.destroy(true);
this.eventVisuals.clear();
```

- [ ] **Step 2: Spawn route events by progress**

Add method:

```ts
private updateRouteEvents(deltaSeconds: number): void {
  const progress = this.caravanTopLeft.x;
  if (this.routeEvents.active.length === 0 && progress > 900) {
    const event = createRewardCircle(`event-${this.routeEvents.nextId}`, { x: this.caravanTopLeft.x + 260, y: this.caravanTopLeft.y - 120 }, { gold: 12 }, 6);
    this.routeEvents = { active: [event], nextId: this.routeEvents.nextId + 1 };
    this.createEventVisual(event);
  }
  this.routeEvents = {
    ...this.routeEvents,
    active: this.routeEvents.active.map((event) => {
      const occupied = distanceSquared(this.playerPosition, event.position) <= 95 ** 2;
      const updated = updateRewardCircle(event, deltaSeconds, occupied);
      const claimed = completeRewardCircle(updated);
      if (Object.keys(claimed.reward).length > 0) {
        this.wallet = { ...this.wallet, gold: this.wallet.gold + (claimed.reward.gold ?? 0), wood: this.wallet.wood + (claimed.reward.wood ?? 0), stone: this.wallet.stone + (claimed.reward.stone ?? 0), xp: this.wallet.xp + (claimed.reward.xp ?? 0) };
        this.showFeedback('奖励完成', '#d4a843');
      }
      return claimed.event;
    }),
  };
}
```

Call after `this.updateResourceDeposit();`.

- [ ] **Step 3: Start Boss near the end**

Add:

```ts
private updateBoss(deltaSeconds: number): void {
  if (!this.boss.active && this.elapsedSeconds >= 600) {
    this.boss = startBoss(500);
    this.bossStarted = true;
    this.spawnEnemy('boss');
    this.showWaveBanner(this.waveState.currentWave + 1);
  }
  const result = updateBossState(this.boss, deltaSeconds);
  this.boss = result.state;
  for (let i = 0; i < result.spawnEggs; i += 1) {
    this.spawnEnemyNear('burst', getCaravanCenter(this.caravanTopLeft), i);
  }
}
```

Call before `this.updateEnemies(deltaSeconds);`.

- [ ] **Step 4: Record damage and kills**

Where hero weapons deal damage:

```ts
this.results = addHeroDamage(this.results, damage);
```

Where towers deal damage:

```ts
this.results = addBuildingDamage(this.results, tower.id, BUILDING_DEFINITIONS[tower.type].name, damage);
```

When `removeEnemy` is called by a tower, also call:

```ts
this.results = addBuildingKill(this.results, tower.id);
```

- [ ] **Step 5: Extend victory text**

Replace the current victory check in `update`:

```ts
if (this.isP1VictoryConditionMet()) {
  this.showVictory();
}
```

Add:

```ts
private isP1VictoryConditionMet(): boolean {
  const bossAlive = this.enemies.some((enemy) => enemy.type === 'boss');
  return this.elapsedSeconds >= 720 && this.bossStarted && !this.boss.active && !bossAlive;
}
```

When `removeEnemy` removes a Boss, deactivate the Boss state:

```ts
if (enemy.type === 'boss') {
  this.boss = { ...this.boss, active: false, health: 0 };
}
```

In `showVictory` and `showGameOver`, append:

```ts
const dpsRows = formatBuildingDpsRows(this.results, this.elapsedSeconds).slice(0, 6).join('\n');
const resultText = `英雄伤害：${Math.floor(this.results.heroDamage)}\n行城建筑伤害：${Math.floor(this.results.cityDamage)}\n${dpsRows}`;
```

Include `resultText` in the displayed result body.

- [ ] **Step 6: Update E2E smoke test**

Modify `e2e/game.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('game renders p1 loop surfaces', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();

  await page.keyboard.press('b');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e-screenshot-build.png' });

  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'e2e-screenshot-wave.png' });

  await page.keyboard.press('b');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e-screenshot-p1.png' });
});
```

- [ ] **Step 7: Full verification**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: PASS.

Run: `npx playwright test`

Expected: PASS and screenshots generated.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/GameScene.ts e2e/game.spec.ts
git commit -m "feat: complete p1 gameplay slice"
```

## Final Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npx playwright test`.
- [ ] Start `npm run dev`.
- [ ] Manually verify: gather resources, deposit at行城, build at least three building types, see shop, see minions, reach Boss pressure, and reach a victory or failure result screen.
- [ ] Commit any verification-only screenshot updates if the repository intentionally tracks screenshots.
