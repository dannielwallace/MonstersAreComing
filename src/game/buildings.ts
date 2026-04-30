import {
  canAfford,
  spendResources,
  type ResourceAmounts,
  type ResourceWallet,
} from './resources';

export interface GridSlotRef {
  id: string;
  gridOffset: {
    col: number;
    row: number;
  };
}

export type BuildingType =
  | 'arrow'
  | 'catapult'
  | 'wall'
  | 'fire'
  | 'ice'
  | 'minion'
  | 'blast-minion'
  | 'attack-banner'
  | 'speed-banner';

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  shortLabel: string;
  category: 'attack' | 'defense' | 'summon' | 'support';
  cost: ResourceAmounts;
  range: number;
  damage: number;
  fireInterval: number;
  splashRadius: number;
  summonType?: 'basic' | 'bomber';
  support?: {
    damageMultiplier?: number;
    fireIntervalMultiplier?: number;
  };
}

export interface PlacedBuilding {
  slotId: string;
  type: BuildingType;
}

export interface AdjacencyBonus {
  damageMultiplier: number;
  fireIntervalMultiplier: number;
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  arrow: {
    type: 'arrow',
    name: '箭塔',
    shortLabel: 'A',
    category: 'attack',
    cost: { wood: 20 },
    range: 190,
    damage: 10,
    fireInterval: 0.55,
    splashRadius: 0,
  },
  catapult: {
    type: 'catapult',
    name: '投石车',
    shortLabel: 'C',
    category: 'attack',
    cost: { wood: 25, stone: 10 },
    range: 180,
    damage: 25,
    fireInterval: 1.8,
    splashRadius: 60,
  },
  wall: {
    type: 'wall',
    name: '城墙',
    shortLabel: 'W',
    category: 'defense',
    cost: { wood: 15 },
    range: 0,
    damage: 0,
    fireInterval: 0,
    splashRadius: 0,
  },
  fire: {
    type: 'fire',
    name: 'Fire Tower',
    shortLabel: 'F',
    category: 'attack',
    cost: { wood: 20, gold: 8 },
    range: 155,
    damage: 8,
    fireInterval: 0.35,
    splashRadius: 34,
  },
  ice: {
    type: 'ice',
    name: 'Ice Tower',
    shortLabel: 'I',
    category: 'attack',
    cost: { stone: 14, gold: 6 },
    range: 170,
    damage: 4,
    fireInterval: 0.75,
    splashRadius: 0,
  },
  minion: {
    type: 'minion',
    name: 'Summon Tower',
    shortLabel: 'S',
    category: 'summon',
    cost: { wood: 18, gold: 10 },
    range: 0,
    damage: 0,
    fireInterval: 3.5,
    splashRadius: 0,
    summonType: 'basic',
  },
  'blast-minion': {
    type: 'blast-minion',
    name: 'Bomber Tower',
    shortLabel: 'B',
    category: 'summon',
    cost: { stone: 18, gold: 12 },
    range: 0,
    damage: 0,
    fireInterval: 5,
    splashRadius: 0,
    summonType: 'bomber',
  },
  'attack-banner': {
    type: 'attack-banner',
    name: 'War Banner',
    shortLabel: 'D+',
    category: 'support',
    cost: { wood: 12, gold: 12 },
    range: 0,
    damage: 0,
    fireInterval: 0,
    splashRadius: 0,
    support: { damageMultiplier: 1.35 },
  },
  'speed-banner': {
    type: 'speed-banner',
    name: 'Drum Tower',
    shortLabel: 'S+',
    category: 'support',
    cost: { wood: 12, gold: 12 },
    range: 0,
    damage: 0,
    fireInterval: 0,
    splashRadius: 0,
    support: { fireIntervalMultiplier: 0.75 },
  },
};

const RESOURCE_LABELS: [keyof ResourceAmounts, string][] = [
  ['wood', 'wood'],
  ['stone', 'stone'],
  ['gold', 'gold'],
  ['xp', 'xp'],
  ['meta', 'meta'],
];

export function getBuildingDefinition(type: string): BuildingDefinition | undefined {
  return BUILDING_DEFINITIONS[type as BuildingType];
}

export function getBuildingCostText(type: BuildingType): string {
  const cost = BUILDING_DEFINITIONS[type].cost;
  const parts = RESOURCE_LABELS.flatMap(([resourceType, label]) => {
    const amount = cost[resourceType];
    return amount && amount > 0 ? [`${amount} ${label}`] : [];
  });
  return parts.length > 0 ? parts.join(', ') : 'Free';
}

export function canBuild(wallet: ResourceWallet, type: BuildingType): boolean {
  return canAfford(wallet, BUILDING_DEFINITIONS[type].cost);
}

export function spendBuildingCost(
  wallet: ResourceWallet,
  type: BuildingType,
): { ok: boolean; wallet: ResourceWallet } {
  return spendResources(wallet, BUILDING_DEFINITIONS[type].cost);
}

export function getAdjacentSlotIds(slotId: string, slots: GridSlotRef[]): string[] {
  const slot = slots.find((candidate) => candidate.id === slotId);
  if (!slot) {
    return [];
  }

  return slots
    .filter((candidate) => {
      const colDistance = Math.abs(candidate.gridOffset.col - slot.gridOffset.col);
      const rowDistance = Math.abs(candidate.gridOffset.row - slot.gridOffset.row);
      return colDistance + rowDistance === 1;
    })
    .map((candidate) => candidate.id);
}

export function computeAdjacencyBonus(
  slotId: string,
  slots: GridSlotRef[],
  buildings: PlacedBuilding[],
): AdjacencyBonus {
  const adjacentSlotIds = new Set(getAdjacentSlotIds(slotId, slots));

  return buildings.reduce<AdjacencyBonus>(
    (bonus, building) => {
      if (!adjacentSlotIds.has(building.slotId)) {
        return bonus;
      }

      const support = BUILDING_DEFINITIONS[building.type].support;
      return {
        damageMultiplier: bonus.damageMultiplier * (support?.damageMultiplier ?? 1),
        fireIntervalMultiplier:
          bonus.fireIntervalMultiplier * (support?.fireIntervalMultiplier ?? 1),
      };
    },
    { damageMultiplier: 1, fireIntervalMultiplier: 1 },
  );
}
