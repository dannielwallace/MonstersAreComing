import { describe, expect, it } from 'vitest';
import { distanceSquared, moveToward, normalizeInput } from '../src/game/math';

describe('normalizeInput', () => {
  it('keeps cardinal movement at full speed', () => {
    expect(normalizeInput(1, 0)).toEqual({ x: 1, y: 0 });
  });

  it('normalizes diagonal movement to length 1', () => {
    const result = normalizeInput(1, 1);
    expect(result.x).toBeCloseTo(0.7071, 3);
    expect(result.y).toBeCloseTo(0.7071, 3);
  });

  it('keeps zero input at zero', () => {
    expect(normalizeInput(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('distanceSquared', () => {
  it('returns squared distance between two points', () => {
    expect(distanceSquared({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });
});

describe('moveToward', () => {
  it('moves by max distance toward the target', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 3)).toEqual({ x: 3, y: 0 });
  });

  it('stops exactly on the target when the step is large enough', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 2, y: 0 }, 3)).toEqual({ x: 2, y: 0 });
  });
});
