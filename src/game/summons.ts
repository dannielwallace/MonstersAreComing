import type { Point } from './math';

export type MinionType = 'basic' | 'bomber' | 'decaying';

export interface MinionDefinition {
  type: MinionType;
  name: string;
  health: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  lifetime?: number;
  deathExplosion?: { damage: number; radius: number };
}

export interface MinionState {
  id: string;
  type: MinionType;
  position: Point;
  health: number;
  attackTimer: number;
  lifetimeRemaining?: number;
}

export interface SummonState {
  minions: MinionState[];
  nextId: number;
  damageMultiplier: number;
}

export type MinionDeathEffect = {
  type: 'explosion';
  damage: number;
  radius: number;
  position: Point;
} | {
  type: 'resource-drop';
  resource: 'gold' | 'wood' | 'stone' | 'xp';
  amount: number;
  position: Point;
};

export const MINION_DEFINITIONS: Record<MinionType, MinionDefinition> = {
  basic: { type: 'basic', name: '仆从', health: 18, damage: 6, speed: 96, attackRange: 24, attackCooldown: 0.7 },
  bomber: {
    type: 'bomber', name: '爆仆', health: 10, damage: 0, speed: 118, attackRange: 20, attackCooldown: 1,
    deathExplosion: { damage: 30, radius: 48 },
  },
  decaying: { type: 'decaying', name: '残影', health: 8, damage: 5, speed: 110, attackRange: 22, attackCooldown: 0.6, lifetime: 7 },
};

export function getMinionDefinition(type: string): MinionDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(MINION_DEFINITIONS, type)
    ? MINION_DEFINITIONS[type as MinionType]
    : undefined;
}

export function createSummonState(): SummonState {
  return { minions: [], nextId: 0, damageMultiplier: 1 };
}

export function spawnMinion(state: SummonState, type: MinionType, position: Point): SummonState {
  const definition = MINION_DEFINITIONS[type];
  const minion: MinionState = {
    id: `minion-${state.nextId}`,
    type,
    position: { ...position },
    health: definition.health,
    attackTimer: 0,
    lifetimeRemaining: definition.lifetime,
  };
  return { ...state, minions: [...state.minions, minion], nextId: state.nextId + 1 };
}

export function updateMinionLifetime(state: SummonState, deltaSeconds: number): SummonState {
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  return {
    ...state,
    minions: state.minions
      .map((minion) => minion.lifetimeRemaining === undefined
        ? minion
        : { ...minion, lifetimeRemaining: minion.lifetimeRemaining - delta })
      .filter((minion) => minion.lifetimeRemaining === undefined || minion.lifetimeRemaining > 0),
  };
}

export function killMinion(
  state: SummonState,
  minionId: string,
  synergy?: {
    deathExplosionBonus?: number;
    deathResourceChance?: number;
    deathResourceType?: 'gold' | 'wood' | 'stone' | 'xp';
    explosionRadiusMult?: number;
  },
): { state: SummonState; effects: MinionDeathEffect[] } {
  const minion = state.minions.find((candidate) => candidate.id === minionId);
  if (!minion) return { state, effects: [] };
  const def = MINION_DEFINITIONS[minion.type];
  const effects: MinionDeathEffect[] = [];

  // Base explosion (bomber) or bonus explosion from synergy
  const baseExplosion = def.deathExplosion;
  const bonusDmg = synergy?.deathExplosionBonus ?? 0;
  const radiusMult = synergy?.explosionRadiusMult ?? 1;
  const explosionDmg = baseExplosion ? baseExplosion.damage + bonusDmg : bonusDmg;
  const explosionRadius = baseExplosion ? Math.round(baseExplosion.radius * radiusMult) : 36;
  if (explosionDmg > 0) {
    effects.push({ type: 'explosion', damage: explosionDmg, radius: explosionRadius, position: { ...minion.position } });
  }

  // Resource drop from synergy
  if (synergy?.deathResourceChance && synergy.deathResourceChance > 0 && Math.random() < synergy.deathResourceChance) {
    const resType = synergy.deathResourceType ?? 'gold';
    effects.push({ type: 'resource-drop', resource: resType, amount: 1, position: { ...minion.position } });
  }

  return {
    state: { ...state, minions: state.minions.filter((candidate) => candidate.id !== minionId) },
    effects,
  };
}
