/**
 * 城堡行进障碍物检测
 *
 * 纯函数：给定城堡+建筑的前沿单元格列表和障碍物，返回是否阻挡。
 */

import type { Point } from './math';

/** 前沿方向上的一个单元格（X右边界 + Y范围） */
export interface ForwardCell {
  xRight: number;
  yTop: number;
  yBottom: number;
}

/** 障碍物包围盒 */
export interface Obstacle {
  position: Point;
  radius: number;
  active: boolean;
}

/**
 * 计算城堡+建筑的最前右边缘
 */
export function computeForwardEdge(cells: ForwardCell[]): number {
  let max = 0;
  for (const cell of cells) {
    if (cell.xRight > max) max = cell.xRight;
  }
  return max;
}

/**
 * 判断障碍物是否阻挡城堡行进方向
 *
 * 阻挡条件：
 * 1. 障碍物左边缘 >= forwardEdge（严格在前方）
 * 2. 障碍物左边缘 < sweptEdge（在本帧移动范围内）
 * 3. 障碍物Y方向与任一前沿单元格重叠
 */
export function isObstacleBlocking(
  obstacle: Obstacle,
  forwardEdge: number,
  sweptEdge: number,
  forwardCells: ForwardCell[],
): boolean {
  if (!obstacle.active) return false;

  const left = obstacle.position.x - obstacle.radius;
  const right = obstacle.position.x + obstacle.radius;
  const top = obstacle.position.y - obstacle.radius;
  const bottom = obstacle.position.y + obstacle.radius;

  // Must be in front of the forward edge
  if (left < forwardEdge || left >= sweptEdge) return false;

  // Check Y overlap with any forward cell
  for (const cell of forwardCells) {
    if (bottom > cell.yTop && top < cell.yBottom) {
      const overlap = Math.min(bottom, cell.yBottom) - Math.max(top, cell.yTop);
      if (overlap >= 10) return true;
    }
  }
  return false;
}

/**
 * 从城堡本体和已占用槽位构建前沿单元格列表
 */
export function buildForwardCells(
  caravanTopLeft: Point,
  caravanGridSize: number,
  cellSize: number,
  occupiedSlotGridOffsets: Array<{ col: number; row: number }>,
): ForwardCell[] {
  const cells: ForwardCell[] = [];

  // Caravan body right edge
  cells.push({
    xRight: caravanTopLeft.x + caravanGridSize * cellSize,
    yTop: caravanTopLeft.y,
    yBottom: caravanTopLeft.y + caravanGridSize * cellSize,
  });

  // Each occupied building slot
  for (const slot of occupiedSlotGridOffsets) {
    const slotRight = caravanTopLeft.x + (slot.col + 1) * cellSize;
    const slotTop = caravanTopLeft.y + slot.row * cellSize;
    const slotBottom = caravanTopLeft.y + (slot.row + 1) * cellSize;
    cells.push({ xRight: slotRight, yTop: slotTop, yBottom: slotBottom });
  }

  return cells;
}
