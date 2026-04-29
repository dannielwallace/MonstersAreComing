# Stage 0 Clarity Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Simplified Chinese HUD text, dynamic objective guidance, and temporary feedback messages to make the Stage 0 greybox loop easier to understand.

**Architecture:** Keep Phaser rendering and transient UI state in `GameScene.ts`. Extract the objective-selection rule into a small pure TypeScript module so gather/build/defend guidance is covered by unit tests.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest.

---

## File Structure

- Create: `src/game/objective.ts` - pure objective text selection for gather/build/defend state.
- Create: `tests/objective.test.ts` - tests for objective selection priority and Chinese labels.
- Modify: `src/scenes/GameScene.ts` - Chinese HUD, feedback text, damage flash, gathering feedback, objective line.
- Modify: `README.md` - note that HUD/feedback are Chinese.
- Modify: `docs/superpowers/plans/2026-04-29-stage-0-clarity-polish.md` - mark completed steps as work progresses.

---

### Task 1: Objective Rule Module

**Files:**
- Create: `src/game/objective.ts`
- Create: `tests/objective.test.ts`

- [ ] **Step 1: Write the failing objective tests**

Create `tests/objective.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the objective tests and confirm RED**

Run:

```bash
npm test -- tests/objective.test.ts
```

Expected: FAIL because `src/game/objective.ts` does not exist.

- [ ] **Step 3: Implement the objective module**

Create `src/game/objective.ts`:

```ts
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
```

- [ ] **Step 4: Run the objective tests and confirm GREEN**

Run:

```bash
npm test -- tests/objective.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit objective module**

```bash
git add src/game/objective.ts tests/objective.test.ts
git commit -m "feat: add objective guidance rule"
```

---

### Task 2: Chinese HUD and Feedback in GameScene

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Inspect the current scene before editing**

Run:

```bash
Select-String -Path src/scenes/GameScene.ts -Pattern "Caravan HP|Wood:|Time:|Towers:|Space:|Caravan Destroyed|Survived|Press R" -Context 1,1
```

Expected: Finds the existing English HUD and game-over strings.

- [ ] **Step 2: Update imports, constants, fields, and text objects**

Modify the top of `src/scenes/GameScene.ts` so it imports `getObjectiveText` and defines feedback constants:

```ts
import { getObjectiveText } from '../game/objective';
```

Add constants near the other constants:

```ts
const THREAT_RANGE = 260;
const FEEDBACK_DURATION = 1.4;
const DAMAGE_FLASH_DURATION = 0.18;
const CARAVAN_NORMAL_COLOR = 0x4caf50;
const CARAVAN_DAMAGE_COLOR = 0xef4444;
```

Update the caravan creation to use `CARAVAN_NORMAL_COLOR` instead of the inline green value.

Add fields to the `GameScene` class:

```ts
  private feedbackText!: Phaser.GameObjects.Text;
  private feedbackTimer = 0;
  private caravanDamageFlashTimer = 0;
```

In `create()`, after the HUD is created, create feedback text:

```ts
    this.feedbackText = this.add.text(18, 154, '', {
      color: '#facc15',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '18px',
    });
    this.feedbackText.setScrollFactor(0);
    this.feedbackText.setDepth(OVERLAY_DEPTH);
```

Also change the HUD font family to:

```ts
fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
```

Reset feedback timers in `resetState()`:

```ts
    this.feedbackTimer = 0;
    this.caravanDamageFlashTimer = 0;
```

- [ ] **Step 3: Add helper methods for objective and feedback**

Add these methods inside `GameScene`:

```ts
  private hasOpenTowerSlot(): boolean {
    const occupiedSlots = new Set(this.towers.map((tower) => tower.slotId));
    return selectNextOpenSlot(STAGE0_BUILD_SLOTS, occupiedSlots) !== undefined;
  }

  private isCaravanThreatened(): boolean {
    const threatRangeSquared = THREAT_RANGE * THREAT_RANGE;
    return this.enemies.some(
      (enemy) => enemy.health > 0 && distanceSquared(enemy.position, this.caravanPosition) <= threatRangeSquared,
    );
  }

  private showFeedback(message: string, color = '#facc15'): void {
    this.feedbackText.setText(message);
    this.feedbackText.setColor(color);
    this.feedbackTimer = FEEDBACK_DURATION;
  }

  private updateFeedback(deltaSeconds: number): void {
    this.feedbackTimer = Math.max(0, this.feedbackTimer - deltaSeconds);
    if (this.feedbackTimer <= 0) {
      this.feedbackText.setText('');
    }

    this.caravanDamageFlashTimer = Math.max(0, this.caravanDamageFlashTimer - deltaSeconds);
    this.caravan.setFillStyle(this.caravanDamageFlashTimer > 0 ? CARAVAN_DAMAGE_COLOR : CARAVAN_NORMAL_COLOR);
  }
```

- [ ] **Step 4: Wire feedback into the update loop**

In `update()`, call feedback update before `updateHud()`:

```ts
    this.updateFeedback(deltaSeconds);
    this.updateHud();
```

In `updateGathering()`, track whether any wood was gathered during this frame:

```ts
    let gatheredThisFrame = false;
```

Set `gatheredThisFrame = true` when `gathered > 0`, and after the loop:

```ts
    if (gatheredThisFrame) {
      this.showFeedback(`采集中 +${GATHER_RATE}/秒`, '#bbf7d0');
    }
```

In `updateBuilding()`, show Chinese failure messages:

```ts
    if (slotId === undefined) {
      this.showFeedback('箭塔槽位已满', '#fde68a');
      return;
    }
```

and:

```ts
    if (!spendResult.ok) {
      this.showFeedback(`木材不足，需要 ${TOWER_COST}`, '#fde68a');
      return;
    }
```

In `updateEnemies()`, when the caravan takes damage, add:

```ts
        this.caravanDamageFlashTimer = DAMAGE_FLASH_DURATION;
        this.showFeedback('行城遭到攻击！', '#fecaca');
```

- [ ] **Step 5: Convert HUD and game-over text to Chinese**

Replace `updateHud()` with:

```ts
  private updateHud(): void {
    const objective = getObjectiveText({
      wood: this.wood,
      towerCost: TOWER_COST,
      hasOpenTowerSlot: this.hasOpenTowerSlot(),
      caravanThreatened: this.isCaravanThreatened(),
    });

    this.hud.setText([
      `行城生命：${this.caravanHealth}/${CARAVAN_MAX_HEALTH}`,
      `木材：${Math.floor(this.wood)}`,
      `时间：${this.elapsedSeconds.toFixed(1)} 秒`,
      `箭塔：${this.towers.length}/${STAGE0_BUILD_SLOTS.length}`,
      `空格：建造箭塔（${TOWER_COST} 木材）`,
      objective,
    ]);
  }
```

Replace game-over text content with:

```ts
      `行城被摧毁\n坚持时间：${this.elapsedSeconds.toFixed(1)} 秒\n按 R 重新开始`,
```

and change its font family to:

```ts
fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
```

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 7: Commit scene polish**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: add chinese hud feedback"
```

---

### Task 3: Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-04-29-stage-0-clarity-polish.md`

- [ ] **Step 1: Update README**

Modify `README.md` so the controls section stays readable and notes Chinese HUD feedback:

```md
## Controls

- `W`, `A`, `S`, `D` or arrow keys - move
- `Space` - build an arrow tower when you have 20 wood
- `R` - restart after game over

The in-game HUD and feedback prompts are shown in Simplified Chinese for the Stage 0 clarity pass.
```

- [ ] **Step 2: Run final verification**

Run:

```bash
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 3: Start dev server and perform smoke check**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL. Open it or smoke check it with a browser/HTTP request.

Manual checklist:

- HUD uses `行城生命`, `木材`, `时间`, `箭塔`, and `空格：建造箭塔`.
- Initial objective is `目标：采集木材`.
- Gathering shows `采集中 +8/秒`.
- Pressing `Space` before 20 wood shows `木材不足，需要 20`.
- Reaching 20 wood with an open slot shows `目标：建造箭塔`.
- Enemies near the caravan show `目标：防守行城`.
- Caravan hit shows `行城遭到攻击！` and a brief red flash.
- Game over text is Chinese.

- [ ] **Step 4: Commit docs and completed plan**

After marking completed checklist items in this plan:

```bash
git add README.md docs/superpowers/plans/2026-04-29-stage-0-clarity-polish.md
git commit -m "docs: update clarity polish instructions"
```

---

## Plan Self-Review

- Spec coverage: Task 1 covers dynamic objective logic; Task 2 covers Chinese HUD, failed build messages, gathering feedback, damage warning, red flash, and game-over text; Task 3 covers README, verification, and manual checklist.
- Completion scan: No unfinished markers or unspecified code steps remain.
- Type consistency: `getObjectiveText`, `ObjectiveState`, and `GameScene` helper names are consistent across tasks.
