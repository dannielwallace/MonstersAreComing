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
  | 'catapult-reload'
  | 'weapon-damage'
  | 'weapon-speed'
  | 'weapon-range'
  | 'building-card-arrow'
  | 'building-card-fire'
  | 'building-card-ice'
  | 'building-card-catapult'
  | 'summon-damage'
  | 'summon-count';

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
  weaponDamageMultiplier: number;
  weaponCooldownMultiplier: number;
  weaponRangeBonus: number;
  summonDamageMultiplier: number;
  summonExtraCount: number;
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
  gatherRate: 50,
  caravanMaxHealth: 500,
  caravanHealth: 500,
  wallMaxHealth: 80,
  pendingWallRepair: 0,
  catapultDamage: 25,
  catapultFireInterval: 1.8,
  catapultRange: 180,
  catapultSplashRadius: 60,
  weaponDamageMultiplier: 1,
  weaponCooldownMultiplier: 1,
  weaponRangeBonus: 0,
  summonDamageMultiplier: 1,
  summonExtraCount: 0,
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
  {
    id: 'weapon-damage',
    name: '锋刃打磨',
    description: '英雄武器伤害 +30%',
  },
  {
    id: 'weapon-speed',
    name: '迅捷挥舞',
    description: '英雄攻击速度 +20%',
  },
  {
    id: 'weapon-range',
    name: '长柄延伸',
    description: '英雄武器范围 +15',
  },
  {
    id: 'building-card-arrow',
    name: '箭塔蓝图',
    description: '获得一个箭塔建造卡',
  },
  {
    id: 'building-card-fire',
    name: '火塔蓝图',
    description: '获得一个火塔建造卡',
  },
  {
    id: 'building-card-ice',
    name: '冰塔蓝图',
    description: '获得一个冰塔建造卡',
  },
  {
    id: 'building-card-catapult',
    name: '投石车蓝图',
    description: '获得一个投石车建造卡',
  },
  {
    id: 'summon-damage',
    name: '仆从强化',
    description: '召唤物伤害 +25%',
  },
  {
    id: 'summon-count',
    name: '仆从增殖',
    description: '召唤塔每次多召唤 1 个仆从',
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
    case 'weapon-damage':
      return { ...stats, weaponDamageMultiplier: stats.weaponDamageMultiplier * 1.3 };
    case 'weapon-speed':
      return { ...stats, weaponCooldownMultiplier: stats.weaponCooldownMultiplier * 0.8 };
    case 'weapon-range':
      return { ...stats, weaponRangeBonus: stats.weaponRangeBonus + 15 };
    case 'building-card-arrow':
    case 'building-card-fire':
    case 'building-card-ice':
    case 'building-card-catapult':
      // Building card upgrades are handled by the scene (they add cards to hand)
      return stats;
    case 'summon-damage':
      return { ...stats, summonDamageMultiplier: stats.summonDamageMultiplier * 1.25 };
    case 'summon-count':
      return { ...stats, summonExtraCount: stats.summonExtraCount + 1 };
    default: {
      const exhaustive: never = upgradeId;
      return exhaustive;
    }
  }
}
