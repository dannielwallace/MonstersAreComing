import { describe, expect, it } from 'vitest';
import {
  applyUpgrade,
  DEFAULT_RUN_STATS,
  pickUpgradeChoices,
  UPGRADE_POOL,
  type RunStats,
} from '../src/game/upgrades';

describe('UPGRADE_POOL', () => {
  it('contains at least five Chinese upgrade options', () => {
    expect(UPGRADE_POOL.length).toBeGreaterThanOrEqual(5);
    expect(UPGRADE_POOL.map((upgrade) => upgrade.name)).toContain('箭塔校准');
    expect(UPGRADE_POOL.map((upgrade) => upgrade.name)).toContain('坚固车体');
  });
});

describe('pickUpgradeChoices', () => {
  it('returns three unique upgrade choices from the full pool', () => {
    const choices = pickUpgradeChoices(UPGRADE_POOL, 3, () => 0);

    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((choice) => choice.id)).size).toBe(3);
  });

  it('is deterministic when a random function is injected', () => {
    const choices = pickUpgradeChoices(UPGRADE_POOL, 3, () => 0);

    expect(choices.map((choice) => choice.id)).toEqual(['tower-range', 'tower-damage', 'tower-reload']);
  });

  it('returns all available choices when the pool is smaller than the requested count', () => {
    const choices = pickUpgradeChoices(UPGRADE_POOL.slice(0, 2), 3, () => 0);

    expect(choices.map((choice) => choice.id)).toEqual(['tower-range', 'tower-damage']);
  });
});

describe('applyUpgrade', () => {
  const baseStats: RunStats = { ...DEFAULT_RUN_STATS };

  it('increases tower range for 箭塔校准', () => {
    expect(applyUpgrade(baseStats, 'tower-range').towerRange).toBe(210);
  });

  it('increases tower damage for 重弩箭头', () => {
    expect(applyUpgrade(baseStats, 'tower-damage').towerDamage).toBe(15);
  });

  it('reduces tower fire interval for 快速装填', () => {
    expect(applyUpgrade(baseStats, 'tower-reload').towerFireInterval).toBeCloseTo(0.484);
  });

  it('does not reduce tower fire interval below 0.25 seconds', () => {
    expect(applyUpgrade({ ...baseStats, towerFireInterval: 0.26 }, 'tower-reload').towerFireInterval).toBe(0.25);
  });

  it('increases gather rate for 伐木熟手', () => {
    expect(applyUpgrade(baseStats, 'gather-rate').gatherRate).toBe(10);
  });

  it('increases max health and current health for 坚固车体', () => {
    expect(applyUpgrade({ ...baseStats, caravanHealth: 70 }, 'caravan-max-health')).toEqual({
      ...baseStats,
      caravanMaxHealth: 120,
      caravanHealth: 90,
    });
  });

  it('repairs current health without exceeding max health for 前线修补', () => {
    expect(applyUpgrade({ ...baseStats, caravanHealth: 90 }, 'caravan-repair')).toEqual({
      ...baseStats,
      caravanHealth: 100,
    });
  });
});
