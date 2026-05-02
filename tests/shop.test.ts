import { describe, expect, it } from 'vitest';
import {
  createShopState,
  purchaseShopItem,
  rerollShop,
  type ShopItem,
} from '../src/game/shop';

const pool: ShopItem[] = [
  { id: 'b-fire', kind: 'building', buildingType: 'fire', name: 'Fire Tower', description: 'Fire tower test', cost: { gold: 8 } },
  { id: 'w-saw', kind: 'weapon', weaponType: 'saw', name: 'Saw', description: 'Saw test', cost: { gold: 10 } },
  { id: 'heal', kind: 'repair', repairAmount: 25, name: 'Repair', description: 'Repair test', cost: { stone: 5 } },
  { id: 'gold', kind: 'resource', grant: { gold: 5 }, name: 'Gold Cache', description: 'Gold test', cost: {} },
];

describe('shop', () => {
  it('creates deterministic stock', () => {
    const shop = createShopState(pool, 3, () => 0);
    expect(shop.stock.map((item) => item.id)).toEqual(['b-fire', 'w-saw', 'heal']);
    expect(shop.rerollCost).toBe(5);
  });

  it('purchases an affordable item and removes it from stock', () => {
    const shop = createShopState(pool, 3, () => 0);
    const result = purchaseShopItem(shop, { wood: 0, stone: 5, gold: 8, xp: 0, meta: 0 }, 'b-fire');
    expect(result.ok).toBe(true);
    expect(result.wallet).toEqual({ wood: 0, stone: 5, gold: 0, xp: 0, meta: 0 });
    expect(result.shop.stock.map((item) => item.id)).toEqual(['w-saw', 'heal']);
    expect(result.item?.id).toBe('b-fire');
  });

  it('does not buy missing or unaffordable items', () => {
    const shop = createShopState(pool, 3, () => 0);
    expect(purchaseShopItem(shop, { wood: 0, stone: 0, gold: 0, xp: 0, meta: 0 }, 'b-fire').ok).toBe(false);
    expect(purchaseShopItem(shop, { wood: 0, stone: 0, gold: 99, xp: 0, meta: 0 }, 'missing').ok).toBe(false);
  });

  it('rerolls stock and increases reroll cost', () => {
    const shop = createShopState(pool, 2, () => 0);
    const result = rerollShop(shop, { wood: 0, stone: 0, gold: 5, xp: 0, meta: 0 }, () => 0.75);
    expect(result.ok).toBe(true);
    expect(result.wallet.gold).toBe(0);
    expect(result.shop.rerollCost).toBe(8);
    expect(result.shop.stock).toHaveLength(2);
  });
});
