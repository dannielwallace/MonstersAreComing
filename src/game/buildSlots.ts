import {
  getBuildingCostText as getCatalogCostText,
  getBuildingDefinition,
  type BuildingType,
} from './buildings';
import type { Point } from './math';

export type { BuildingType } from './buildings';

export const CELL_SIZE = 48;

/**
 * 网格坐标（相对于行城左上角的格子偏移）
 */
export interface GridCoord {
  col: number;
  row: number;
}

/**
 * 建筑槽位定义
 */
export interface BuildSlot {
  id: string;
  gridOffset: GridCoord;  // 相对于行城左上角的格子偏移
  buildingType?: BuildingType; // 限制该格子只能建某种建筑
}

/**
 * 行城占用 2x2 格子
 */
export const CARAVAN_GRID_SIZE = 2;

/**
 * 行城本体占用的格子坐标（相对于行城左上角）
 */
const CARAVAN_OCCUPIED: Set<string> = new Set();
for (let r = 0; r < CARAVAN_GRID_SIZE; r++) {
  for (let c = 0; c < CARAVAN_GRID_SIZE; c++) {
    CARAVAN_OCCUPIED.add(`${c},${r}`);
  }
}

/**
 * 邻接一圈的格子（行城外圈，不包括行城本体）
 * 行城是 2x2，邻接一圈是 4x4 减去内部 2x2 = 12 个格子
 */
export const GRID_BUILD_SLOTS: BuildSlot[] = (() => {
  const slots: BuildSlot[] = [];
  // 邻接范围：col -1 到 2, row -1 到 2（行城占 0,0 到 1,1）
  for (let r = -1; r <= CARAVAN_GRID_SIZE; r++) {
    for (let c = -1; c <= CARAVAN_GRID_SIZE; c++) {
      if (CARAVAN_OCCUPIED.has(`${c},${r}`)) {
        continue; // 跳过行城本体
      }
      const key = `cell-${c}-${r}`;
      // 前方 4 格（col=2）只允许建墙，其他格子无限制
      const isFrontColumn = c === CARAVAN_GRID_SIZE;
      slots.push({
        id: key,
        gridOffset: { col: c, row: r },
        buildingType: isFrontColumn ? 'wall' : undefined,
      });
    }
  }
  return slots;
})();

/**
 * 获取槽位的像素偏移（相对于行城左上角）
 */
export function getSlotPixelOffset(slot: BuildSlot): Point {
  return {
    x: slot.gridOffset.col * CELL_SIZE,
    y: slot.gridOffset.row * CELL_SIZE,
  };
}

/**
 * 获取槽位的世界坐标
 */
export function getSlotWorldPosition(caravanTopLeft: Point, slot: BuildSlot): Point {
  const offset = getSlotPixelOffset(slot);
  return {
    x: caravanTopLeft.x + offset.x,
    y: caravanTopLeft.y + offset.y,
  };
}

/**
 * 行城的中心点（用于碰撞、相机跟随等）
 */
export function getCaravanCenter(caravanTopLeft: Point): Point {
  return {
    x: caravanTopLeft.x + (CARAVAN_GRID_SIZE * CELL_SIZE) / 2,
    y: caravanTopLeft.y + (CARAVAN_GRID_SIZE * CELL_SIZE) / 2,
  };
}

/**
 * 获取指定格子坐标对应的 BuildSlot
 */
export function getSlotByGridCoord(col: number, row: number): BuildSlot | undefined {
  return GRID_BUILD_SLOTS.find(
    (slot) => slot.gridOffset.col === col && slot.gridOffset.row === row,
  );
}

/**
 * 查找空闲的建造槽位（返回第一个）
 */
export function selectNextOpenSlot(
  slots: BuildSlot[],
  occupiedSlotIds: Set<string>,
): BuildSlot | undefined {
  return slots.find((slot) => !occupiedSlotIds.has(slot.id));
}

/**
 * 获取所有空闲槽位
 */
export function getOpenSlots(
  occupiedSlotIds: Set<string>,
): BuildSlot[] {
  return GRID_BUILD_SLOTS.filter((slot) => !occupiedSlotIds.has(slot.id));
}

/**
 * 判断某个格子是否已被占用
 */
export function isSlotOccupied(
  occupiedSlotIds: Set<string>,
  slotId: string,
): boolean {
  return occupiedSlotIds.has(slotId);
}

/**
 * 获取建筑类型的中文名称
 */
export function getBuildingName(type: BuildingType): string {
  return getBuildingDefinition(type)?.name ?? type;
}

/**
 * 获取建筑类型的成本描述
 */
export function getBuildingCostText(type: BuildingType): string {
  return getCatalogCostText(type);
}
