import { distanceSquared, type Point } from './math';

export interface Targetable {
  id: string;
  position: Point;
  health: number;
}

export interface DamageResult {
  health: number;
  dead: boolean;
}

export function selectNearestTarget<T extends Targetable>(
  origin: Point,
  enemies: T[],
  range: number,
): T | undefined {
  const rangeSquared = range * range;
  let best: T | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (enemy.health <= 0) {
      continue;
    }

    const candidateDistance = distanceSquared(origin, enemy.position);
    if (candidateDistance <= rangeSquared && candidateDistance < bestDistance) {
      best = enemy;
      bestDistance = candidateDistance;
    }
  }

  return best;
}

export function applyDamage(currentHealth: number, damage: number): DamageResult {
  const health = Math.max(0, currentHealth - damage);
  return {
    health,
    dead: health === 0,
  };
}

export function selectHighestHealthTarget<T extends Targetable>(
  origin: Point,
  enemies: T[],
  range: number,
): T | undefined {
  const rangeSquared = range * range;
  let best: T | undefined;
  let bestHealth = -1;

  for (const enemy of enemies) {
    if (enemy.health <= 0) {
      continue;
    }

    const dist = distanceSquared(origin, enemy.position);
    if (dist <= rangeSquared && enemy.health > bestHealth) {
      best = enemy;
      bestHealth = enemy.health;
    }
  }

  return best;
}
