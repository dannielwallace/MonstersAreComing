export interface BuildingResult {
  id: string;
  name: string;
  damage: number;
  kills: number;
}

export interface RunResults {
  heroDamage: number;
  cityDamage: number;
  buildings: Record<string, BuildingResult>;
}

export function createRunResults(): RunResults {
  return { heroDamage: 0, cityDamage: 0, buildings: {} };
}

function cleanDamage(damage: number): number {
  return Number.isFinite(damage) && damage > 0 ? damage : 0;
}

export function addHeroDamage(results: RunResults, damage: number): RunResults {
  return { ...results, heroDamage: results.heroDamage + cleanDamage(damage) };
}

export function addBuildingDamage(
  results: RunResults,
  id: string,
  name: string,
  damage: number,
): RunResults {
  const current = results.buildings[id] ?? { id, name, damage: 0, kills: 0 };
  const nextBuilding = { ...current, damage: current.damage + cleanDamage(damage) };
  return {
    ...results,
    cityDamage: results.cityDamage + cleanDamage(damage),
    buildings: { ...results.buildings, [id]: nextBuilding },
  };
}

export function addBuildingKill(results: RunResults, id: string): RunResults {
  const current = results.buildings[id];
  if (!current) return results;
  return {
    ...results,
    buildings: { ...results.buildings, [id]: { ...current, kills: current.kills + 1 } },
  };
}

export function formatBuildingDpsRows(results: RunResults, elapsedSeconds: number): string[] {
  const duration = Math.max(1, elapsedSeconds);
  return Object.values(results.buildings)
    .sort((a, b) => b.damage - a.damage)
    .map((building) => `${building.name} ${building.id}：伤害 ${Math.floor(building.damage)} DPS ${(building.damage / duration).toFixed(1)} 击杀 ${building.kills}`);
}
