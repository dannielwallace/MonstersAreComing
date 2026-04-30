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
