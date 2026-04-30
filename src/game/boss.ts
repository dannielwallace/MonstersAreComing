export interface BossState {
  active: boolean;
  health: number;
  maxHealth: number;
  phase: number;
  summonTimer: number;
}

export interface BossUpdateResult {
  state: BossState;
  spawnEggs: number;
}

export function createBossState(): BossState {
  return { active: false, health: 0, maxHealth: 0, phase: 0, summonTimer: 0 };
}

export function startBoss(maxHealth = 500): BossState {
  return { active: true, health: maxHealth, maxHealth, phase: 1, summonTimer: 4 };
}

export function updateBossState(state: BossState, deltaSeconds: number): BossUpdateResult {
  if (!state.active) return { state, spawnEggs: 0 };
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const phase = state.health <= state.maxHealth * 0.5 ? 2 : 1;
  const summonTimer = state.summonTimer - delta;
  if (summonTimer <= 0) {
    return {
      state: { ...state, phase, summonTimer: phase === 2 ? 3.5 : 5 },
      spawnEggs: phase === 2 ? 3 : 2,
    };
  }
  return { state: { ...state, phase, summonTimer }, spawnEggs: 0 };
}
