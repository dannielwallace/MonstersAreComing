import { describe, expect, it } from 'vitest';
import {
  addExperience,
  consumePendingLevelUp,
  createExperienceState,
  ENEMY_EXPERIENCE_REWARD,
  hasPendingLevelUp,
  requiredExperienceForLevel,
} from '../src/game/experience';

describe('requiredExperienceForLevel', () => {
  it('starts at 20 experience for level 1', () => {
    expect(requiredExperienceForLevel(1)).toBe(20);
  });

  it('increases by 12 experience per level', () => {
    expect(requiredExperienceForLevel(2)).toBe(32);
    expect(requiredExperienceForLevel(5)).toBe(68);
  });
});

describe('experience progression', () => {
  it('starts at level 1 with no experience or pending choices', () => {
    expect(createExperienceState()).toEqual({ level: 1, experience: 0, pendingLevelUps: 0 });
  });

  it('uses 5 experience as the enemy death reward', () => {
    expect(ENEMY_EXPERIENCE_REWARD).toBe(5);
  });

  it('adds experience without leveling when below the threshold', () => {
    expect(addExperience(createExperienceState(), 5)).toEqual({
      level: 1,
      experience: 5,
      pendingLevelUps: 0,
    });
  });

  it('levels up and queues one pending upgrade choice at the threshold', () => {
    expect(addExperience(createExperienceState(), 20)).toEqual({
      level: 2,
      experience: 0,
      pendingLevelUps: 1,
    });
  });

  it('preserves overflow experience after leveling', () => {
    expect(addExperience(createExperienceState(), 25)).toEqual({
      level: 2,
      experience: 5,
      pendingLevelUps: 1,
    });
  });

  it('queues multiple pending level-ups when a large reward crosses multiple thresholds', () => {
    expect(addExperience(createExperienceState(), 100)).toEqual({
      level: 4,
      experience: 4,
      pendingLevelUps: 3,
    });
  });

  it('consumes one pending level-up after an upgrade is selected', () => {
    const state = { level: 3, experience: 2, pendingLevelUps: 2 };

    expect(consumePendingLevelUp(state)).toEqual({ level: 3, experience: 2, pendingLevelUps: 1 });
  });

  it('reports whether an upgrade choice is waiting', () => {
    expect(hasPendingLevelUp({ level: 1, experience: 0, pendingLevelUps: 0 })).toBe(false);
    expect(hasPendingLevelUp({ level: 2, experience: 0, pendingLevelUps: 1 })).toBe(true);
  });
});
