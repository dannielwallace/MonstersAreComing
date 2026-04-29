import { describe, expect, it } from 'vitest';
import { getSpawnInterval, updateSpawnTimer } from '../src/game/spawnDirector';

describe('getSpawnInterval', () => {
  it('uses 4 seconds during the first 30 seconds', () => {
    expect(getSpawnInterval(10)).toBe(4);
  });

  it('uses 2.8 seconds after 30 seconds', () => {
    expect(getSpawnInterval(45)).toBe(2.8);
  });

  it('uses 2.8 seconds at exactly 30 seconds', () => {
    expect(getSpawnInterval(30)).toBe(2.8);
  });

  it('uses 2 seconds after 90 seconds', () => {
    expect(getSpawnInterval(120)).toBe(2);
  });

  it('uses 2 seconds at exactly 90 seconds', () => {
    expect(getSpawnInterval(90)).toBe(2);
  });

  it('uses 1.4 seconds after 180 seconds', () => {
    expect(getSpawnInterval(200)).toBe(1.4);
  });

  it('uses 1.4 seconds at exactly 180 seconds', () => {
    expect(getSpawnInterval(180)).toBe(1.4);
  });
});

describe('updateSpawnTimer', () => {
  it('does not spawn before the interval fills', () => {
    expect(updateSpawnTimer(0.5, 0.25, 1)).toEqual({ timer: 0.75, spawnCount: 0 });
  });

  it('spawns once and keeps leftover time', () => {
    const result = updateSpawnTimer(0.8, 0.4, 1);

    expect(result.spawnCount).toBe(1);
    expect(result.timer).toBeCloseTo(0.2);
  });

  it('spawns multiple times during a large frame step', () => {
    const result = updateSpawnTimer(0.2, 3.1, 1);

    expect(result.spawnCount).toBe(3);
    expect(result.timer).toBeCloseTo(0.3);
  });

  it('does not spawn when the interval is invalid', () => {
    expect(updateSpawnTimer(0.5, 1, 0)).toEqual({ timer: 0.5, spawnCount: 0 });
    expect(updateSpawnTimer(0.5, 1, -1)).toEqual({ timer: 0.5, spawnCount: 0 });
    expect(updateSpawnTimer(0.5, 1, Number.NaN)).toEqual({ timer: 0.5, spawnCount: 0 });
    expect(updateSpawnTimer(0.5, 1, Number.POSITIVE_INFINITY)).toEqual({ timer: 0.5, spawnCount: 0 });
  });

  it('does not spawn when delta time is invalid or non-positive', () => {
    expect(updateSpawnTimer(0.5, 0, 1)).toEqual({ timer: 0.5, spawnCount: 0 });
    expect(updateSpawnTimer(0.5, -0.1, 1)).toEqual({ timer: 0.5, spawnCount: 0 });
    expect(updateSpawnTimer(0.5, Number.NaN, 1)).toEqual({ timer: 0.5, spawnCount: 0 });
    expect(updateSpawnTimer(0.5, Number.POSITIVE_INFINITY, 1)).toEqual({ timer: 0.5, spawnCount: 0 });
  });

  it('preserves a near-boundary no-spawn timer below the interval', () => {
    const result = updateSpawnTimer(0, 1.399999999999, 1.4);

    expect(result.spawnCount).toBe(0);
    expect(result.timer).toBeCloseTo(1.399999999999);
    expect(result.timer).toBeLessThan(1.4);
  });
});
