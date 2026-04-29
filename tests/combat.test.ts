import { describe, expect, it } from 'vitest';
import { applyDamage, selectNearestTarget } from '../src/game/combat';

describe('selectNearestTarget', () => {
  const origin = { x: 0, y: 0 };

  it('chooses the nearest enemy inside range', () => {
    const enemies = [
      { id: 'far', position: { x: 90, y: 0 }, health: 30 },
      { id: 'near', position: { x: 30, y: 0 }, health: 30 },
    ];

    expect(selectNearestTarget(origin, enemies, 100)?.id).toBe('near');
  });

  it('ignores enemies outside range', () => {
    const enemies = [{ id: 'outside', position: { x: 101, y: 0 }, health: 30 }];

    expect(selectNearestTarget(origin, enemies, 100)).toBeUndefined();
  });

  it('ignores dead enemies', () => {
    const enemies = [{ id: 'dead', position: { x: 10, y: 0 }, health: 0 }];

    expect(selectNearestTarget(origin, enemies, 100)).toBeUndefined();
  });
});

describe('applyDamage', () => {
  it('reduces health by damage', () => {
    expect(applyDamage(30, 10)).toEqual({ health: 20, dead: false });
  });

  it('marks an enemy dead at zero health', () => {
    expect(applyDamage(10, 10)).toEqual({ health: 0, dead: true });
  });

  it('does not return negative health', () => {
    expect(applyDamage(5, 10)).toEqual({ health: 0, dead: true });
  });
});
