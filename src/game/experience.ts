export interface ExperienceState {
  level: number;
  experience: number;
  pendingLevelUps: number;
}

export const ENEMY_EXPERIENCE_REWARD = 5;

export function createExperienceState(): ExperienceState {
  return {
    level: 1,
    experience: 0,
    pendingLevelUps: 0,
  };
}

export function requiredExperienceForLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  return 20 + (normalizedLevel - 1) * 12;
}

export function addExperience(state: ExperienceState, amount: number): ExperienceState {
  let level = state.level;
  let experience = state.experience + Math.max(0, amount);
  let pendingLevelUps = state.pendingLevelUps;

  while (experience >= requiredExperienceForLevel(level)) {
    experience -= requiredExperienceForLevel(level);
    level += 1;
    pendingLevelUps += 1;
  }

  return {
    level,
    experience,
    pendingLevelUps,
  };
}

export function consumePendingLevelUp(state: ExperienceState): ExperienceState {
  return {
    ...state,
    pendingLevelUps: Math.max(0, state.pendingLevelUps - 1),
  };
}

export function hasPendingLevelUp(state: ExperienceState): boolean {
  return state.pendingLevelUps > 0;
}
