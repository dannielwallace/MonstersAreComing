export type EnemyTypeId = 'grunt' | 'runner' | 'brute' | 'thrower' | 'burst' | 'boss';

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
  rangedAttackDamage?: number;
  rangedAttackCooldown?: number;
  preferredDistance?: number;
  minionSpawnInterval?: number;
  minionType?: EnemyTypeId;
  minionCount?: number;
}

export const ENEMY_TYPE_ORDER: EnemyTypeId[] = ['grunt', 'runner', 'brute', 'thrower', 'burst', 'boss'];

export const ENEMY_DEFINITIONS: Record<EnemyTypeId, EnemyDefinition> = {
  grunt: {
    type: 'grunt',
    name: '普通',
    label: '普',
    color: 0xef4444,
    radius: 13,
    health: 20,
    speed: 65,
    contactDamage: 2,
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
    health: 12,
    speed: 105,
    contactDamage: 2,
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
    health: 60,
    speed: 40,
    contactDamage: 4,
    experienceReward: 10,
    budgetCost: 3,
    unlockWave: 4,
  },
  thrower: {
    type: 'thrower',
    name: '投石怪',
    label: '投',
    color: 0xff6b35,
    radius: 12,
    health: 18,
    speed: 50,
    contactDamage: 2,
    experienceReward: 6,
    budgetCost: 2,
    unlockWave: 3,
    rangedAttackDamage: 3,
    rangedAttackCooldown: 2.0,
    preferredDistance: 200,
  },
  burst: {
    type: 'burst',
    name: '爆裂虫',
    label: '爆',
    color: 0xffd600,
    radius: 8,
    health: 8,
    speed: 115,
    contactDamage: 12,
    experienceReward: 3,
    budgetCost: 1,
    unlockWave: 5,
  },
  boss: {
    type: 'boss',
    name: '首领',
    label: '首',
    color: 0x9c27b0,
    radius: 35,
    health: 300,
    speed: 22,
    contactDamage: 8,
    experienceReward: 50,
    budgetCost: 15,
    unlockWave: 8,
    minionSpawnInterval: 6,
    minionType: 'grunt',
    minionCount: 2,
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
