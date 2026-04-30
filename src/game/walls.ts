import type { Point } from './math';

export const WALL_COST = 15;
export const WALL_DEFAULT_HP = 60;

export interface WallState {
  id: string;
  slotId: string;
  position: Point;
  health: number;
  maxHealth: number;
}

export function createWall(slotId: string, position: Point, maxHp: number): WallState {
  return {
    id: `wall-${slotId}`,
    slotId,
    position: { ...position },
    health: maxHp,
    maxHealth: maxHp,
  };
}

export function damageWall(wall: WallState, damage: number): WallState {
  const newHealth = Math.max(0, wall.health - damage);
  return {
    ...wall,
    health: newHealth,
  };
}

export function isWallDestroyed(wall: WallState): boolean {
  return wall.health <= 0;
}

export function getWallHealthRatio(wall: WallState): number {
  if (wall.maxHealth <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, wall.health / wall.maxHealth));
}
