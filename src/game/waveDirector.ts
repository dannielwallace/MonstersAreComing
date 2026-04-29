import {
  ENEMY_DEFINITIONS,
  getUnlockedEnemyTypes,
  type EnemyTypeId,
} from './enemies';

export interface WaveState {
  currentWave: number;
  nextWaveTimer: number;
}

export interface WaveUpdateResult {
  state: WaveState;
  startedWave: boolean;
  spawnedEnemies: EnemyTypeId[];
}

export const FIRST_WAVE_DELAY = 8;
export const WAVE_INTERVAL = 14;

export function createWaveState(): WaveState {
  return {
    currentWave: 0,
    nextWaveTimer: FIRST_WAVE_DELAY,
  };
}

export function getWaveBudget(waveNumber: number): number {
  const normalizedWave = Number.isFinite(waveNumber)
    ? Math.max(0, Math.floor(waveNumber))
    : 0;

  return 3 + normalizedWave * 2;
}

export function selectEnemyTypesForWave(waveNumber: number): EnemyTypeId[] {
  return selectEnemyTypesForBudget(waveNumber, getWaveBudget(waveNumber));
}

export function selectEnemyTypesForBudget(
  waveNumber: number,
  budget: number,
): EnemyTypeId[] {
  if (!Number.isFinite(budget) || budget <= 0) {
    return [];
  }

  const unlockedEnemyTypes = getUnlockedEnemyTypes(waveNumber);
  const spawnedEnemies: EnemyTypeId[] = [];
  let remainingBudget = Math.floor(budget);

  const highestUnlockedEnemy = unlockedEnemyTypes[unlockedEnemyTypes.length - 1];
  const highestCost = ENEMY_DEFINITIONS[highestUnlockedEnemy].budgetCost;

  if (highestCost <= remainingBudget) {
    spawnedEnemies.push(highestUnlockedEnemy);
    remainingBudget -= highestCost;
  }

  const fillPattern = unlockedEnemyTypes.filter(
    (type) => type === 'grunt' || type === 'runner',
  );

  for (let fillIndex = 0; remainingBudget > 0 && fillPattern.length > 0; fillIndex += 1) {
    const enemyType = fillPattern[fillIndex % fillPattern.length];
    const enemyCost = ENEMY_DEFINITIONS[enemyType].budgetCost;

    if (enemyCost > remainingBudget) {
      break;
    }

    spawnedEnemies.push(enemyType);
    remainingBudget -= enemyCost;
  }

  return spawnedEnemies;
}

export function updateWaveState(
  state: WaveState,
  deltaSeconds: number,
  interval = WAVE_INTERVAL,
): WaveUpdateResult {
  if (
    !Number.isFinite(deltaSeconds)
    || deltaSeconds <= 0
    || !Number.isFinite(interval)
    || interval <= 0
  ) {
    return {
      state,
      startedWave: false,
      spawnedEnemies: [],
    };
  }

  const nextWaveTimer = state.nextWaveTimer - deltaSeconds;

  if (nextWaveTimer > 0) {
    return {
      state: {
        currentWave: state.currentWave,
        nextWaveTimer,
      },
      startedWave: false,
      spawnedEnemies: [],
    };
  }

  const currentWave = state.currentWave + 1;

  return {
    state: {
      currentWave,
      nextWaveTimer: interval,
    },
    startedWave: true,
    spawnedEnemies: selectEnemyTypesForWave(currentWave),
  };
}
