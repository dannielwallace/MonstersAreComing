import { describe, expect, it } from 'vitest';
import {
  createResourceSpawnerState,
  updateResourceSpawner,
  collectDepletedNodes,
} from '../src/game/resourceSpawner';

function rng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('createResourceSpawnerState', () => {
  it('returns empty state with correct defaults', () => {
    const state = createResourceSpawnerState(100);
    expect(state.woodNodes).toEqual([]);
    expect(state.stoneNodes).toEqual([]);
    expect(state.nextId).toBe(0);
    expect(state.lastSpawnX).toBe(100);
  });
});

describe('updateResourceSpawner', () => {
  it('spawns wood nodes ahead of caravan', () => {
    const state = createResourceSpawnerState(0);
    const { spawned } = updateResourceSpawner(state, 200, 1000, 0, 720, rng([0.5]));
    expect(spawned.filter((n) => n.type === 'wood').length).toBeGreaterThan(0);
  });

  it('spawns stone nodes at intervals', () => {
    const state = createResourceSpawnerState(0);
    const { spawned } = updateResourceSpawner(state, 500, 2000, 0, 720, rng([0.5]));
    const stones = spawned.filter((n) => n.type === 'stone');
    // Every even-numbered ID gets a stone
    expect(stones.length).toBeGreaterThanOrEqual(1);
  });

  it('increments nextId for each spawned node', () => {
    const state = createResourceSpawnerState(0);
    updateResourceSpawner(state, 300, 2000, 0, 720, rng([0.5]));
    expect(state.nextId).toBeGreaterThan(0);
  });

  it('does not spawn when caravan has not advanced enough', () => {
    const state = createResourceSpawnerState(1000);
    state.lastSpawnX = 3000; // caravan(1000) + SPAWN_AHEAD_MARGIN(1200) = 2200 < 3000
    const { spawned } = updateResourceSpawner(state, 1000, 2000, 800, 720, rng([0.5]));
    expect(spawned).toHaveLength(0);
  });

  it('returns empty cleanedUp when no depleted nodes exist', () => {
    const state = createResourceSpawnerState(0);
    const { cleanedUp } = updateResourceSpawner(state, 200, 1000, 0, 720, rng([0.5]));
    expect(cleanedUp).toEqual([]);
  });
});

describe('collectDepletedNodes', () => {
  it('returns all depleted nodes', () => {
    const nodes = [
      { id: 'a', remaining: 0 } as any,
      { id: 'b', remaining: 5 } as any,
      { id: 'c', remaining: 0 } as any,
    ];
    const depleted = collectDepletedNodes(nodes);
    expect(depleted.map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('returns empty array when no nodes are depleted', () => {
    const nodes = [
      { id: 'a', remaining: 10 } as any,
      { id: 'b', remaining: 3 } as any,
    ];
    expect(collectDepletedNodes(nodes)).toEqual([]);
  });
});
