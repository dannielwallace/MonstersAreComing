import { describe, expect, it } from 'vitest';
import {
  createWall,
  damageWall,
  getWallHealthRatio,
  isWallDestroyed,
  WALL_COST,
  WALL_DEFAULT_HP,
} from '../src/game/walls';

describe('wall constants', () => {
  it('has correct wall cost', () => {
    expect(WALL_COST).toBe(15);
  });

  it('has correct default HP', () => {
    expect(WALL_DEFAULT_HP).toBe(60);
  });
});

describe('createWall', () => {
  it('creates a wall with correct initial state', () => {
    const wall = createWall('cell-2-0', { x: 100, y: 200 }, 60);
    expect(wall.id).toBe('wall-cell-2-0');
    expect(wall.slotId).toBe('cell-2-0');
    expect(wall.position).toEqual({ x: 100, y: 200 });
    expect(wall.health).toBe(60);
    expect(wall.maxHealth).toBe(60);
  });
});

describe('damageWall', () => {
  it('returns a new object with reduced health', () => {
    const wall = createWall('cell-2-0', { x: 0, y: 0 }, 60);
    const damaged = damageWall(wall, 20);
    expect(damaged.health).toBe(40);
    expect(damaged).not.toBe(wall);
  });

  it('clamps health to 0', () => {
    const wall = createWall('cell-2-0', { x: 0, y: 0 }, 60);
    const destroyed = damageWall(wall, 100);
    expect(destroyed.health).toBe(0);
  });
});

describe('isWallDestroyed', () => {
  it('returns true at 0 HP', () => {
    const wall = createWall('cell-2-0', { x: 0, y: 0 }, 60);
    const destroyed = damageWall(wall, 60);
    expect(isWallDestroyed(destroyed)).toBe(true);
  });

  it('returns false above 0 HP', () => {
    const wall = createWall('cell-2-0', { x: 0, y: 0 }, 60);
    expect(isWallDestroyed(wall)).toBe(false);
  });
});

describe('getWallHealthRatio', () => {
  it('returns correct ratio', () => {
    const wall = createWall('cell-2-0', { x: 0, y: 0 }, 60);
    expect(getWallHealthRatio(wall)).toBe(1);
    expect(getWallHealthRatio(damageWall(wall, 30))).toBe(0.5);
    expect(getWallHealthRatio(damageWall(wall, 60))).toBe(0);
  });
});
