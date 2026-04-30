import { describe, expect, it } from 'vitest';
import {
  BUILDING_DEFINITIONS,
  canBuild,
  computeAdjacencyBonus,
  getAdjacentSlotIds,
  getBuildingCostText,
  getBuildingDefinition,
  spendBuildingCost,
} from '../src/game/buildings';
import { GRID_BUILD_SLOTS } from '../src/game/buildSlots';
import type { ResourceWallet } from '../src/game/resources';

describe('building catalog', () => {
  it('defines the nine P1 building types', () => {
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
    expect(getBuildingCostText('catapult')).toBe('25 wood, 10 stone');
    expect(getBuildingCostText('fire')).toBe('20 wood, 8 gold');
  });

  it('checks affordability using the resource wallet', () => {
    const wallet: ResourceWallet = { wood: 25, stone: 10, gold: 8, xp: 0, meta: 0 };
    expect(canBuild(wallet, 'fire')).toBe(true);
    expect(canBuild({ ...wallet, gold: 7 }, 'fire')).toBe(false);
  });

  it('spends building costs from the resource wallet', () => {
    const wallet: ResourceWallet = { wood: 25, stone: 10, gold: 0, xp: 0, meta: 0 };

    expect(spendBuildingCost(wallet, 'catapult')).toEqual({
      ok: true,
      wallet: { wood: 0, stone: 0, gold: 0, xp: 0, meta: 0 },
    });

    const shortGold: ResourceWallet = { wood: 20, stone: 0, gold: 7, xp: 0, meta: 0 };
    expect(spendBuildingCost(shortGold, 'fire')).toEqual({
      ok: false,
      wallet: shortGold,
    });
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
