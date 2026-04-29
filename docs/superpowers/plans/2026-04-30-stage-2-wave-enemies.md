# Stage 2 Wave Enemies Implementation Plan

> **For <PRIVATE_PERSON>:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current continuous single-enemy spawn loop with timed waves, three enemy archetypes, Chinese HUD wave information, and per-enemy XP rewards.

**Spec:** `docs/superpowers/specs/2026-04-30-stage-2-wave-enemies-design.md`

**Current Baseline:**
- Branch: `main`
- Latest local commit before this plan: `16471b5 docs: add stage 2 wave enemies design`
- `main` is ahead of `origin/main` by 1 commit before this plan is committed.
- Existing spawn path in `src/scenes/GameScene.ts` imports `spawnDirector.ts`, keeps `spawnTimer`, and calls `spawnEnemy()` from `updateSpawning()`.
- Existing enemies have one hard-coded stat set: health 30, speed 72, contact damage 5, XP 5, red circle radius 13.

**Non-Goals:**
- Do not delete `src/game/spawnDirector.ts` or its tests in Stage 2. `GameScene` will stop using it, but the old module remains available until a later cleanup.
- Do not add art assets. Enemy variety is represented with different circle sizes, colors, and Chinese labels.
- Do not add wave-clear rewards, elite waves, boss waves, or enemy pathfinding.

## Task 1: Add Enemy Definitions

**Files:**
- Create `src/game/enemies.ts`
- Create `tests/enemies.test.ts`

### 1.1 Write Failing Tests

Create `tests/enemies.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ENEMY_DEFINITIONS,
  getEnemyDefinition,
  getUnlockedEnemyTypes,
} from '../src/game/enemies';

describe('enemy definitions', () => {
  it('defines the grunt enemy used from wave 1', () => {
    expect(getEnemyDefinition('grunt')).toEqual({
      type: 'grunt',
      name: '普通',
      label: '普',
      color: 0xef4444,
      radius: 13,
      health: 30,
      speed: 72,
      contactDamage: 5,
      experienceReward: 5,
      budgetCost: 1,
      unlockWave: 1,
    });
  });

  it('defines the runner enemy used from wave 2', () => {
    expect(getEnemyDefinition('runner')).toEqual({
      type: 'runner',
      name: '迅捷',
      label: '快',
      color: 0xf97316,
      radius: 10,
      health: 18,
      speed: 118,
      contactDamage: 4,
      experienceReward: 4,
      budgetCost: 1,
      unlockWave: 2,
    });
  });

  it('defines the brute enemy used from wave 4', () => {
    expect(getEnemyDefinition('brute')).toEqual({
      type: 'brute',
      name: '重甲',
      label: '甲',
      color: 0x7f1d1d,
      radius: 18,
      health: 85,
      speed: 45,
      contactDamage: 9,
      experienceReward: 10,
      budgetCost: 3,
      unlockWave: 4,
    });
  });

  it('returns undefined for unknown enemy types', () => {
    expect(getEnemyDefinition('ghost')).toBeUndefined();
  });

  it('unlocks enemy types by wave number in deterministic order', () => {
    expect(getUnlockedEnemyTypes(1)).toEqual(['grunt']);
    expect(getUnlockedEnemyTypes(2)).toEqual(['grunt', 'runner']);
    expect(getUnlockedEnemyTypes(3)).toEqual(['grunt', 'runner']);
    expect(getUnlockedEnemyTypes(4)).toEqual(['grunt', 'runner', 'brute']);
  });

  it('normalizes invalid wave numbers to the first wave unlock set', () => {
    expect(getUnlockedEnemyTypes(0)).toEqual(['grunt']);
    expect(getUnlockedEnemyTypes(-5)).toEqual(['grunt']);
    expect(getUnlockedEnemyTypes(Number.NaN)).toEqual(['grunt']);
    expect(getUnlockedEnemyTypes(1.8)).toEqual(['grunt']);
  });

  it('exports exactly the supported enemy definition keys', () => {
    expect(Object.keys(ENEMY_DEFINITIONS)).toEqual(['grunt', 'runner', 'brute']);
  });
});
```

Run:

```powershell
npm test -- enemies
```

Expected result:
- Fails because `src/game/enemies.ts` does not exist.

### 1.2 Implement Enemy Definitions

Create `src/game/enemies.ts`:

```ts
export type EnemyTypeId = 'grunt' | 'runner' | 'brute';

export interface EnemyDefinition {
  type: EnemyTypeId;
  name: string;
  label: string;
  color: number;
  radius: number;
  health: number;
  speed: number;
  contactDamage: number;
  experienceReward: number;
  budgetCost: number;
  unlockWave: number;
}

export const ENEMY_TYPE_ORDER: EnemyTypeId[] = ['grunt', 'runner', 'brute'];

export const ENEMY_DEFINITIONS: Record<EnemyTypeId, EnemyDefinition> = {
  grunt: {
    type: 'grunt',
    name: '普通',
    label: '普',
    color: 0xef4444,
    radius: 13,
    health: 30,
    speed: 72,
    contactDamage: 5,
    experienceReward: 5,
    budgetCost: 1,
    unlockWave: 1,
  },
  runner: {
    type: 'runner',
    name: '迅捷',
    label: '快',
    color: 0xf97316,
    radius: 10,
    health: 18,
    speed: 118,
    contactDamage: 4,
    experienceReward: 4,
    budgetCost: 1,
    unlockWave: 2,
  },
  brute: {
    type: 'brute',
    name: '重甲',
    label: '甲',
    color: 0x7f1d1d,
    radius: 18,
    health: 85,
    speed: 45,
    contactDamage: 9,
    experienceReward: 10,
    budgetCost: 3,
    unlockWave: 4,
  },
};

export function getEnemyDefinition(type: string): EnemyDefinition | undefined {
  return ENEMY_DEFINITIONS[type as EnemyTypeId];
}

export function getUnlockedEnemyTypes(waveNumber: number): EnemyTypeId[] {
  const normalizedWave = Number.isFinite(waveNumber)
    ? Math.max(1, Math.floor(waveNumber))
    : 1;

  return ENEMY_TYPE_ORDER.filter((type) => {
    return ENEMY_DEFINITIONS[type].unlockWave <= normalizedWave;
  });
}
```

Run:

```powershell
npm test -- enemies
```

Expected result:
- `tests/enemies.test.ts` passes.

Commit:

```powershell
git add src/game/enemies.ts tests/enemies.test.ts
git commit -m "feat: add enemy definitions"
```

## Task 2: Add Wave Director

**Files:**
- Create `src/game/waveDirector.ts`
- Create `tests/waveDirector.test.ts`

### 2.1 Write Failing Tests

Create `tests/waveDirector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  FIRST_WAVE_DELAY,
  WAVE_INTERVAL,
  createWaveState,
  getWaveBudget,
  selectEnemyTypesForBudget,
  selectEnemyTypesForWave,
  updateWaveState,
} from '../src/game/waveDirector';

describe('wave director', () => {
  it('starts before wave 1 with an eight second countdown', () => {
    expect(FIRST_WAVE_DELAY).toBe(8);
    expect(WAVE_INTERVAL).toBe(14);
    expect(createWaveState()).toEqual({
      currentWave: 0,
      nextWaveTimer: 8,
    });
  });

  it('counts down without starting a wave while time remains', () => {
    const result = updateWaveState(createWaveState(), 3);

    expect(result).toEqual({
      state: {
        currentWave: 0,
        nextWaveTimer: 5,
      },
      startedWave: false,
      spawnedEnemies: [],
    });
  });

  it('starts wave 1 when the first countdown reaches zero', () => {
    const result = updateWaveState(createWaveState(), 8);

    expect(result).toEqual({
      state: {
        currentWave: 1,
        nextWaveTimer: 14,
      },
      startedWave: true,
      spawnedEnemies: ['grunt', 'grunt', 'grunt', 'grunt', 'grunt'],
    });
  });

  it('uses the wave budget formula from the design spec', () => {
    expect(getWaveBudget(0)).toBe(3);
    expect(getWaveBudget(1)).toBe(5);
    expect(getWaveBudget(2)).toBe(7);
    expect(getWaveBudget(4)).toBe(11);
    expect(getWaveBudget(Number.NaN)).toBe(3);
  });

  it('selects runner pressure from wave 2 onward', () => {
    expect(selectEnemyTypesForWave(2)).toEqual([
      'runner',
      'grunt',
      'runner',
      'grunt',
      'runner',
      'grunt',
      'runner',
    ]);
  });

  it('selects a brute first from wave 4 onward and fills remaining budget with grunt runner alternation', () => {
    expect(selectEnemyTypesForWave(4)).toEqual([
      'brute',
      'grunt',
      'runner',
      'grunt',
      'runner',
      'grunt',
      'runner',
      'grunt',
      'runner',
    ]);
  });

  it('returns no enemies when a custom budget cannot buy an enemy', () => {
    expect(selectEnemyTypesForBudget(4, 0)).toEqual([]);
    expect(selectEnemyTypesForBudget(4, -3)).toEqual([]);
  });

  it('ignores invalid delta or interval values', () => {
    const state = {
      currentWave: 2,
      nextWaveTimer: 4,
    };

    expect(updateWaveState(state, 0)).toEqual({
      state,
      startedWave: false,
      spawnedEnemies: [],
    });
    expect(updateWaveState(state, -2)).toEqual({
      state,
      startedWave: false,
      spawnedEnemies: [],
    });
    expect(updateWaveState(state, Number.NaN)).toEqual({
      state,
      startedWave: false,
      spawnedEnemies: [],
    });
    expect(updateWaveState(state, 4, 0)).toEqual({
      state,
      startedWave: false,
      spawnedEnemies: [],
    });
    expect(updateWaveState(state, 4, Number.NaN)).toEqual({
      state,
      startedWave: false,
      spawnedEnemies: [],
    });
  });
});
```

Run:

```powershell
npm test -- waveDirector
```

Expected result:
- Fails because `src/game/waveDirector.ts` does not exist.

### 2.2 Implement Wave Director

Create `src/game/waveDirector.ts`:

```ts
import {
  ENEMY_DEFINITIONS,
  getUnlockedEnemyTypes,
  type EnemyTypeId,
} from './enemies';

export interface WaveState {
  currentWave: number;
  nextWaveTimer: number;
}

export interface WaveUpdateResult {
  state: WaveState;
  startedWave: boolean;
  spawnedEnemies: EnemyTypeId[];
}

export const FIRST_WAVE_DELAY = 8;
export const WAVE_INTERVAL = 14;

export function createWaveState(): WaveState {
  return {
    currentWave: 0,
    nextWaveTimer: FIRST_WAVE_DELAY,
  };
}

export function getWaveBudget(waveNumber: number): number {
  const normalizedWave = Number.isFinite(waveNumber)
    ? Math.max(0, Math.floor(waveNumber))
    : 0;
  return 3 + normalizedWave * 2;
}

export function selectEnemyTypesForWave(waveNumber: number): EnemyTypeId[] {
  return selectEnemyTypesForBudget(waveNumber, getWaveBudget(waveNumber));
}

export function selectEnemyTypesForBudget(
  waveNumber: number,
  budget: number,
): EnemyTypeId[] {
  if (!Number.isFinite(budget) || budget <= 0) {
    return [];
  }

  const unlockedTypes = getUnlockedEnemyTypes(waveNumber);
  const highestUnlockedType = unlockedTypes.at(-1);

  if (!highestUnlockedType) {
    return [];
  }

  const selectedTypes: EnemyTypeId[] = [];
  let remainingBudget = Math.floor(budget);
  const highestCost = ENEMY_DEFINITIONS[highestUnlockedType].budgetCost;

  if (remainingBudget >= highestCost) {
    selectedTypes.push(highestUnlockedType);
    remainingBudget -= highestCost;
  }

  const fillPattern = unlockedTypes.filter((type) => type !== 'brute');
  let fillIndex = 0;

  while (fillPattern.length > 0) {
    const nextType = fillPattern[fillIndex % fillPattern.length];
    const nextCost = ENEMY_DEFINITIONS[nextType].budgetCost;

    if (remainingBudget < nextCost) {
      break;
    }

    selectedTypes.push(nextType);
    remainingBudget -= nextCost;
    fillIndex += 1;
  }

  return selectedTypes;
}

export function updateWaveState(
  state: WaveState,
  deltaSeconds: number,
  interval = WAVE_INTERVAL,
): WaveUpdateResult {
  if (
    !Number.isFinite(deltaSeconds) ||
    deltaSeconds <= 0 ||
    !Number.isFinite(interval) ||
    interval <= 0
  ) {
    return {
      state,
      startedWave: false,
      spawnedEnemies: [],
    };
  }

  const nextWaveTimer = state.nextWaveTimer - deltaSeconds;

  if (nextWaveTimer > 0) {
    return {
      state: {
        ...state,
        nextWaveTimer,
      },
      startedWave: false,
      spawnedEnemies: [],
    };
  }

  const currentWave = state.currentWave + 1;

  return {
    state: {
      currentWave,
      nextWaveTimer: interval,
    },
    startedWave: true,
    spawnedEnemies: selectEnemyTypesForWave(currentWave),
  };
}
```

Run:

```powershell
npm test -- waveDirector enemies
```

Expected result:
- `tests/waveDirector.test.ts` and `tests/enemies.test.ts` pass.

Commit:

```powershell
git add src/game/waveDirector.ts tests/waveDirector.test.ts
git commit -m "feat: add wave director"
```

## Task 3: Wire Enemy Types Into GameScene

**Files:**
- Modify `src/scenes/GameScene.ts`

**Behavior after this task:**
- Gameplay still uses the old spawn timer.
- Spawned enemies use the new enemy definition module.
- The only spawned type is `grunt`.
- Enemy labels, per-enemy speed, per-enemy damage, and per-enemy XP are in place before wave integration.

### 3.1 Update Imports And Constants

In `src/scenes/GameScene.ts`, remove the fixed XP import:

```ts
import {
  EXPERIENCE_TO_NEXT_LEVEL,
  ENEMY_EXPERIENCE_REWARD,
  addExperience,
  createExperienceState,
  type ExperienceState,
} from '../game/experience';
```

Replace it with:

```ts
import {
  EXPERIENCE_TO_NEXT_LEVEL,
  addExperience,
  createExperienceState,
  type ExperienceState,
} from '../game/experience';
```

Add:

```ts
import {
  getEnemyDefinition,
  type EnemyTypeId,
} from '../game/enemies';
```

Remove these constants:

```ts
const ENEMY_HEALTH = 30;
const ENEMY_SPEED = 72;
const ENEMY_CONTACT_DAMAGE = 5;
```

Keep:

```ts
const ENEMY_CONTACT_RANGE = 34;
const ENEMY_DAMAGE_COOLDOWN = 1;
const SPAWN_MARGIN = 96;
```

### 3.2 Extend Enemy Runtime Shape

Replace the current `Enemy` interface with:

```ts
interface Enemy {
  id: string;
  type: EnemyTypeId;
  position: Point;
  radius: number;
  health: number;
  speed: number;
  contactDamage: number;
  experienceReward: number;
  damageTimer: number;
  shape: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}
```

### 3.3 Update Spawning To Use Definitions

Replace `spawnEnemy()` with this definition-aware version:

```ts
private spawnEnemy(type: EnemyTypeId = 'grunt', waveIndex = 0): void {
  const definition = getEnemyDefinition(type);

  if (!definition) {
    return;
  }

  const player = this.player;
  const forwardSpawnX = player.position.x + this.scale.width / 2 + SPAWN_MARGIN;
  const sideOffset = ((this.enemySequence + waveIndex) % 5) - 2;
  const position = {
    x: forwardSpawnX + (waveIndex % 3) * 64,
    y: Phaser.Math.Clamp(
      player.position.y + sideOffset * 90,
      64,
      this.scale.height - 64,
    ),
  };
  const shape = this.add.circle(
    position.x,
    position.y,
    definition.radius,
    definition.color,
  );
  const label = this.add.text(
    position.x,
    position.y - definition.radius - 18,
    definition.label,
    {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#f8fafc',
    },
  );
  label.setOrigin(0.5);

  this.enemies.push({
    id: `enemy-${this.enemySequence}`,
    type: definition.type,
    position,
    radius: definition.radius,
    health: definition.health,
    speed: definition.speed,
    contactDamage: definition.contactDamage,
    experienceReward: definition.experienceReward,
    damageTimer: 0,
    shape,
    label,
  });
  this.enemySequence += 1;
}
```

Update the current old-spawn-loop call from:

```ts
this.spawnEnemy();
```

To:

```ts
this.spawnEnemy('grunt', index);
```

### 3.4 Update Enemy Movement And Contact Damage

Inside `updateEnemies(deltaSeconds: number)`, replace fixed speed movement:

```ts
enemy.position.x += direction.x * ENEMY_SPEED * deltaSeconds;
enemy.position.y += direction.y * ENEMY_SPEED * deltaSeconds;
enemy.shape.setPosition(enemy.position.x, enemy.position.y);
```

With:

```ts
enemy.position.x += direction.x * enemy.speed * deltaSeconds;
enemy.position.y += direction.y * enemy.speed * deltaSeconds;
enemy.shape.setPosition(enemy.position.x, enemy.position.y);
enemy.label.setPosition(enemy.position.x, enemy.position.y - enemy.radius - 18);
```

Replace fixed contact damage:

```ts
this.player.health = Math.max(0, this.player.health - ENEMY_CONTACT_DAMAGE);
```

With:

```ts
this.player.health = Math.max(0, this.player.health - enemy.contactDamage);
```

### 3.5 Destroy Labels And Award Per-Type XP

Inside `updateTowers(deltaSeconds: number)`, when a target dies, replace:

```ts
target.shape.destroy();
this.enemies = this.enemies.filter((enemy) => enemy.id !== target.id);
this.awardEnemyExperience();
```

With:

```ts
target.shape.destroy();
target.label.destroy();
this.enemies = this.enemies.filter((enemy) => enemy.id !== target.id);
this.awardEnemyExperience(target.experienceReward);
```

Replace:

```ts
private awardEnemyExperience(): void {
  const result = addExperience(this.experienceState, ENEMY_EXPERIENCE_REWARD);
```

With:

```ts
private awardEnemyExperience(amount: number): void {
  const result = addExperience(this.experienceState, amount);
```

### 3.6 Verify And Commit

Run:

```powershell
npm test
npm run build
```

Expected result:
- All tests pass.
- Build succeeds.
- `GameScene.ts` no longer imports `ENEMY_EXPERIENCE_REWARD`.
- `GameScene.ts` still imports `spawnDirector.ts` at the end of Task 3.

Commit:

```powershell
git add src/scenes/GameScene.ts
git commit -m "feat: use enemy definitions in game scene"
```

## Task 4: Replace Spawn Timer With Wave Director

**Files:**
- Modify `src/scenes/GameScene.ts`

**Behavior after this task:**
- Wave countdown starts at 8 seconds.
- Wave 1 spawns 5 grunts.
- Later waves trigger every 14 seconds.
- Waves can overlap because existing enemies are not cleared before the next wave starts.
- Upgrade overlay pauses countdown because `update()` already returns before spawning while `upgradeSelecting` is true.
- HUD content is Chinese and follows the spec order.

### 4.1 Update Imports And Scene State

Remove:

```ts
import { getSpawnInterval, updateSpawnTimer } from '../game/spawnDirector';
```

Add:

```ts
import {
  createWaveState,
  updateWaveState,
  type WaveState,
} from '../game/waveDirector';
```

Remove this field:

```ts
private spawnTimer = 0;
```

Add this field near the other runtime state fields:

```ts
private waveState: WaveState = createWaveState();
```

In `resetState()`, remove:

```ts
this.spawnTimer = 0;
```

Add:

```ts
this.waveState = createWaveState();
```

### 4.2 Replace updateSpawning

Replace the entire current `updateSpawning(deltaSeconds: number)` method with:

```ts
private updateSpawning(deltaSeconds: number): void {
  const result = updateWaveState(this.waveState, deltaSeconds);
  this.waveState = result.state;

  if (!result.startedWave) {
    return;
  }

  this.showFeedback(`第 ${this.waveState.currentWave} 波来袭！`);

  result.spawnedEnemies.forEach((type, index) => {
    this.spawnEnemy(type, index);
  });
}
```

### 4.3 Update HUD Order And Feedback Placement

Change:

```ts
const FEEDBACK_Y = 236;
```

To:

```ts
const FEEDBACK_Y = 306;
```

Replace the `lines` array inside `updateHud()` with:

```ts
const lines = [
  `行城生命：${Math.ceil(this.player.health)}/${PLAYER_MAX_HEALTH}`,
  `木材：${this.resources.wood}`,
  `等级：${this.experienceState.level}`,
  `经验：${this.experienceState.experience}/${EXPERIENCE_TO_NEXT_LEVEL}`,
  `波次：${this.waveState.currentWave}`,
  `下一波：${Math.ceil(this.waveState.nextWaveTimer)} 秒`,
  `时间：${Math.floor(this.elapsedSeconds)} 秒`,
  `箭塔：${this.towers.length}`,
  `空格：建造箭塔（${TOWER_COST} 木材）`,
  '目标：保护行城核心，击败来袭怪物',
];
```

### 4.4 Verify GameScene No Longer Uses Spawn Director

Run:

```powershell
rg "spawnDirector|getSpawnInterval|updateSpawnTimer|spawnTimer" src tests
```

Expected result:
- Matches remain in `src/game/spawnDirector.ts` and `tests/spawnDirector.test.ts`.
- No matches in `src/scenes/GameScene.ts`.

Run:

```powershell
npm test
npm run build
```

Expected result:
- All tests pass.
- Build succeeds.
- Vite may emit the existing chunk-size warning; this warning does not fail the build.

Commit:

```powershell
git add src/scenes/GameScene.ts
git commit -m "feat: spawn enemies in timed waves"
```

## Task 5: Final Verification And Manual Smoke

**Files:**
- No source edits expected.

### 5.1 Automated Verification

Run:

```powershell
npm test
npm run build
git status --short
```

Expected result:
- `npm test` passes.
- `npm run build` passes.
- `git status --short` is empty after all implementation commits.

### 5.2 Local Smoke Test

If no dev server is already running, start one:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected result:
- Vite prints a local URL such as `http://127.0.0.1:5173/`.

Open the local URL and verify:
- HUD shows Chinese lines in this order: `行城生命`, `木材`, `等级`, `经验`, `波次`, `下一波`, `时间`, `箭塔`, build hint, objective.
- The first screen shows `波次：0` and `下一波：8 秒` or lower depending on elapsed time.
- At countdown zero, feedback shows `第 1 波来袭！`.
- Wave 1 enemies display `普`.
- Wave 2 introduces enemies labeled `快`.
- Wave 4 introduces enemies labeled `甲`.
- Opening an upgrade choice pauses wave countdown.
- Enemy death continues to advance XP and upgrade choices.
- Game over and restart reset wave number to 0 and countdown to 8.

### 5.3 Push After User Approval

Do not push automatically unless the user asks to submit or push. When asked:

```powershell
git push origin main
```

Expected result:
- Remote `origin/main` advances to include the Stage 2 design, plan, and implementation commits.

## Self-Review Against Spec

- Discrete timed waves replace `GameScene` continuous spawn usage through `waveDirector.ts`.
- `spawnDirector.ts` remains in the repository but is not imported by `GameScene`.
- First wave countdown is 8 seconds via `FIRST_WAVE_DELAY`.
- Later wave interval is 14 seconds via `WAVE_INTERVAL`.
- `currentWave` starts at 0 and increments to 1 when the first wave starts.
- Budget formula is exactly `3 + waveNumber * 2`.
- Wave 1 uses only `grunt`.
- Waves 2 and 3 use `grunt` plus `runner`.
- Wave 4 and later include `brute`.
- The first selected enemy for a wave is the highest unlocked type, then the remaining budget alternates `grunt` and `runner`.
- Enemy stats match the spec values for color, radius, health, speed, contact damage, XP, budget cost, unlock wave, and Chinese label.
- Enemy death awards `enemy.experienceReward` rather than fixed XP.
- HUD text is Chinese and follows the exact requested order.
- Feedback text uses `第 N 波来袭！` and is moved below the expanded HUD.
- Upgrade selection pauses wave countdown because spawning remains behind the existing paused branch.
- Game over stops spawning because `update()` returns while `gameOver` is true.
- Restart resets wave state through `resetState()`.
- Overlapping waves are supported because `updateSpawning()` does not inspect or clear existing enemies.
- Tests cover enemy definitions, unlocks, unknown type lookup, wave countdown, wave triggering, wave composition, budget growth, insufficient budget, and invalid delta or interval values.

## Completion Criteria

The Stage 2 implementation is complete when:
- `npm test` passes.
- `npm run build` passes.
- `GameScene.ts` has no dependency on `spawnDirector.ts`.
- Manual smoke confirms wave labels and Chinese HUD behavior.
- Changes are committed locally.
- Remote push is performed only after the user asks for it.
