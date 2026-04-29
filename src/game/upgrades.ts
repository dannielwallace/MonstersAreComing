export type UpgradeId =
  | 'tower-range'
  | 'tower-damage'
  | 'tower-reload'
  | 'gather-rate'
  | 'caravan-max-health'
  | 'caravan-repair';

export interface RunStats {
  towerRange: number;
  towerDamage: number;
  towerFireInterval: number;
  gatherRate: number;
  caravanMaxHealth: number;
  caravanHealth: number;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
}

export type RandomFn = () => number;

export const MIN_TOWER_FIRE_INTERVAL = 0.25;

export const DEFAULT_RUN_STATS: RunStats = {
  towerRange: 190,
  towerDamage: 10,
  towerFireInterval: 0.55,
  gatherRate: 8,
  caravanMaxHealth: 100,
  caravanHealth: 100,
};

export const UPGRADE_POOL: UpgradeDefinition[] = [
  {
    id: 'tower-range',
    name: '箭塔校准',
    description: '箭塔射程 +20',
  },
  {
    id: 'tower-damage',
    name: '重弩箭头',
    description: '箭塔伤害 +5',
  },
  {
    id: 'tower-reload',
    name: '快速装填',
    description: '箭塔攻击间隔 -12%',
  },
  {
    id: 'gather-rate',
    name: '伐木熟手',
    description: '采集速度 +25%',
  },
  {
    id: 'caravan-max-health',
    name: '坚固车体',
    description: '行城最大生命 +20，并回复 20',
  },
  {
    id: 'caravan-repair',
    name: '前线修补',
    description: '立即回复行城 25 点生命',
  },
];

export function pickUpgradeChoices(
  pool: UpgradeDefinition[] = UPGRADE_POOL,
  count = 3,
  random: RandomFn = Math.random,
): UpgradeDefinition[] {
  const candidates = [...pool];
  const choices: UpgradeDefinition[] = [];

  while (choices.length < count && candidates.length > 0) {
    const roll = Math.min(Math.max(random(), 0), 0.999999999);
    const index = Math.floor(roll * candidates.length);
    const [choice] = candidates.splice(index, 1);
    choices.push(choice);
  }

  return choices;
}

export function applyUpgrade(stats: RunStats, upgradeId: UpgradeId): RunStats {
  switch (upgradeId) {
    case 'tower-range':
      return {
        ...stats,
        towerRange: stats.towerRange + 20,
      };
    case 'tower-damage':
      return {
        ...stats,
        towerDamage: stats.towerDamage + 5,
      };
    case 'tower-reload':
      return {
        ...stats,
        towerFireInterval: Math.max(MIN_TOWER_FIRE_INTERVAL, stats.towerFireInterval * 0.88),
      };
    case 'gather-rate':
      return {
        ...stats,
        gatherRate: stats.gatherRate * 1.25,
      };
    case 'caravan-max-health': {
      const caravanMaxHealth = stats.caravanMaxHealth + 20;
      return {
        ...stats,
        caravanMaxHealth,
        caravanHealth: Math.min(caravanMaxHealth, stats.caravanHealth + 20),
      };
    }
    case 'caravan-repair':
      return {
        ...stats,
        caravanHealth: Math.min(stats.caravanMaxHealth, stats.caravanHealth + 25),
      };
    default: {
      const exhaustive: never = upgradeId;
      return exhaustive;
    }
  }
}
