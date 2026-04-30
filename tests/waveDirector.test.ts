import { describe, expect, it } from 'vitest';
import {
  FIRST_WAVE_DELAY,
  WAVE_INTERVAL,
  createWaveState,
  getWaveBudget,
  selectEnemyTypesForBudget,
  selectEnemyTypesForWave,
  updateWaveState,
  type WaveState,
} from '../src/game/waveDirector';

describe('wave director constants and initial state', () => {
  it('uses the first wave delay and wave interval constants', () => {
    expect(FIRST_WAVE_DELAY).toBe(30);
    expect(WAVE_INTERVAL).toBe(20);
  });

  it('creates the initial wave state', () => {
    expect(createWaveState()).toEqual({ currentWave: 0, nextWaveTimer: 30 });
  });
});

describe('updateWaveState', () => {
  it('counts down without starting a wave', () => {
    expect(updateWaveState(createWaveState(), 3)).toEqual({
      state: { currentWave: 0, nextWaveTimer: 27 },
      startedWave: false,
      spawnedEnemies: [],
    });
  });

  it('starts the first wave when the first delay elapses', () => {
    expect(updateWaveState(createWaveState(), 30)).toEqual({
      state: { currentWave: 1, nextWaveTimer: 20 },
      startedWave: true,
      spawnedEnemies: ['grunt', 'grunt'],
    });
  });

  it('starts at most one wave per update and discards overshoot', () => {
    const state: WaveState = { currentWave: 2, nextWaveTimer: 4 };

    expect(updateWaveState(state, 100)).toEqual({
      state: { currentWave: 3, nextWaveTimer: 20 },
      startedWave: true,
      spawnedEnemies: [
        'thrower',
        'grunt',
        'runner',
      ],
    });
  });

  it('ignores invalid deltas and intervals', () => {
    const state: WaveState = { currentWave: 2, nextWaveTimer: 4 };
    const unchanged = {
      state,
      startedWave: false,
      spawnedEnemies: [],
    };

    expect(updateWaveState(state, 0)).toEqual(unchanged);
    expect(updateWaveState(state, -2)).toEqual(unchanged);
    expect(updateWaveState(state, Number.NaN)).toEqual(unchanged);
    expect(updateWaveState(state, 4, 0)).toEqual(unchanged);
    expect(updateWaveState(state, 4, Number.NaN)).toEqual(unchanged);
  });
});

describe('getWaveBudget', () => {
  it('scales the budget from the normalized wave number', () => {
    expect(getWaveBudget(0)).toBe(1);
    expect(getWaveBudget(1)).toBe(2);
    expect(getWaveBudget(2)).toBe(3);
    expect(getWaveBudget(4)).toBe(5);
    expect(getWaveBudget(Number.NaN)).toBe(1);
  });
});

describe('wave enemy selection', () => {
  it('selects a deterministic wave composition', () => {
    expect(selectEnemyTypesForWave(4)).toEqual([
      'thrower',
      'grunt',
      'runner',
      'grunt',
    ]);
  });

  it('returns no enemies for insufficient custom budgets', () => {
    expect(selectEnemyTypesForBudget(4, 0)).toEqual([]);
    expect(selectEnemyTypesForBudget(4, -3)).toEqual([]);
  });

  it('returns no enemies for invalid custom budgets', () => {
    expect(selectEnemyTypesForBudget(4, Number.NaN)).toEqual([]);
    expect(selectEnemyTypesForBudget(4, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('floors fractional custom budgets before spending', () => {
    expect(selectEnemyTypesForBudget(4, 4.8)).toEqual([
      'thrower',
      'grunt',
      'runner',
    ]);
  });
});
