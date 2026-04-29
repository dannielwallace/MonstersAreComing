import { describe, expect, it } from 'vitest';
import { getSpawnInterval, updateSpawnTimer } from '../src/game/spawnDirector';

describe('getSpawnInterval', () => {
  it('uses 4 seconds during the first 30 seconds', () => {
    expect(getSpawnInterval(10)).toBe(4);
  });

  it('uses 2.8 seconds after 30 seconds', () => {
    expect(getSpawnInterval(45)).toBe(2.8);
  });

  it('uses 2 seconds after 90 seconds', () => {
    expect(getSpawnInterval(120)).toBe(2);
  });

  it('uses 1.4 seconds after 180 seconds', () => {
    expect(getSpawnInterval(200)).toBe(1.4);
  });
});

describe('updateSpawnTimer', () => {
  it('does not spawn before the interval fills', () => {
    expect(updateSpawnTimer(0.5, 0.25, 1)).toEqual({ timer: 0.75, spawnCount: 0 });
  });

  it('spawns once and keeps leftover time', () => {
    expect(updateSpawnTimer(0.8, 0.4, 1)).toEqual({ timer: 0.2, spawnCount: 1 });
  });

  it('spawns multiple times during a large frame step', () => {
    expect(updateSpawnTimer(0.2, 3.1, 1)).toEqual({ timer: 0.3, spawnCount: 3 });
  });
});
