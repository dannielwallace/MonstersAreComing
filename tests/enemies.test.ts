import { describe, expect, it } from 'vitest';
import {
  ENEMY_DEFINITIONS,
  getEnemyDefinition,
  getUnlockedEnemyTypes,
} from '../src/game/enemies';

describe('getEnemyDefinition', () => {
  it('returns the grunt definition', () => {
    expect(getEnemyDefinition('grunt')).toEqual({
      type: 'grunt',
      name: '普通',
      label: '普',
      color: 0xef4444,
      radius: 13,
      health: 30,
      speed: 72,
      contactDamage: 5,
      experienceReward: 5,
      budgetCost: 1,
      unlockWave: 1,
    });
  });

  it('returns the runner definition', () => {
    expect(getEnemyDefinition('runner')).toEqual({
      type: 'runner',
      name: '迅捷',
      label: '快',
      color: 0xf97316,
      radius: 10,
      health: 18,
      speed: 118,
      contactDamage: 4,
      experienceReward: 4,
      budgetCost: 1,
      unlockWave: 2,
    });
  });

  it('returns the brute definition', () => {
    expect(getEnemyDefinition('brute')).toEqual({
      type: 'brute',
      name: '重甲',
      label: '甲',
      color: 0x7f1d1d,
      radius: 18,
      health: 85,
      speed: 45,
      contactDamage: 9,
      experienceReward: 10,
      budgetCost: 3,
      unlockWave: 4,
    });
  });

  it('returns undefined for unknown enemy types', () => {
    expect(getEnemyDefinition('unknown')).toBeUndefined();
  });

  it('returns undefined for prototype property names', () => {
    expect(getEnemyDefinition('toString')).toBeUndefined();
    expect(getEnemyDefinition('__proto__')).toBeUndefined();
  });
});

describe('getUnlockedEnemyTypes', () => {
  it('unlocks enemies by wave number', () => {
    expect(getUnlockedEnemyTypes(1)).toEqual(['grunt']);
    expect(getUnlockedEnemyTypes(2)).toEqual(['grunt', 'runner']);
    expect(getUnlockedEnemyTypes(3)).toEqual(['grunt', 'runner']);
    expect(getUnlockedEnemyTypes(4)).toEqual(['grunt', 'runner', 'brute']);
  });

  it('normalizes invalid and low wave numbers to first wave unlocks', () => {
    expect(getUnlockedEnemyTypes(0)).toEqual(['grunt']);
    expect(getUnlockedEnemyTypes(-5)).toEqual(['grunt']);
    expect(getUnlockedEnemyTypes(Number.NaN)).toEqual(['grunt']);
    expect(getUnlockedEnemyTypes(1.8)).toEqual(['grunt']);
  });
});

describe('ENEMY_DEFINITIONS', () => {
  it('keeps enemy definitions in type order', () => {
    expect(Object.keys(ENEMY_DEFINITIONS)).toEqual(['grunt', 'runner', 'brute']);
  });
});
