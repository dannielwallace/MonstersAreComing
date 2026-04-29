import { describe, expect, it } from 'vitest';
import { getSlotWorldPosition, selectNextOpenSlot, STAGE0_BUILD_SLOTS } from '../src/game/buildSlots';

describe('selectNextOpenSlot', () => {
  it('returns the first slot when none are occupied', () => {
    expect(selectNextOpenSlot(STAGE0_BUILD_SLOTS, new Set())).toBe('front');
  });

  it('skips occupied slots', () => {
    expect(selectNextOpenSlot(STAGE0_BUILD_SLOTS, new Set(['front', 'back']))).toBe('upper');
  });

  it('returns undefined when all slots are occupied', () => {
    const occupied = new Set(STAGE0_BUILD_SLOTS.map((slot) => slot.id));
    expect(selectNextOpenSlot(STAGE0_BUILD_SLOTS, occupied)).toBeUndefined();
  });
});

describe('getSlotWorldPosition', () => {
  it('adds slot offset to the caravan position', () => {
    const slot = { id: 'test', offset: { x: 10, y: -20 } };
    expect(getSlotWorldPosition({ x: 100, y: 200 }, slot)).toEqual({ x: 110, y: 180 });
  });
});
