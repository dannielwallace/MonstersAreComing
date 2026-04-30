export type WeaponType = 'axe' | 'saw' | 'ritual-dagger' | 'drill';

export interface WeaponDefinition {
  type: WeaponType;
  name: string;
  range: number;
  damage: number;
  cooldown: number;
  hitCount: number;
  createsMinionOnKill?: boolean;
  harvestMultiplier?: number;
}

export interface OwnedWeapon {
  type: WeaponType;
  cooldownTimer: number;
  damageMultiplier: number;
  cooldownMultiplier: number;
  rangeBonus: number;
}

export interface WeaponState {
  owned: OwnedWeapon[];
}

export interface WeaponUpgrade {
  damageMultiplier?: number;
  cooldownMultiplier?: number;
  rangeBonus?: number;
}

export const WEAPON_DEFINITIONS: Record<WeaponType, WeaponDefinition> = {
  axe: { type: 'axe', name: '斧头', range: 56, damage: 8, cooldown: 0.6, hitCount: 3, harvestMultiplier: 1.2 },
  saw: { type: 'saw', name: '旋锯', range: 80, damage: 5, cooldown: 0.35, hitCount: 6, harvestMultiplier: 1.8 },
  'ritual-dagger': { type: 'ritual-dagger', name: '仪式弹', range: 160, damage: 7, cooldown: 0.7, hitCount: 1, createsMinionOnKill: true },
  drill: { type: 'drill', name: '钻头', range: 110, damage: 14, cooldown: 0.9, hitCount: 2, harvestMultiplier: 2.2 },
};

export function getWeaponDefinition(type: string): WeaponDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(WEAPON_DEFINITIONS, type)
    ? WEAPON_DEFINITIONS[type as WeaponType]
    : undefined;
}

function createOwnedWeapon(type: WeaponType): OwnedWeapon {
  return { type, cooldownTimer: 0, damageMultiplier: 1, cooldownMultiplier: 1, rangeBonus: 0 };
}

export function createWeaponState(): WeaponState {
  return { owned: [createOwnedWeapon('axe')] };
}

export function addWeapon(state: WeaponState, type: WeaponType): WeaponState {
  if (state.owned.some((weapon) => weapon.type === type)) return state;
  return { owned: [...state.owned, createOwnedWeapon(type)] };
}

export function upgradeWeapon(state: WeaponState, type: WeaponType, upgrade: WeaponUpgrade): WeaponState {
  return {
    owned: state.owned.map((weapon) => {
      if (weapon.type !== type) return weapon;
      return {
        ...weapon,
        damageMultiplier: weapon.damageMultiplier * (upgrade.damageMultiplier ?? 1),
        cooldownMultiplier: weapon.cooldownMultiplier * (upgrade.cooldownMultiplier ?? 1),
        rangeBonus: weapon.rangeBonus + (upgrade.rangeBonus ?? 0),
      };
    }),
  };
}

export function updateWeaponTimers(state: WeaponState, deltaSeconds: number): WeaponState {
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  return {
    owned: state.owned.map((weapon) => ({
      ...weapon,
      cooldownTimer: Math.max(0, weapon.cooldownTimer - delta),
    })),
  };
}

export function markWeaponFired(weapon: OwnedWeapon): OwnedWeapon {
  const definition = WEAPON_DEFINITIONS[weapon.type];
  return { ...weapon, cooldownTimer: definition.cooldown * weapon.cooldownMultiplier };
}
