import { describe, expect, it } from 'vitest';
import { addWood, canSpendWood, spendWood } from '../src/game/inventory';

describe('inventory wood rules', () => {
  it('adds gathered wood while preserving fractional accumulation', () => {
    expect(addWood(3, 2.8)).toBe(5.8);
  });

  it('preserves fractional gathered wood below one unit', () => {
    expect(addWood(0, 0.13)).toBeCloseTo(0.13);
  });

  it('accumulates fractional gathered wood across additions', () => {
    expect(addWood(0.5, 0.75)).toBeCloseTo(1.25);
  });

  it('preserves current wood when gathered amount is zero', () => {
    expect(addWood(4, 0)).toBe(4);
  });

  it('preserves current wood when gathered amount is negative', () => {
    expect(addWood(4, -1)).toBe(4);
  });

  it('preserves current wood when gathered amount is NaN', () => {
    expect(addWood(4, Number.NaN)).toBe(4);
  });

  it('allows spending when enough wood is available', () => {
    expect(canSpendWood(20, 20)).toBe(true);
  });

  it('refuses spending when wood is below cost', () => {
    expect(canSpendWood(19, 20)).toBe(false);
  });

  it('refuses spending when cost is negative', () => {
    expect(canSpendWood(0, -5)).toBe(false);
  });

  it('refuses spending when cost is zero', () => {
    expect(canSpendWood(20, 0)).toBe(false);
  });

  it('refuses spending when cost is NaN', () => {
    expect(canSpendWood(20, Number.NaN)).toBe(false);
  });

  it('subtracts exactly the cost when spending succeeds', () => {
    expect(spendWood(25, 20)).toEqual({ ok: true, wood: 5 });
  });

  it('does not change wood when spending fails', () => {
    expect(spendWood(12, 20)).toEqual({ ok: false, wood: 12 });
  });

  it('does not change wood when spending a negative cost fails', () => {
    expect(spendWood(0, -5)).toEqual({ ok: false, wood: 0 });
  });

  it('does not change wood when spending a zero cost fails', () => {
    expect(spendWood(20, 0)).toEqual({ ok: false, wood: 20 });
  });

  it('does not change wood when spending a NaN cost fails', () => {
    expect(spendWood(20, Number.NaN)).toEqual({ ok: false, wood: 20 });
  });
});
