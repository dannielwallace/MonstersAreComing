import type { Point } from './math';

export interface BuildSlot {
  id: string;
  offset: Point;
}

export const STAGE0_BUILD_SLOTS: BuildSlot[] = [
  { id: 'front', offset: { x: 92, y: 0 } },
  { id: 'back', offset: { x: -92, y: 0 } },
  { id: 'upper', offset: { x: 0, y: -78 } },
  { id: 'lower', offset: { x: 0, y: 78 } },
  { id: 'upper-front', offset: { x: 92, y: -78 } },
  { id: 'lower-front', offset: { x: 92, y: 78 } },
  { id: 'upper-back', offset: { x: -92, y: -78 } },
  { id: 'lower-back', offset: { x: -92, y: 78 } },
];

export function selectNextOpenSlot(slots: BuildSlot[], occupiedSlotIds: Set<string>): string | undefined {
  return slots.find((slot) => !occupiedSlotIds.has(slot.id))?.id;
}

export function getSlotWorldPosition(caravanPosition: Point, slot: BuildSlot): Point {
  return {
    x: caravanPosition.x + slot.offset.x,
    y: caravanPosition.y + slot.offset.y,
  };
}
