/**
 * 英雄战斗系统
 *
 * 英雄可以攻击附近的敌人，有攻击范围和冷却时间。
 */

import { distanceSquared, type Point } from './math';
import type { EnemyTypeId } from './enemies';

export const HERO_ATTACK_RANGE = 50;
export const HERO_ATTACK_DAMAGE = 8;
export const HERO_ATTACK_COOLDOWN = 0.6;
export const HERO_ATTACK_ARC = 1.2; // 攻击扇形弧度

export interface HeroAttackState {
  cooldownTimer: number;
  isAttacking: boolean;
  attackAnimTimer: number;
  attackAngle: number; // 攻击方向（弧度）
}

export function createHeroAttackState(): HeroAttackState {
  return {
    cooldownTimer: 0,
    isAttacking: false,
    attackAnimTimer: 0,
    attackAngle: 0,
  };
}

export function updateHeroAttack(
  state: HeroAttackState,
  deltaSeconds: number,
  position: Point,
  moveX: number,
  moveY: number,
  isAttacking: boolean,
  enemies: { id: string; type: EnemyTypeId; position: Point; health: number }[],
): { damagedIds: string[]; swingAngle: number } {
  state.cooldownTimer = Math.max(0, state.cooldownTimer - deltaSeconds);
  state.attackAnimTimer = Math.max(0, state.attackAnimTimer - deltaSeconds);

  const damagedIds: string[] = [];
  let swingAngle = -1; // -1 = no swing

  if (isAttacking && state.cooldownTimer <= 0) {
    // 确定攻击方向：优先朝向移动方向，没有移动则朝右
    let angle = Math.atan2(moveY || 0, moveX || 1);
    if (moveX === 0 && moveY === 0) {
      angle = 0; // 默认向右
    }
    state.attackAngle = angle;
    state.isAttacking = true;
    state.attackAnimTimer = 0.25;
    state.cooldownTimer = HERO_ATTACK_COOLDOWN;

    // 扇形范围攻击
    const rangeSq = HERO_ATTACK_RANGE * HERO_ATTACK_RANGE;
    const halfArc = HERO_ATTACK_ARC / 2;
    for (const enemy of enemies) {
      if (enemy.health <= 0) continue;
      const distSq = distanceSquared(position, enemy.position);
      if (distSq <= rangeSq) {
        const enemyAngle = Math.atan2(
          enemy.position.y - position.y,
          enemy.position.x - position.x,
        );
        let angleDiff = enemyAngle - angle;
        // 归一化到 [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        if (Math.abs(angleDiff) <= halfArc) {
          damagedIds.push(enemy.id);
        }
      }
    }

    swingAngle = angle;
  }

  return { damagedIds, swingAngle };
}
