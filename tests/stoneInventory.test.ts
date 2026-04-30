import { describe, expect, it } from 'vitest';
import { addStone, canSpendStone, spendStone } from '../src/game/stoneInventory';

describe('addStone', () => {
  it('accumulates stone with fractional values', () => {
    expect(addStone(0, 8.5)).toBe(8.5);
    expect(addStone(8.5, 3.2)).toBe(11.7);
  });

  it('preserves stone for zero or negative amounts', () => {
    expect(addStone(10, 0)).toBe(10);
    expect(addStone(10, -3)).toBe(10);
    expect(addStone(10, Number.NaN)).toBe(10);
  });
});

describe('canSpendStone', () => {
  it('returns true when stone is sufficient', () => {
    expect(canSpendStone(20, 10)).toBe(true);
    expect(canSpendStone(10, 10)).toBe(true);
  });

  it('returns false when stone is insufficient or invalid', () => {
    expect(canSpendStone(5, 10)).toBe(false);
    expect(canSpendStone(10, 0)).toBe(false);
    expect(canSpendStone(10, -5)).toBe(false);
    expect(canSpendStone(Number.NaN, 5)).toBe(false);
  });
});

describe('spendStone', () => {
  it('deducts stone on success', () => {
    expect(spendStone(20, 10)).toEqual({ ok: true, wood: 10 });
  });

  it('returns unchanged stone on failure', () => {
    expect(spendStone(5, 10)).toEqual({ ok: false, wood: 5 });
  });
});
