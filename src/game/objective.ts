export interface ObjectiveState {
  wood: number;
  towerCost: number;
  hasOpenTowerSlot: boolean;
  caravanThreatened: boolean;
}

export const OBJECTIVE_GATHER = '目标：采集木材';
export const OBJECTIVE_BUILD = '目标：建造箭塔';
export const OBJECTIVE_DEFEND = '目标：防守行城';

export function getObjectiveText(state: ObjectiveState): string {
  if (state.caravanThreatened) {
    return OBJECTIVE_DEFEND;
  }

  if (state.wood >= state.towerCost && state.hasOpenTowerSlot) {
    return OBJECTIVE_BUILD;
  }

  return OBJECTIVE_GATHER;
}
