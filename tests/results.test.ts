import { describe, expect, it } from 'vitest';
import {
  addBuildingDamage,
  addHeroDamage,
  createRunResults,
  formatBuildingDpsRows,
} from '../src/game/results';

describe('run results', () => {
  it('tracks hero and building damage separately', () => {
    const results = addBuildingDamage(addHeroDamage(createRunResults(), 20), 'tower-1', '箭塔', 30);
    expect(results.heroDamage).toBe(20);
    expect(results.cityDamage).toBe(30);
    expect(results.buildings['tower-1']).toEqual({ id: 'tower-1', name: '箭塔', damage: 30, kills: 0 });
  });

  it('formats building DPS rows sorted by damage', () => {
    let results = createRunResults();
    results = addBuildingDamage(results, 'a', '箭塔', 20);
    results = addBuildingDamage(results, 'b', '火塔', 60);
    expect(formatBuildingDpsRows(results, 10)).toEqual(['火塔 b：伤害 60 DPS 6.0 击杀 0', '箭塔 a：伤害 20 DPS 2.0 击杀 0']);
  });
});
