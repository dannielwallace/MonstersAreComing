import { describe, expect, it } from 'vitest';
import { formatVictoryStats, isVictoryConditionMet, MAX_WAVE, type GameStats } from '../src/game/victory';

const sampleStats: GameStats = {
  wavesSurvived: 10,
  timeElapsed: 142.5,
  enemiesKilled: 45,
  towersBuilt: 5,
  woodGathered: 120,
  stoneGathered: 60,
  wallsBuilt: 2,
};

describe('isVictoryConditionMet', () => {
  it('returns true when wave >= MAX_WAVE and no enemies alive', () => {
    expect(isVictoryConditionMet(MAX_WAVE, 0)).toBe(true);
    expect(isVictoryConditionMet(12, 0)).toBe(true);
  });

  it('returns false when enemies are still alive', () => {
    expect(isVictoryConditionMet(MAX_WAVE, 1)).toBe(false);
  });

  it('returns false when not enough waves cleared', () => {
    expect(isVictoryConditionMet(MAX_WAVE - 1, 0)).toBe(false);
  });
});

describe('MAX_WAVE', () => {
  it('equals 10', () => {
    expect(MAX_WAVE).toBe(10);
  });
});

describe('formatVictoryStats', () => {
  it('formats victory stats with Chinese labels', () => {
    const text = formatVictoryStats(sampleStats, true);
    expect(text).toContain('胜利');
    expect(text).toContain('142.5');
    expect(text).toContain('45');
    expect(text).toContain('5');
    expect(text).toContain('2');
    expect(text).toContain('120');
    expect(text).toContain('60');
    expect(text).toContain('重新开始');
  });

  it('formats defeat stats with Chinese labels', () => {
    const text = formatVictoryStats(sampleStats, false);
    expect(text).toContain('行城被摧毁');
  });
});
