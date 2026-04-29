import { describe, expect, it } from 'vitest';
import { getObjectiveText } from '../src/game/objective';

describe('getObjectiveText', () => {
  it('asks the player to gather wood before they can afford a tower', () => {
    expect(
      getObjectiveText({
        wood: 19.9,
        towerCost: 20,
        hasOpenTowerSlot: true,
        caravanThreatened: false,
      }),
    ).toBe('目标：采集木材');
  });

  it('asks the player to build when wood is enough and a slot is open', () => {
    expect(
      getObjectiveText({
        wood: 20,
        towerCost: 20,
        hasOpenTowerSlot: true,
        caravanThreatened: false,
      }),
    ).toBe('目标：建造箭塔');
  });

  it('asks the player to gather when all tower slots are filled', () => {
    expect(
      getObjectiveText({
        wood: 100,
        towerCost: 20,
        hasOpenTowerSlot: false,
        caravanThreatened: false,
      }),
    ).toBe('目标：采集木材');
  });

  it('prioritizes defense when the caravan is threatened', () => {
    expect(
      getObjectiveText({
        wood: 100,
        towerCost: 20,
        hasOpenTowerSlot: true,
        caravanThreatened: true,
      }),
    ).toBe('目标：防守行城');
  });
});
