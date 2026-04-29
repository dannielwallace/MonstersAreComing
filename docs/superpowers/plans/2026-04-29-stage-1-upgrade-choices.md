# Stage 1 Upgrade Choices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first in-run upgrade loop: enemies grant XP on death, level-ups pause combat, and the player chooses one of three Chinese upgrade options.

**Architecture:** Keep deterministic XP and upgrade rules in pure TypeScript modules with Vitest coverage. Keep Phaser scene work focused on wiring enemy death, runtime stats, HUD text, pause state, input, and the upgrade overlay.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest.

---

## File Structure

- Create: `src/game/experience.ts` - pure XP thresholds, gain logic, pending level-up tracking, and enemy XP reward.
- Create: `tests/experience.test.ts` - XP threshold, overflow, and pending level-up tests.
- Create: `src/game/upgrades.ts` - upgrade definitions, default run stats, choice drawing, and stat application.
- Create: `tests/upgrades.test.ts` - upgrade pool, deterministic draw, and stat effect tests.
- Modify: `src/scenes/GameScene.ts` - runtime stats, XP on enemy death, Chinese HUD additions, upgrade pause, keyboard/mouse selection, overlay lifecycle.
- Modify: `docs/superpowers/plans/2026-04-29-stage-1-upgrade-choices.md` - mark task checkboxes as work is completed.

---

### Task 1: Experience Rule Module

**Files:**
- Create: `src/game/experience.ts`
- Create: `tests/experience.test.ts`

- [ ] **Step 1: Write the failing experience tests**

Create `tests/experience.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addExperience,
  consumePendingLevelUp,
  createExperienceState,
  ENEMY_EXPERIENCE_REWARD,
  hasPendingLevelUp,
  requiredExperienceForLevel,
} from '../src/game/experience';

describe('requiredExperienceForLevel', () => {
  it('starts at 20 experience for level 1', () => {
    expect(requiredExperienceForLevel(1)).toBe(20);
  });

  it('increases by 12 experience per level', () => {
    expect(requiredExperienceForLevel(2)).toBe(32);
    expect(requiredExperienceForLevel(5)).toBe(68);
  });
});

describe('experience progression', () => {
  it('starts at level 1 with no experience or pending choices', () => {
    expect(createExperienceState()).toEqual({ level: 1, experience: 0, pendingLevelUps: 0 });
  });

  it('uses 5 experience as the enemy death reward', () => {
    expect(ENEMY_EXPERIENCE_REWARD).toBe(5);
  });

  it('adds experience without leveling when below the threshold', () => {
    expect(addExperience(createExperienceState(), 5)).toEqual({
      level: 1,
      experience: 5,
      pendingLevelUps: 0,
    });
  });

  it('levels up and queues one pending upgrade choice at the threshold', () => {
    expect(addExperience(createExperienceState(), 20)).toEqual({
      level: 2,
      experience: 0,
      pendingLevelUps: 1,
    });
  });

  it('preserves overflow experience after leveling', () => {
    expect(addExperience(createExperienceState(), 25)).toEqual({
      level: 2,
      experience: 5,
      pendingLevelUps: 1,
    });
  });

  it('queues multiple pending level-ups when a large reward crosses multiple thresholds', () => {
    expect(addExperience(createExperienceState(), 100)).toEqual({
      level: 4,
      experience: 4,
      pendingLevelUps: 3,
    });
  });

  it('consumes one pending level-up after an upgrade is selected', () => {
    const state = { level: 3, experience: 2, pendingLevelUps: 2 };

    expect(consumePendingLevelUp(state)).toEqual({ level: 3, experience: 2, pendingLevelUps: 1 });
  });

  it('reports whether an upgrade choice is waiting', () => {
    expect(hasPendingLevelUp({ level: 1, experience: 0, pendingLevelUps: 0 })).toBe(false);
    expect(hasPendingLevelUp({ level: 2, experience: 0, pendingLevelUps: 1 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the experience tests and confirm RED**

Run:

```bash
npm test -- tests/experience.test.ts
```

Expected: FAIL because `src/game/experience.ts` does not exist.

- [ ] **Step 3: Implement the experience module**

Create `src/game/experience.ts`:

```ts
export interface ExperienceState {
  level: number;
  experience: number;
  pendingLevelUps: number;
}

export const ENEMY_EXPERIENCE_REWARD = 5;

export function createExperienceState(): ExperienceState {
  return {
    level: 1,
    experience: 0,
    pendingLevelUps: 0,
  };
}

export function requiredExperienceForLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  return 20 + (normalizedLevel - 1) * 12;
}

export function addExperience(state: ExperienceState, amount: number): ExperienceState {
  let level = state.level;
  let experience = state.experience + Math.max(0, amount);
  let pendingLevelUps = state.pendingLevelUps;

  while (experience >= requiredExperienceForLevel(level)) {
    experience -= requiredExperienceForLevel(level);
    level += 1;
    pendingLevelUps += 1;
  }

  return {
    level,
    experience,
    pendingLevelUps,
  };
}

export function consumePendingLevelUp(state: ExperienceState): ExperienceState {
  return {
    ...state,
    pendingLevelUps: Math.max(0, state.pendingLevelUps - 1),
  };
}

export function hasPendingLevelUp(state: ExperienceState): boolean {
  return state.pendingLevelUps > 0;
}
```

- [ ] **Step 4: Run the experience tests and confirm GREEN**

Run:

```bash
npm test -- tests/experience.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit experience rules**

```bash
git add src/game/experience.ts tests/experience.test.ts docs/superpowers/plans/2026-04-29-stage-1-upgrade-choices.md
git commit -m "feat: add experience progression rules"
```

---

### Task 2: Upgrade Rule Module

**Files:**
- Create: `src/game/upgrades.ts`
- Create: `tests/upgrades.test.ts`

- [ ] **Step 1: Write the failing upgrade tests**

Create `tests/upgrades.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyUpgrade,
  DEFAULT_RUN_STATS,
  pickUpgradeChoices,
  UPGRADE_POOL,
  type RunStats,
} from '../src/game/upgrades';

describe('UPGRADE_POOL', () => {
  it('contains at least five Chinese upgrade options', () => {
    expect(UPGRADE_POOL.length).toBeGreaterThanOrEqual(5);
    expect(UPGRADE_POOL.map((upgrade) => upgrade.name)).toContain('箭塔校准');
    expect(UPGRADE_POOL.map((upgrade) => upgrade.name)).toContain('坚固车体');
  });
});

describe('pickUpgradeChoices', () => {
  it('returns three unique upgrade choices from the full pool', () => {
    const choices = pickUpgradeChoices(UPGRADE_POOL, 3, () => 0);

    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((choice) => choice.id)).size).toBe(3);
  });

  it('is deterministic when a random function is injected', () => {
    const choices = pickUpgradeChoices(UPGRADE_POOL, 3, () => 0);

    expect(choices.map((choice) => choice.id)).toEqual(['tower-range', 'tower-damage', 'tower-reload']);
  });

  it('returns all available choices when the pool is smaller than the requested count', () => {
    const choices = pickUpgradeChoices(UPGRADE_POOL.slice(0, 2), 3, () => 0);

    expect(choices.map((choice) => choice.id)).toEqual(['tower-range', 'tower-damage']);
  });
});

describe('applyUpgrade', () => {
  const baseStats: RunStats = { ...DEFAULT_RUN_STATS };

  it('increases tower range for 箭塔校准', () => {
    expect(applyUpgrade(baseStats, 'tower-range').towerRange).toBe(210);
  });

  it('increases tower damage for 重弩箭头', () => {
    expect(applyUpgrade(baseStats, 'tower-damage').towerDamage).toBe(15);
  });

  it('reduces tower fire interval for 快速装填', () => {
    expect(applyUpgrade(baseStats, 'tower-reload').towerFireInterval).toBeCloseTo(0.484);
  });

  it('does not reduce tower fire interval below 0.25 seconds', () => {
    expect(applyUpgrade({ ...baseStats, towerFireInterval: 0.26 }, 'tower-reload').towerFireInterval).toBe(0.25);
  });

  it('increases gather rate for 伐木熟手', () => {
    expect(applyUpgrade(baseStats, 'gather-rate').gatherRate).toBe(10);
  });

  it('increases max health and current health for 坚固车体', () => {
    expect(applyUpgrade({ ...baseStats, caravanHealth: 70 }, 'caravan-max-health')).toEqual({
      ...baseStats,
      caravanMaxHealth: 120,
      caravanHealth: 90,
    });
  });

  it('repairs current health without exceeding max health for 前线修补', () => {
    expect(applyUpgrade({ ...baseStats, caravanHealth: 90 }, 'caravan-repair')).toEqual({
      ...baseStats,
      caravanHealth: 100,
    });
  });
});
```

- [ ] **Step 2: Run the upgrade tests and confirm RED**

Run:

```bash
npm test -- tests/upgrades.test.ts
```

Expected: FAIL because `src/game/upgrades.ts` does not exist.

- [ ] **Step 3: Implement the upgrade module**

Create `src/game/upgrades.ts`:

```ts
export type UpgradeId =
  | 'tower-range'
  | 'tower-damage'
  | 'tower-reload'
  | 'gather-rate'
  | 'caravan-max-health'
  | 'caravan-repair';

export interface RunStats {
  towerRange: number;
  towerDamage: number;
  towerFireInterval: number;
  gatherRate: number;
  caravanMaxHealth: number;
  caravanHealth: number;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
}

export type RandomFn = () => number;

export const MIN_TOWER_FIRE_INTERVAL = 0.25;

export const DEFAULT_RUN_STATS: RunStats = {
  towerRange: 190,
  towerDamage: 10,
  towerFireInterval: 0.55,
  gatherRate: 8,
  caravanMaxHealth: 100,
  caravanHealth: 100,
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
    default: {
      const exhaustive: never = upgradeId;
      return exhaustive;
    }
  }
}
```

- [ ] **Step 4: Run the upgrade tests and confirm GREEN**

Run:

```bash
npm test -- tests/upgrades.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit upgrade rules**

```bash
git add src/game/upgrades.ts tests/upgrades.test.ts docs/superpowers/plans/2026-04-29-stage-1-upgrade-choices.md
git commit -m "feat: add upgrade rule pool"
```

---

### Task 3: Runtime Stats, XP Hooks, and HUD

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Update imports and remove upgraded constants**

In `src/scenes/GameScene.ts`, add imports:

```ts
import {
  addExperience,
  createExperienceState,
  ENEMY_EXPERIENCE_REWARD,
  requiredExperienceForLevel,
  type ExperienceState,
} from '../game/experience';
import {
  DEFAULT_RUN_STATS,
  type RunStats,
  type UpgradeDefinition,
} from '../game/upgrades';
```

Remove these constants from `GameScene.ts` because `DEFAULT_RUN_STATS` now owns them:

```ts
const CARAVAN_MAX_HEALTH = 100;
const GATHER_RATE = 8;
const TOWER_RANGE = 190;
const TOWER_FIRE_INTERVAL = 0.55;
const TOWER_DAMAGE = 10;
```

- [ ] **Step 2: Add key and upgrade fields**

Add this type near the entity interfaces:

```ts
type GameKey = 'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R' | 'ONE' | 'TWO' | 'THREE';
```

Change the `keys` field:

```ts
  private keys!: Record<GameKey, Phaser.Input.Keyboard.Key>;
```

Replace `private caravanHealth = CARAVAN_MAX_HEALTH;` with:

```ts
  private stats: RunStats = { ...DEFAULT_RUN_STATS };
  private experience: ExperienceState = createExperienceState();
  private upgradeSelecting = false;
  private upgradeChoices: UpgradeDefinition[] = [];
  private upgradeOverlay?: Phaser.GameObjects.Container;
```

- [ ] **Step 3: Register number keys**

Replace the current `this.keys = this.input.keyboard!.addKeys(...)` block in `create()` with:

```ts
    this.keys = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      R: Phaser.Input.Keyboard.KeyCodes.R,
      ONE: Phaser.Input.Keyboard.KeyCodes.ONE,
      TWO: Phaser.Input.Keyboard.KeyCodes.TWO,
      THREE: Phaser.Input.Keyboard.KeyCodes.THREE,
    }) as Record<GameKey, Phaser.Input.Keyboard.Key>;
```

- [ ] **Step 4: Reset runtime stats and upgrade state**

In `resetState()`, replace the caravan health reset with:

```ts
    this.stats = { ...DEFAULT_RUN_STATS };
    this.experience = createExperienceState();
    this.upgradeSelecting = false;
    this.upgradeChoices = [];
    this.upgradeOverlay = undefined;
```

- [ ] **Step 5: Replace fixed stats in gathering, building, combat, and damage**

In `updateGathering()`, replace fixed gathering values:

```ts
      const gatherAmount = this.stats.gatherRate * deltaSeconds;
```

and replace the gathering feedback with:

```ts
      this.showFeedback(`采集中 +${this.formatNumber(this.stats.gatherRate)}/秒`, '#bbf7d0');
```

In `updateBuilding()`, replace tower range creation:

```ts
    const rangeShape = this.add.circle(position.x, position.y, this.stats.towerRange, 0xffffff, 0);
```

In `updateEnemies()`, replace caravan health damage:

```ts
        this.stats.caravanHealth = Math.max(0, this.stats.caravanHealth - ENEMY_CONTACT_DAMAGE);
```

In `updateTowers()`, replace tower targeting, damage, and fire interval:

```ts
      const target = selectNearestTarget(tower.position, this.enemies, this.stats.towerRange);
      if (!target) {
        continue;
      }

      const result = applyDamage(target.health, this.stats.towerDamage);
      target.health = result.health;
      this.drawShot(tower.position, target.position);
      tower.fireTimer = this.stats.towerFireInterval;
```

- [ ] **Step 6: Award XP on enemy death**

In `updateTowers()`, after removing a dead enemy, call `awardEnemyExperience()`:

```ts
      if (result.dead) {
        target.shape.destroy();
        this.enemies = this.enemies.filter((enemy) => enemy.id !== target.id);
        this.awardEnemyExperience();
      }
```

Add this helper method:

```ts
  private awardEnemyExperience(): void {
    if (this.gameOver || this.stats.caravanHealth <= 0) {
      return;
    }

    this.experience = addExperience(this.experience, ENEMY_EXPERIENCE_REWARD);
  }
```

- [ ] **Step 7: Add stat formatting and upgrade visual refresh helpers**

Add these helper methods:

```ts
  private formatNumber(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  }

  private updateTowerRangeVisuals(): void {
    for (const tower of this.towers) {
      tower.rangeShape.setRadius(this.stats.towerRange);
    }
  }
```

- [ ] **Step 8: Update HUD and game-over health references**

Replace the caravan health line in `updateHud()` and add level/XP lines:

```ts
    this.hud.setText([
      `行城生命：${Math.ceil(this.stats.caravanHealth)}/${this.stats.caravanMaxHealth}`,
      `木材：${Math.floor(this.wood)}`,
      `等级：${this.experience.level}`,
      `经验：${Math.floor(this.experience.experience)}/${requiredExperienceForLevel(this.experience.level)}`,
      `时间：${this.elapsedSeconds.toFixed(1)} 秒`,
      `箭塔：${this.towers.length}/${STAGE0_BUILD_SLOTS.length}`,
      `空格：建造箭塔（${TOWER_COST} 木材）`,
      objective,
    ]);
```

Replace the game-over check in `update()`:

```ts
    if (this.stats.caravanHealth <= 0) {
      this.showGameOver();
    }
```

- [ ] **Step 9: Run scene type-check through build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 10: Commit runtime stats and XP hooks**

```bash
git add src/scenes/GameScene.ts docs/superpowers/plans/2026-04-29-stage-1-upgrade-choices.md
git commit -m "feat: award experience from enemy kills"
```

---

### Task 4: Upgrade Pause, Overlay, and Selection

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Add upgrade selection imports**

Update the existing experience import:

```ts
import {
  addExperience,
  consumePendingLevelUp,
  createExperienceState,
  ENEMY_EXPERIENCE_REWARD,
  hasPendingLevelUp,
  requiredExperienceForLevel,
  type ExperienceState,
} from '../game/experience';
```

Update the existing upgrades import:

```ts
import {
  applyUpgrade,
  DEFAULT_RUN_STATS,
  pickUpgradeChoices,
  UPGRADE_POOL,
  type RunStats,
  type UpgradeDefinition,
} from '../game/upgrades';
```

- [ ] **Step 2: Pause the simulation while choosing an upgrade**

In `update()`, after the game-over block and before `this.elapsedSeconds += deltaSeconds`, add:

```ts
    if (this.upgradeSelecting) {
      this.updateUpgradeInput();
      this.updateHud();
      return;
    }
```

- [ ] **Step 3: Add upgrade choice opening logic**

Add this method:

```ts
  private tryOpenUpgradeChoices(): void {
    if (this.upgradeSelecting || this.gameOver || this.stats.caravanHealth <= 0 || !hasPendingLevelUp(this.experience)) {
      return;
    }

    const choices = pickUpgradeChoices(UPGRADE_POOL, 3, Math.random);
    if (choices.length === 0) {
      return;
    }

    this.upgradeChoices = choices;
    this.upgradeSelecting = true;
    this.showUpgradeOverlay();
  }
```

- [ ] **Step 4: Open upgrade choices after XP gain**

Update `awardEnemyExperience()`:

```ts
  private awardEnemyExperience(): void {
    if (this.gameOver || this.stats.caravanHealth <= 0) {
      return;
    }

    this.experience = addExperience(this.experience, ENEMY_EXPERIENCE_REWARD);
    this.tryOpenUpgradeChoices();
  }
```

- [ ] **Step 5: Add number-key selection**

Add this method:

```ts
  private updateUpgradeInput(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) {
      this.selectUpgrade(0);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) {
      this.selectUpgrade(1);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) {
      this.selectUpgrade(2);
    }
  }
```

- [ ] **Step 6: Add upgrade overlay rendering**

Add this method:

```ts
  private showUpgradeOverlay(): void {
    this.hideUpgradeOverlay();

    const overlay = this.add.container(640, 360);
    overlay.setScrollFactor(0);
    overlay.setDepth(OVERLAY_DEPTH + 20);

    const backdrop = this.add.rectangle(0, 0, 1280, 720, 0x020617, 0.68);
    const panel = this.add.rectangle(0, 0, 760, 430, 0x111827, 0.96);
    panel.setStrokeStyle(2, 0xfacc15, 0.85);

    const title = this.add.text(0, -175, '选择升级', {
      align: 'center',
      color: '#fef3c7',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '32px',
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(0, -135, '按 1 / 2 / 3 选择', {
      align: 'center',
      color: '#cbd5e1',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '18px',
    });
    subtitle.setOrigin(0.5);

    overlay.add([backdrop, panel, title, subtitle]);

    this.upgradeChoices.forEach((choice, index) => {
      const y = -60 + index * 110;
      const card = this.add.rectangle(0, y, 640, 86, 0x1f2937, 1);
      card.setStrokeStyle(1, 0x94a3b8, 0.7);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.selectUpgrade(index));

      const name = this.add.text(-285, y - 22, `${index + 1}. ${choice.name}`, {
        color: '#f8fafc',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '22px',
      });
      name.setOrigin(0, 0.5);

      const description = this.add.text(-285, y + 18, choice.description, {
        color: '#bfdbfe',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        wordWrap: { width: 560 },
      });
      description.setOrigin(0, 0.5);

      overlay.add([card, name, description]);
    });

    this.upgradeOverlay = overlay;
  }
```

- [ ] **Step 7: Add overlay cleanup and selection application**

Add these methods:

```ts
  private hideUpgradeOverlay(): void {
    if (!this.upgradeOverlay) {
      return;
    }

    this.upgradeOverlay.destroy(true);
    this.upgradeOverlay = undefined;
  }

  private selectUpgrade(index: number): void {
    if (!this.upgradeSelecting) {
      return;
    }

    const choice = this.upgradeChoices[index];
    if (!choice) {
      return;
    }

    this.stats = applyUpgrade(this.stats, choice.id);
    this.experience = consumePendingLevelUp(this.experience);
    this.upgradeSelecting = false;
    this.upgradeChoices = [];
    this.hideUpgradeOverlay();
    this.updateTowerRangeVisuals();
    this.updateHud();
    this.tryOpenUpgradeChoices();
  }
```

- [ ] **Step 8: Ensure restart cleanup is explicit**

In `resetState()`, call cleanup before clearing upgrade fields:

```ts
    this.hideUpgradeOverlay();
    this.upgradeSelecting = false;
    this.upgradeChoices = [];
    this.upgradeOverlay = undefined;
```

If `hideUpgradeOverlay()` is called before `this.upgradeOverlay` exists during the first scene creation, it safely returns.

- [ ] **Step 9: Run full automated verification**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 10: Commit upgrade overlay**

```bash
git add src/scenes/GameScene.ts docs/superpowers/plans/2026-04-29-stage-1-upgrade-choices.md
git commit -m "feat: add upgrade choice overlay"
```

---

### Task 5: Manual Smoke Test and Final Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-04-29-stage-1-upgrade-choices.md`

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS, including `tests/experience.test.ts` and `tests/upgrades.test.ts`.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS. The existing Phaser/Vite chunk-size warning can remain if the build exits with code 0.

- [ ] **Step 3: Start a local dev server**

Run:

```bash
npm run dev -- --port 5176
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5176/`.

- [ ] **Step 4: Perform manual upgrade smoke check**

Use the running browser game and verify:

- HUD shows `等级：1`.
- HUD shows `经验：0/20`.
- Killing enemies increases experience by 5.
- At 20 experience, the game freezes and shows `选择升级`.
- The overlay subtitle is `按 1 / 2 / 3 选择`.
- The overlay shows three different Chinese upgrade names.
- Pressing `1`, `2`, or `3` applies the matching upgrade and closes the overlay.
- Clicking an upgrade card applies that upgrade and closes the overlay.
- While the overlay is open, `WASD` does not move the player and `Space` does not build a tower.
- After choosing, enemies, towers, gathering, spawning, and the timer continue.
- Pressing `R` after game over restarts with `等级：1` and `经验：0/20`.

- [ ] **Step 5: Stop the dev server**

Stop the Vite process started in Step 3.

- [ ] **Step 6: Commit completed plan checklist**

After checking off completed plan steps:

```bash
git add docs/superpowers/plans/2026-04-29-stage-1-upgrade-choices.md
git commit -m "docs: complete stage 1 upgrade plan"
```

---

## Plan Self-Review

- Spec coverage: Task 1 covers XP thresholds, overflow, enemy XP reward, and pending upgrade choices. Task 2 covers six Chinese upgrade definitions, deterministic three-choice drawing, repeated availability across levels, and stat application. Task 3 covers runtime stats, enemy death XP, HUD level/XP lines, and game-over health references. Task 4 covers pause behavior, keyboard selection, mouse click selection, overlay lifecycle, duplicate input protection, and range visual refresh. Task 5 covers final test/build/manual verification.
- Placeholder scan: The plan contains no unfinished markers, vague implementation slots, or undefined function names.
- Type consistency: `ExperienceState`, `RunStats`, `UpgradeDefinition`, `GameKey`, `tryOpenUpgradeChoices`, `selectUpgrade`, and imported helper names are used consistently across tasks.
