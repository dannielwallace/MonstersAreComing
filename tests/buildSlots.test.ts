import { describe, expect, it } from 'vitest';
import {
  getOpenSlots,
  getSlotWorldPosition,
  selectNextOpenSlot,
  GRID_BUILD_SLOTS,
  CARAVAN_GRID_SIZE,
} from '../src/game/buildSlots';

describe('GRID_BUILD_SLOTS', () => {
  it('defines 12 slots around a 2x2 caravan', () => {
    // 4x4 area minus 2x2 caravan = 12 slots
    expect(GRID_BUILD_SLOTS).toHaveLength(12);
  });

  it('has no building type restriction on any slot', () => {
    GRID_BUILD_SLOTS.forEach((s) => expect(s.buildingType).toBeUndefined());
  });
});

describe('selectNextOpenSlot', () => {
  it('returns the first slot when none are occupied', () => {
    const slot = selectNextOpenSlot(GRID_BUILD_SLOTS, new Set());
    expect(slot).toBeDefined();
    expect(slot?.id).toBe('cell--1--1');
  });

  it('skips occupied slots', () => {
    const occupied = new Set(['cell--1--1']);
    const slot = selectNextOpenSlot(GRID_BUILD_SLOTS, occupied);
    expect(slot).toBeDefined();
    // row=-1, col=0 is the next slot after col=-1,row=-1
    expect(slot?.id).toBe('cell-0--1');
  });

  it('returns undefined when all slots are occupied', () => {
    const occupied = new Set(GRID_BUILD_SLOTS.map((s) => s.id));
    expect(selectNextOpenSlot(GRID_BUILD_SLOTS, occupied)).toBeUndefined();
  });
});

describe('getOpenSlots', () => {
  it('returns all slots when none occupied', () => {
    expect(getOpenSlots(new Set())).toHaveLength(12);
  });

  it('filters out occupied slots', () => {
    const occupied = new Set(['cell--1--1', 'cell-0--1']);
    expect(getOpenSlots(occupied)).toHaveLength(10);
  });
});

describe('getSlotWorldPosition', () => {
  it('adds grid offset scaled by CELL_SIZE to caravan position', () => {
    const caravanTopLeft = { x: 200, y: 300 };
    // col=-1, row=-1 is the first build slot (caravan occupies 0,0 to 1,1)
    const slot = GRID_BUILD_SLOTS.find((s) => s.gridOffset.col === -1 && s.gridOffset.row === -1)!;
    const pos = getSlotWorldPosition(caravanTopLeft, slot);
    // col=-1, row=-1 -> offset (-48, -48)
    expect(pos).toEqual({ x: 152, y: 252 });
  });

  it('handles negative offsets correctly', () => {
    const caravanTopLeft = { x: 200, y: 300 };
    const slot = GRID_BUILD_SLOTS.find((s) => s.gridOffset.col === -1 && s.gridOffset.row === -1)!;
    const pos = getSlotWorldPosition(caravanTopLeft, slot);
    // col=-1, row=-1 -> offset (-48, -48)
    expect(pos).toEqual({ x: 152, y: 252 });
  });
});
