import { describe, expect, it } from 'vitest';
import {
  addCarriedResource,
  canAfford,
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
    const afterNegative = addCarriedResource(carried, 'wood', -2);
    const afterInfinity = addCarriedResource(afterNegative, 'wood', Infinity);
    const afterNegativeInfinity = addCarriedResource(afterInfinity, 'wood', -Infinity);
    const afterNaN = addCarriedResource(afterNegativeInfinity, 'wood', NaN);

    expect(afterNaN).toEqual({ wood: 5, stone: 0, gold: 0, xp: 0 });
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

  it('checks affordability for valid positive costs only', () => {
    const wallet = { wood: 20, stone: 5, gold: 10, xp: 3, meta: 2 };

    expect(canAfford(wallet, { wood: 15 })).toBe(true);
    expect(canAfford(wallet, { wood: 15, stone: 5, gold: 10 })).toBe(true);
    expect(canAfford(wallet, { meta: 2 })).toBe(true);
    expect(canAfford(wallet, {})).toBe(true);
    expect(canAfford(wallet, { wood: 0 })).toBe(false);
    expect(canAfford(wallet, { wood: -1 })).toBe(false);
    expect(canAfford(wallet, { wood: NaN })).toBe(false);
    expect(canAfford(wallet, { wood: Infinity })).toBe(false);
  });

  it('rejects invalid explicit spend costs without changing the wallet', () => {
    const wallet = { wood: 20, stone: 5, gold: 10, xp: 3, meta: 2 };

    expect(spendResources(wallet, {})).toEqual({ ok: true, wallet });
    expect(spendResources(wallet, { wood: 0 })).toEqual({ ok: false, wallet });
    expect(spendResources(wallet, { wood: -1 })).toEqual({ ok: false, wallet });
    expect(spendResources(wallet, { wood: NaN })).toEqual({ ok: false, wallet });
    expect(spendResources(wallet, { wood: Infinity })).toEqual({ ok: false, wallet });
  });

  it('harvests from a node without going below zero', () => {
    const node: HarvestableNode = { id: 'tree-1', type: 'wood', remaining: 4 };
    const result = harvestNode(node, 10, 0.5);
    expect(result.node.remaining).toBe(0);
    expect(result.gathered).toEqual({ type: 'wood', amount: 4 });
    expect(result.depleted).toBe(true);

    const negativeNode = harvestNode({ id: 'tree-2', type: 'wood', remaining: -4 }, 10, 0.5);
    expect(negativeNode.node.remaining).toBe(0);
    expect(negativeNode.gathered).toEqual({ type: 'wood', amount: 0 });
    expect(negativeNode.depleted).toBe(true);

    const nanNode = harvestNode({ id: 'tree-3', type: 'wood', remaining: NaN }, 10, 0.5);
    expect(nanNode.node.remaining).toBe(0);
    expect(nanNode.gathered).toEqual({ type: 'wood', amount: 0 });
    expect(nanNode.depleted).toBe(true);
  });

  it('repairs caravan using stone and caps at max health', () => {
    const result = repairCaravanWithStone({ wood: 0, stone: 10, gold: 0, xp: 0, meta: 0 }, 70, 100, 2);
    expect(result).toEqual({
      wallet: { wood: 0, stone: 0, gold: 0, xp: 0, meta: 0 },
      caravanHealth: 90,
      repaired: 20,
    });

    const cappedResult = repairCaravanWithStone({ wood: 0, stone: 10, gold: 0, xp: 0, meta: 0 }, 95, 100, 2);
    expect(cappedResult).toEqual({
      wallet: { wood: 0, stone: 7, gold: 0, xp: 0, meta: 0 },
      caravanHealth: 100,
      repaired: 5,
    });

    const invalidRateResult = repairCaravanWithStone(
      { wood: 0, stone: 10, gold: 0, xp: 0, meta: 0 },
      70,
      100,
      Infinity,
    );
    expect(invalidRateResult).toEqual({
      wallet: { wood: 0, stone: 10, gold: 0, xp: 0, meta: 0 },
      caravanHealth: 70,
      repaired: 0,
    });

    const invalidHealthResult = repairCaravanWithStone(
      { wood: 0, stone: 10, gold: 0, xp: 0, meta: 0 },
      NaN,
      100,
      2,
    );
    expect(invalidHealthResult).toEqual({
      wallet: { wood: 0, stone: 10, gold: 0, xp: 0, meta: 0 },
      caravanHealth: 0,
      repaired: 0,
    });
  });
});
