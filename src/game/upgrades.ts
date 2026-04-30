export type UpgradeId =
  | 'tower-range'
  | 'tower-damage'
  | 'tower-reload'
  | 'gather-rate'
  | 'caravan-max-health'
  | 'caravan-repair'
  | 'wall-health'
  | 'wall-repair'
  | 'catapult-damage'
  | 'catapult-reload';

export interface RunStats {
  towerRange: number;
  towerDamage: number;
  towerFireInterval: number;
  gatherRate: number;
  caravanMaxHealth: number;
  caravanHealth: number;
  wallMaxHealth: number;
  pendingWallRepair: number;
  catapultDamage: number;
  catapultFireInterval: number;
  catapultRange: number;
  catapultSplashRadius: number;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
}

export type RandomFn = () => number;

export const MIN_TOWER_FIRE_INTERVAL = 0.25;
export const MIN_CATAPULT_FIRE_INTERVAL = 0.5;

export const DEFAULT_RUN_STATS: RunStats = {
  towerRange: 190,
  towerDamage: 10,
  towerFireInterval: 0.55,
  gatherRate: 8,
  caravanMaxHealth: 100,
  caravanHealth: 100,
  wallMaxHealth: 60,
  pendingWallRepair: 0,
  catapultDamage: 25,
  catapultFireInterval: 1.8,
  catapultRange: 180,
  catapultSplashRadius: 60,
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
  {
    id: 'wall-health',
    name: '加固城墙',
    description: '城墙最大生命 +30',
  },
  {
    id: 'wall-repair',
    name: '紧急抢修',
    description: '立即修复所有城墙 40 点生命',
  },
  {
    id: 'catapult-damage',
    name: '重型弹丸',
    description: '投石车伤害 +10',
  },
  {
    id: 'catapult-reload',
    name: '快速抛射',
    description: '投石车攻击间隔 -15%',
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
    case 'wall-health':
      return {
        ...stats,
        wallMaxHealth: stats.wallMaxHealth + 30,
      };
    case 'wall-repair':
      return {
        ...stats,
        pendingWallRepair: stats.pendingWallRepair + 40,
      };
    case 'catapult-damage':
      return {
        ...stats,
        catapultDamage: stats.catapultDamage + 10,
      };
    case 'catapult-reload':
      return {
        ...stats,
        catapultFireInterval: Math.max(MIN_CATAPULT_FIRE_INTERVAL, stats.catapultFireInterval * 0.85),
      };
    default: {
      const exhaustive: never = upgradeId;
      return exhaustive;
    }
  }
}
