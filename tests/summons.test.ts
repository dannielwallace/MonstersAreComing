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
