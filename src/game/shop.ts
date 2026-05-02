import type { BuildingType } from './buildings';
import { spendResources, type ResourceAmounts, type ResourceWallet } from './resources';

export type ShopItemKind = 'building' | 'weapon' | 'repair' | 'resource';

export interface ShopItem {
  id: string;
  kind: ShopItemKind;
  name: string;
  description: string;
  cost: ResourceAmounts;
  buildingType?: BuildingType;
  weaponType?: 'axe' | 'saw' | 'ritual-dagger' | 'drill';
  repairAmount?: number;
  grant?: ResourceAmounts;
}

export interface ShopState {
  stock: ShopItem[];
  pool: ShopItem[];
  stockSize: number;
  rerollCost: number;
}

export const DEFAULT_SHOP_POOL: ShopItem[] = [
  { id: 'shop-arrow', kind: 'building', buildingType: 'arrow', name: '箭塔', description: '自动攻击范围内最近敌人，伤害 +5/次', cost: { gold: 6 } },
  { id: 'shop-fire', kind: 'building', buildingType: 'fire', name: '火塔', description: '攻击造成范围燃烧伤害，附带持续灼烧效果', cost: { gold: 8 } },
  { id: 'shop-ice', kind: 'building', buildingType: 'ice', name: '冰塔', description: '攻击减速敌人，降低移动和攻击速度', cost: { gold: 8 } },
  { id: 'shop-minion', kind: 'building', buildingType: 'minion', name: '召唤塔', description: '定期召唤亡灵仆从，仆从自动迎敌作战', cost: { gold: 10 } },
  { id: 'shop-saw', kind: 'weapon', weaponType: 'saw', name: '旋锯', description: '英雄远程武器，范围AOE伤害，可同时命中多个敌人', cost: { gold: 10 } },
  { id: 'shop-dagger', kind: 'weapon', weaponType: 'ritual-dagger', name: '仪式弹', description: '英雄远程武器，击杀敌人后召唤残影（7秒寿命）', cost: { gold: 12 } },
  { id: 'shop-repair', kind: 'repair', repairAmount: 25, name: '修理行城', description: '立即回复行城 25 点生命值', cost: { stone: 5 } },
  { id: 'shop-gold-cache', kind: 'resource', grant: { gold: 6 }, name: '金币箱', description: '获得 6 金币', cost: {} },
];

function pickStock(pool: ShopItem[], stockSize: number, random: () => number): ShopItem[] {
  const candidates = [...pool];
  const stock: ShopItem[] = [];
  while (stock.length < stockSize && candidates.length > 0) {
    const index = Math.min(
      candidates.length - 1,
      Math.floor(Math.max(0, Math.min(0.999999, random())) * candidates.length),
    );
    const [item] = candidates.splice(index, 1);
    stock.push(item);
  }
  return stock;
}

export function createShopState(
  pool: ShopItem[] = DEFAULT_SHOP_POOL,
  stockSize = 4,
  random: () => number = Math.random,
): ShopState {
  return {
    stock: pickStock(pool, stockSize, random),
    pool,
    stockSize,
    rerollCost: 5,
  };
}

export function purchaseShopItem(
  shop: ShopState,
  wallet: ResourceWallet,
  itemId: string,
): { ok: boolean; shop: ShopState; wallet: ResourceWallet; item?: ShopItem } {
  const item = shop.stock.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, shop, wallet };
  const spent = spendResources(wallet, item.cost);
  if (!spent.ok) return { ok: false, shop, wallet };
  return {
    ok: true,
    wallet: spent.wallet,
    item,
    shop: { ...shop, stock: shop.stock.filter((candidate) => candidate.id !== itemId) },
  };
}

export function rerollShop(
  shop: ShopState,
  wallet: ResourceWallet,
  random: () => number = Math.random,
): { ok: boolean; shop: ShopState; wallet: ResourceWallet } {
  const spent = spendResources(wallet, { gold: shop.rerollCost });
  if (!spent.ok) return { ok: false, shop, wallet };
  return {
    ok: true,
    wallet: spent.wallet,
    shop: {
      ...shop,
      stock: pickStock(shop.pool, shop.stockSize, random),
      rerollCost: shop.rerollCost + 3,
    },
  };
}
