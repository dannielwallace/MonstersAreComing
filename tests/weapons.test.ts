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
