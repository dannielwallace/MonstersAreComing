import { describe, expect, it } from 'vitest';
import { addWood, canSpendWood, spendWood } from '../src/game/inventory';

describe('inventory wood rules', () => {
  it('adds gathered wood as whole units', () => {
    expect(addWood(3, 2.8)).toBe(5);
  });

  it('allows spending when enough wood is available', () => {
    expect(canSpendWood(20, 20)).toBe(true);
  });

  it('refuses spending when wood is below cost', () => {
    expect(canSpendWood(19, 20)).toBe(false);
  });

  it('subtracts exactly the cost when spending succeeds', () => {
    expect(spendWood(25, 20)).toEqual({ ok: true, wood: 5 });
  });

  it('does not change wood when spending fails', () => {
    expect(spendWood(12, 20)).toEqual({ ok: false, wood: 12 });
  });
});
