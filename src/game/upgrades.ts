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
  | 'summon-count'
  | 'summon-death-harvest'
  | 'summon-death-burst'
  | 'summon-horde'
  | 'summon-synergy';

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
  summonDeathResourceChance: number;
  summonDeathExplosionBonus: number;
  summonAliveTowerDamage: number;
  summonGlobalDamageMultiplier: number;
}

export type UpgradeRarity = 'common' | 'rare' | 'epic';

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  rarity: UpgradeRarity;
}

export type RandomFn = () => number;

export const MIN_TOWER_FIRE_INTERVAL = 0.25;
export const MIN_CATAPULT_FIRE_INTERVAL = 0.5;

export const DEFAULT_RUN_STATS: RunStats = {
  towerRange: 190,
  towerDamage: 10,
  towerFireInterval: 0.55,
  gatherRate: 500,
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
  summonDeathResourceChance: 0,
  summonDeathExplosionBonus: 0,
  summonAliveTowerDamage: 0,
  summonGlobalDamageMultiplier: 1,
};

export const UPGRADE_POOL: UpgradeDefinition[] = [
  // Common upgrades — basic stat bumps
  {
    id: 'tower-range',
    name: '箭塔校准',
    description: '箭塔射程 +20',
    rarity: 'common',
  },
  {
    id: 'tower-damage',
    name: '重弩箭头',
    description: '箭塔伤害 +5',
    rarity: 'common',
  },
  {
    id: 'tower-reload',
    name: '快速装填',
    description: '箭塔攻击间隔 -12%',
    rarity: 'common',
  },
  {
    id: 'gather-rate',
    name: '伐木熟手',
    description: '采集速度 +25%',
    rarity: 'common',
  },
  {
    id: 'caravan-max-health',
    name: '坚固车体',
    description: '行城最大生命 +20，并回复 20',
    rarity: 'common',
  },
  {
    id: 'caravan-repair',
    name: '前线修补',
    description: '立即回复行城 25 点生命',
    rarity: 'common',
  },
  {
    id: 'wall-health',
    name: '加固城墙',
    description: '城墙最大生命 +30',
    rarity: 'common',
  },
  {
    id: 'wall-repair',
    name: '紧急抢修',
    description: '立即修复所有城墙 40 点生命',
    rarity: 'common',
  },
  {
    id: 'weapon-damage',
    name: '锋刃打磨',
    description: '英雄武器伤害 +30%',
    rarity: 'common',
  },
  {
    id: 'weapon-speed',
    name: '迅捷挥舞',
    description: '英雄攻击速度 +20%',
    rarity: 'common',
  },
  {
    id: 'weapon-range',
    name: '长柄延伸',
    description: '英雄武器范围 +15',
    rarity: 'common',
  },
  {
    id: 'building-card-arrow',
    name: '箭塔蓝图',
    description: '获得一个箭塔建造卡',
    rarity: 'common',
  },
  {
    id: 'building-card-fire',
    name: '火塔蓝图',
    description: '获得一个火塔建造卡',
    rarity: 'common',
  },
  {
    id: 'building-card-ice',
    name: '冰塔蓝图',
    description: '获得一个冰塔建造卡',
    rarity: 'common',
  },
  {
    id: 'building-card-catapult',
    name: '投石车蓝图',
    description: '获得一个投石车建造卡',
    rarity: 'common',
  },
  // Rare upgrades — stronger / specialized effects
  {
    id: 'catapult-damage',
    name: '重型弹丸',
    description: '投石车伤害 +10',
    rarity: 'rare',
  },
  {
    id: 'catapult-reload',
    name: '快速抛射',
    description: '投石车攻击间隔 -15%',
    rarity: 'rare',
  },
  {
    id: 'summon-damage',
    name: '仆从强化',
    description: '召唤物伤害 +25%',
    rarity: 'rare',
  },
  {
    id: 'summon-count',
    name: '仆从增殖',
    description: '召唤塔每次多召唤 1 个仆从',
    rarity: 'rare',
  },
  // Epic upgrades — game-changing synergies
  {
    id: 'summon-death-harvest',
    name: '魂收',
    description: '召唤物死亡时 30% 概率掉落 1 金币',
    rarity: 'epic',
  },
  {
    id: 'summon-death-burst',
    name: '亡爆',
    description: '所有召唤物死亡时造成 +15 范围爆炸伤害，范围 +50%',
    rarity: 'epic',
  },
  {
    id: 'summon-horde',
    name: '亡灵海',
    description: '每存活一个召唤物，所有塔伤害 +2',
    rarity: 'epic',
  },
  {
    id: 'summon-synergy',
    name: '死灵共鸣',
    description: '召唤物全局伤害 +40%',
    rarity: 'epic',
  },
];

/**
 * Rarity weights: common 60%, rare 30%, epic 10%
 */
const RARITY_WEIGHTS: { rarity: UpgradeRarity; weight: number }[] = [
  { rarity: 'common', weight: 0.60 },
  { rarity: 'rare', weight: 0.30 },
  { rarity: 'epic', weight: 0.10 },
];

function pickRarity(random: RandomFn): UpgradeRarity {
  const roll = random();
  let cumulative = 0;
  for (const entry of RARITY_WEIGHTS) {
    cumulative += entry.weight;
    if (roll < cumulative) return entry.rarity;
  }
  return 'common';
}

export function pickUpgradeChoices(
  pool: UpgradeDefinition[] = UPGRADE_POOL,
  count = 3,
  random: RandomFn = Math.random,
): UpgradeDefinition[] {
  const byRarity = new Map<UpgradeRarity, UpgradeDefinition[]>();
  for (const def of pool) {
    const list = byRarity.get(def.rarity) ?? [];
    list.push(def);
    byRarity.set(def.rarity, list);
  }

  const choices: UpgradeDefinition[] = [];
  const usedIds = new Set<string>();

  while (choices.length < count) {
    const rarity = pickRarity(random);
    const candidates = (byRarity.get(rarity) ?? []).filter((d) => !usedIds.has(d.id));
    if (candidates.length === 0) continue; // skip this rarity, try again
    const index = Math.floor(random() * candidates.length);
    const choice = candidates[index];
    choices.push(choice);
    usedIds.add(choice.id);
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
    case 'summon-death-harvest':
      return { ...stats, summonDeathResourceChance: 0.3 };
    case 'summon-death-burst':
      return { ...stats, summonDeathExplosionBonus: stats.summonDeathExplosionBonus + 15 };
    case 'summon-horde':
      return { ...stats, summonAliveTowerDamage: stats.summonAliveTowerDamage + 2 };
    case 'summon-synergy':
      return { ...stats, summonGlobalDamageMultiplier: stats.summonGlobalDamageMultiplier * 1.4 };
    default: {
      const exhaustive: never = upgradeId;
      return exhaustive;
    }
  }
}
