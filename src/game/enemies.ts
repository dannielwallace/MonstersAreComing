export type EnemyTypeId = 'grunt' | 'runner' | 'brute';

export interface EnemyDefinition {
  type: EnemyTypeId;
  name: string;
  label: string;
  color: number;
  radius: number;
  health: number;
  speed: number;
  contactDamage: number;
  experienceReward: number;
  budgetCost: number;
  unlockWave: number;
}

export const ENEMY_TYPE_ORDER: EnemyTypeId[] = ['grunt', 'runner', 'brute'];

export const ENEMY_DEFINITIONS: Record<EnemyTypeId, EnemyDefinition> = {
  grunt: {
    type: 'grunt',
    name: '普通',
    label: '普',
    color: 0xef4444,
    radius: 13,
    health: 30,
    speed: 72,
    contactDamage: 5,
    experienceReward: 5,
    budgetCost: 1,
    unlockWave: 1,
  },
  runner: {
    type: 'runner',
    name: '迅捷',
    label: '快',
    color: 0xf97316,
    radius: 10,
    health: 18,
    speed: 118,
    contactDamage: 4,
    experienceReward: 4,
    budgetCost: 1,
    unlockWave: 2,
  },
  brute: {
    type: 'brute',
    name: '重甲',
    label: '甲',
    color: 0x7f1d1d,
    radius: 18,
    health: 85,
    speed: 45,
    contactDamage: 9,
    experienceReward: 10,
    budgetCost: 3,
    unlockWave: 4,
  },
};

export function getEnemyDefinition(type: string): EnemyDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(ENEMY_DEFINITIONS, type)
    ? ENEMY_DEFINITIONS[type as EnemyTypeId]
    : undefined;
}

export function getUnlockedEnemyTypes(waveNumber: number): EnemyTypeId[] {
  const normalizedWave = Number.isFinite(waveNumber) && waveNumber >= 1 ? Math.floor(waveNumber) : 1;

  return ENEMY_TYPE_ORDER.filter(
    (type) => ENEMY_DEFINITIONS[type].unlockWave <= normalizedWave,
  );
}
