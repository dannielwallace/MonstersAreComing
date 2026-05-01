/**
 * 动态资源节点管理器
 *
 * 随着行城前进，在前方不断生成新的树木和石料节点。
 * 超过相机后方视野的节点自动回收。
 */

import type { Point } from './math';

export interface ResourceNode {
  id: string;
  position: Point;
  remaining: number;
  maxAmount: number;
  type: 'wood' | 'stone' | 'gold';
  // 视觉属性
  radius: number;
  color: number;
}

export interface ResourceSpawnerState {
  woodNodes: ResourceNode[];
  stoneNodes: ResourceNode[];
  goldNodes: ResourceNode[];
  nextId: number;
  lastSpawnX: number; // 上次生成资源的最右 X 坐标
}

const WOOD_SPAWN_INTERVAL = 180; // 每多少 px 生成一批木材
const STONE_SPAWN_INTERVAL = 280; // 每多少 px 生成一批石料
const GOLD_SPAWN_INTERVAL = 500; // 每多少 px 生成一批金矿
const SPAWN_AHEAD_MARGIN = 1200; // 在行城前方多远生成
const CLEANUP_BEHIND_MARGIN = 600; // 在行城后方多远清理

const WOOD_AMOUNT_MIN = 15;
const WOOD_AMOUNT_MAX = 30;
const STONE_AMOUNT_MIN = 10;
const STONE_AMOUNT_MAX = 25;
const GOLD_AMOUNT_MIN = 6;
const GOLD_AMOUNT_MAX = 12;

function randomBetween(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

export function createResourceSpawnerState(initialX = 0): ResourceSpawnerState {
  return {
    woodNodes: [],
    stoneNodes: [],
    goldNodes: [],
    nextId: 0,
    lastSpawnX: initialX,
  };
}

/**
 * 根据行城位置动态生成和清理资源
 */
export function updateResourceSpawner(
  state: ResourceSpawnerState,
  caravanX: number,
  cameraRight: number,
  cameraLeft: number,
  sceneHeight: number,
  rng: () => number,
): {
  spawned: ResourceNode[];
  cleanedUp: string[];
} {
  const spawned: ResourceNode[] = [];
  const cleanedUp: string[] = [];

  // 生成新资源：在 caravanX + SPAWN_AHEAD_MARGIN 范围内生成
  const spawnTargetX = caravanX + SPAWN_AHEAD_MARGIN;
  while (state.lastSpawnX < spawnTargetX) {
    state.lastSpawnX += WOOD_SPAWN_INTERVAL;

    // 生成木材
    const woodAmount = Math.round(randomBetween(WOOD_AMOUNT_MIN, WOOD_AMOUNT_MAX, rng));
    const woodY = randomBetween(80, sceneHeight - 80, rng);
    const woodNode: ResourceNode = {
      id: `wood-${state.nextId++}`,
      position: { x: state.lastSpawnX, y: woodY },
      remaining: woodAmount,
      maxAmount: woodAmount,
      type: 'wood',
      radius: 18,
      color: 0x4caf50,
    };
    state.woodNodes.push(woodNode);
    spawned.push(woodNode);

    // 每两个木材节点之间生成一个石料
    if (state.nextId % 2 === 0) {
      const stoneSpawnX = state.lastSpawnX + Math.round(STONE_SPAWN_INTERVAL / 2);
      const stoneAmount = Math.round(randomBetween(STONE_AMOUNT_MIN, STONE_AMOUNT_MAX, rng));
      const stoneY = randomBetween(80, sceneHeight - 80, rng);
      const stoneNode: ResourceNode = {
        id: `stone-${state.nextId++}`,
        position: { x: stoneSpawnX, y: stoneY },
        remaining: stoneAmount,
        maxAmount: stoneAmount,
        type: 'stone',
        radius: 14,
        color: 0x78909c,
      };
      state.stoneNodes.push(stoneNode);
      spawned.push(stoneNode);
    }

    // 每隔一段距离概率生成金矿
    if (state.nextId % 3 === 0 && rng() < 0.45) {
      const goldSpawnX = state.lastSpawnX + Math.round(GOLD_SPAWN_INTERVAL / 2);
      const goldAmount = Math.round(randomBetween(GOLD_AMOUNT_MIN, GOLD_AMOUNT_MAX, rng));
      const goldY = randomBetween(80, sceneHeight - 80, rng);
      const goldNode: ResourceNode = {
        id: `gold-${state.nextId++}`,
        position: { x: goldSpawnX, y: goldY },
        remaining: goldAmount,
        maxAmount: goldAmount,
        type: 'gold',
        radius: 12,
        color: 0xd4a820,
      };
      state.goldNodes.push(goldNode);
      spawned.push(goldNode);
    }
  }

  // 清理超过相机后方视野的资源
  const cleanupX = cameraLeft - CLEANUP_BEHIND_MARGIN;
  state.woodNodes = state.woodNodes.filter((node) => {
    if (node.position.x < cleanupX && node.remaining <= 0) {
      cleanedUp.push(node.id);
      return false;
    }
    return true;
  });
  state.stoneNodes = state.stoneNodes.filter((node) => {
    if (node.position.x < cleanupX && node.remaining <= 0) {
      cleanedUp.push(node.id);
      return false;
    }
    return true;
  });
  state.goldNodes = state.goldNodes.filter((node) => {
    if (node.position.x < cleanupX && node.remaining <= 0) {
      cleanedUp.push(node.id);
      return false;
    }
    return true;
  });

  return { spawned, cleanedUp };
}

/**
 * 从节点数组中移除已耗尽的节点（返回需要销毁的节点 ID）
 */
export function collectDepletedNodes(nodes: ResourceNode[]): ResourceNode[] {
  const depleted: ResourceNode[] = [];
  const kept: ResourceNode[] = [];
  for (const node of nodes) {
    if (node.remaining <= 0) {
      depleted.push(node);
    } else {
      kept.push(node);
    }
  }
  return depleted;
}
