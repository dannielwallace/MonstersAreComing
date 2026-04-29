# Phaser Stage 0 Greybox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable Phaser 3 greybox prototype where the player gathers wood, builds towers around a moving caravan, and defends it from enemies until the caravan is destroyed.

**Architecture:** Use Vite + TypeScript + Phaser 3 for the browser game, with deterministic rules in small `src/game/*` modules covered by Vitest. Phaser owns rendering, input, camera, and scene orchestration; pure modules own inventory, build slots, combat, vectors, and spawn timing.

**Tech Stack:** Node/npm, Vite, TypeScript, Phaser 3, Vitest.

---

## File Structure

- Create: `package.json` - npm scripts and dependencies.
- Create: `index.html` - Vite app entry page.
- Create: `tsconfig.json` - TypeScript compiler settings.
- Create: `vite.config.ts` - Vite and Vitest configuration.
- Create: `src/main.ts` - Phaser bootstrapping.
- Create: `src/scenes/GameScene.ts` - playable scene, input, shapes, update loop, HUD, restart.
- Create: `src/game/math.ts` - vector helpers and movement normalization.
- Create: `src/game/inventory.ts` - wood inventory and spending rules.
- Create: `src/game/combat.ts` - target selection and damage helpers.
- Create: `src/game/spawnDirector.ts` - elapsed-time spawn interval and accumulator helpers.
- Create: `src/game/buildSlots.ts` - tower slot offsets and placement selection.
- Create: `tests/math.test.ts` - movement vector tests.
- Create: `tests/inventory.test.ts` - wood spend tests.
- Create: `tests/combat.test.ts` - target and damage tests.
- Create: `tests/spawnDirector.test.ts` - spawn interval tests.
- Create: `tests/buildSlots.test.ts` - build slot tests.
- Modify: `docs/superpowers/plans/2026-04-29-phaser-stage-0-greybox.md` - mark checkboxes as implementation progresses.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.ts`
- Create: `src/scenes/GameScene.ts`

- [ ] **Step 1: Create npm project files**

Create `package.json`:

```json
{
  "name": "monsters-are-coming-greybox",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "phaser": "^3.90.0"
  },
  "devDependencies": {
    "@vitejs/plugin-basic-ssl": "^2.1.0",
    "typescript": "^5.9.3",
    "vite": "^7.1.12",
    "vitest": "^3.2.4"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Caravan Greybox</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits successfully.

- [ ] **Step 3: Add minimal Phaser boot files**

Create `src/scenes/GameScene.ts`:

```ts
import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(): void {
    this.add.text(32, 32, 'Caravan Greybox', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '24px',
    });
  }
}
```

Create `src/main.ts`:

```ts
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#1f2933',
  scene: [GameScene],
};

new Phaser.Game(config);
```

- [ ] **Step 4: Verify build**

Run:

```bash
npm run build
```

Expected: PASS. Vite writes `dist/`.

- [ ] **Step 5: Commit scaffold**

```bash
git add package.json package-lock.json index.html tsconfig.json vite.config.ts src/main.ts src/scenes/GameScene.ts
git commit -m "chore: scaffold phaser vite project"
```

---

### Task 2: Math Helpers

**Files:**
- Create: `tests/math.test.ts`
- Create: `src/game/math.ts`

- [ ] **Step 1: Write failing vector tests**

Create `tests/math.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { distanceSquared, moveToward, normalizeInput } from '../src/game/math';

describe('normalizeInput', () => {
  it('keeps cardinal movement at full speed', () => {
    expect(normalizeInput(1, 0)).toEqual({ x: 1, y: 0 });
  });

  it('normalizes diagonal movement to length 1', () => {
    const result = normalizeInput(1, 1);
    expect(result.x).toBeCloseTo(0.7071, 3);
    expect(result.y).toBeCloseTo(0.7071, 3);
  });

  it('keeps zero input at zero', () => {
    expect(normalizeInput(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('distanceSquared', () => {
  it('returns squared distance between two points', () => {
    expect(distanceSquared({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });
});

describe('moveToward', () => {
  it('moves by max distance toward the target', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 3)).toEqual({ x: 3, y: 0 });
  });

  it('stops exactly on the target when the step is large enough', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 2, y: 0 }, 3)).toEqual({ x: 2, y: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/math.test.ts
```

Expected: FAIL because `src/game/math.ts` does not exist.

- [ ] **Step 3: Implement math helpers**

Create `src/game/math.ts`:

```ts
export interface Point {
  x: number;
  y: number;
}

export function normalizeInput(x: number, y: number): Point {
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / length,
    y: y / length,
  };
}

export function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function moveToward(current: Point, target: Point, maxDistance: number): Point {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0 || distance <= maxDistance) {
    return { x: target.x, y: target.y };
  }

  const scale = maxDistance / distance;
  return {
    x: current.x + dx * scale,
    y: current.y + dy * scale,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/math.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit math helpers**

```bash
git add src/game/math.ts tests/math.test.ts
git commit -m "feat: add vector math helpers"
```

---

### Task 3: Inventory Rules

**Files:**
- Create: `tests/inventory.test.ts`
- Create: `src/game/inventory.ts`

- [ ] **Step 1: Write failing inventory tests**

Create `tests/inventory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addWood, canSpendWood, spendWood } from '../src/game/inventory';

describe('inventory wood rules', () => {
  it('adds gathered wood as whole units', () => {
    expect(addWood(3, 2.8)).toBe(5);
  });

  it('allows spending when enough wood is available', () => {
    expect(canSpendWood(20, 20)).toBe(true);
  });

  it('refuses spending when wood is below cost', () => {
    expect(canSpendWood(19, 20)).toBe(false);
  });

  it('subtracts exactly the cost when spending succeeds', () => {
    expect(spendWood(25, 20)).toEqual({ ok: true, wood: 5 });
  });

  it('does not change wood when spending fails', () => {
    expect(spendWood(12, 20)).toEqual({ ok: false, wood: 12 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/inventory.test.ts
```

Expected: FAIL because `src/game/inventory.ts` does not exist.

- [ ] **Step 3: Implement inventory rules**

Create `src/game/inventory.ts`:

```ts
export interface SpendResult {
  ok: boolean;
  wood: number;
}

export function addWood(currentWood: number, gatheredAmount: number): number {
  return Math.floor(currentWood + gatheredAmount);
}

export function canSpendWood(currentWood: number, cost: number): boolean {
  return currentWood >= cost;
}

export function spendWood(currentWood: number, cost: number): SpendResult {
  if (!canSpendWood(currentWood, cost)) {
    return { ok: false, wood: currentWood };
  }

  return { ok: true, wood: currentWood - cost };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/inventory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit inventory rules**

```bash
git add src/game/inventory.ts tests/inventory.test.ts
git commit -m "feat: add wood inventory rules"
```

---

### Task 4: Combat Rules

**Files:**
- Create: `tests/combat.test.ts`
- Create: `src/game/combat.ts`

- [ ] **Step 1: Write failing combat tests**

Create `tests/combat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyDamage, selectNearestTarget } from '../src/game/combat';

describe('selectNearestTarget', () => {
  const origin = { x: 0, y: 0 };

  it('chooses the nearest enemy inside range', () => {
    const enemies = [
      { id: 'far', position: { x: 90, y: 0 }, health: 30 },
      { id: 'near', position: { x: 30, y: 0 }, health: 30 },
    ];

    expect(selectNearestTarget(origin, enemies, 100)?.id).toBe('near');
  });

  it('ignores enemies outside range', () => {
    const enemies = [{ id: 'outside', position: { x: 101, y: 0 }, health: 30 }];

    expect(selectNearestTarget(origin, enemies, 100)).toBeUndefined();
  });

  it('ignores dead enemies', () => {
    const enemies = [{ id: 'dead', position: { x: 10, y: 0 }, health: 0 }];

    expect(selectNearestTarget(origin, enemies, 100)).toBeUndefined();
  });
});

describe('applyDamage', () => {
  it('reduces health by damage', () => {
    expect(applyDamage(30, 10)).toEqual({ health: 20, dead: false });
  });

  it('marks an enemy dead at zero health', () => {
    expect(applyDamage(10, 10)).toEqual({ health: 0, dead: true });
  });

  it('does not return negative health', () => {
    expect(applyDamage(5, 10)).toEqual({ health: 0, dead: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/combat.test.ts
```

Expected: FAIL because `src/game/combat.ts` does not exist.

- [ ] **Step 3: Implement combat rules**

Create `src/game/combat.ts`:

```ts
import { distanceSquared, type Point } from './math';

export interface Targetable {
  id: string;
  position: Point;
  health: number;
}

export interface DamageResult {
  health: number;
  dead: boolean;
}

export function selectNearestTarget<T extends Targetable>(
  origin: Point,
  enemies: T[],
  range: number,
): T | undefined {
  const rangeSquared = range * range;
  let best: T | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (enemy.health <= 0) {
      continue;
    }

    const candidateDistance = distanceSquared(origin, enemy.position);
    if (candidateDistance <= rangeSquared && candidateDistance < bestDistance) {
      best = enemy;
      bestDistance = candidateDistance;
    }
  }

  return best;
}

export function applyDamage(currentHealth: number, damage: number): DamageResult {
  const health = Math.max(0, currentHealth - damage);
  return {
    health,
    dead: health === 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/combat.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit combat rules**

```bash
git add src/game/combat.ts tests/combat.test.ts
git commit -m "feat: add tower combat rules"
```

---

### Task 5: Spawn Director

**Files:**
- Create: `tests/spawnDirector.test.ts`
- Create: `src/game/spawnDirector.ts`

- [ ] **Step 1: Write failing spawn tests**

Create `tests/spawnDirector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getSpawnInterval, updateSpawnTimer } from '../src/game/spawnDirector';

describe('getSpawnInterval', () => {
  it('uses 4 seconds during the first 30 seconds', () => {
    expect(getSpawnInterval(10)).toBe(4);
  });

  it('uses 2.8 seconds after 30 seconds', () => {
    expect(getSpawnInterval(45)).toBe(2.8);
  });

  it('uses 2 seconds after 90 seconds', () => {
    expect(getSpawnInterval(120)).toBe(2);
  });

  it('uses 1.4 seconds after 180 seconds', () => {
    expect(getSpawnInterval(200)).toBe(1.4);
  });
});

describe('updateSpawnTimer', () => {
  it('does not spawn before the interval fills', () => {
    expect(updateSpawnTimer(0.5, 0.25, 1)).toEqual({ timer: 0.75, spawnCount: 0 });
  });

  it('spawns once and keeps leftover time', () => {
    expect(updateSpawnTimer(0.8, 0.4, 1)).toEqual({ timer: 0.2, spawnCount: 1 });
  });

  it('spawns multiple times during a large frame step', () => {
    expect(updateSpawnTimer(0.2, 3.1, 1)).toEqual({ timer: 0.3, spawnCount: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/spawnDirector.test.ts
```

Expected: FAIL because `src/game/spawnDirector.ts` does not exist.

- [ ] **Step 3: Implement spawn director helpers**

Create `src/game/spawnDirector.ts`:

```ts
export interface SpawnTimerResult {
  timer: number;
  spawnCount: number;
}

export function getSpawnInterval(elapsedSeconds: number): number {
  if (elapsedSeconds >= 180) {
    return 1.4;
  }

  if (elapsedSeconds >= 90) {
    return 2;
  }

  if (elapsedSeconds >= 30) {
    return 2.8;
  }

  return 4;
}

export function updateSpawnTimer(currentTimer: number, deltaSeconds: number, interval: number): SpawnTimerResult {
  let timer = currentTimer + deltaSeconds;
  let spawnCount = 0;

  while (timer >= interval) {
    timer -= interval;
    spawnCount += 1;
  }

  return {
    timer: Number(timer.toFixed(6)),
    spawnCount,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/spawnDirector.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit spawn director**

```bash
git add src/game/spawnDirector.ts tests/spawnDirector.test.ts
git commit -m "feat: add enemy spawn director rules"
```

---

### Task 6: Build Slots

**Files:**
- Create: `tests/buildSlots.test.ts`
- Create: `src/game/buildSlots.ts`

- [ ] **Step 1: Write failing build slot tests**

Create `tests/buildSlots.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getSlotWorldPosition, selectNextOpenSlot, STAGE0_BUILD_SLOTS } from '../src/game/buildSlots';

describe('selectNextOpenSlot', () => {
  it('returns the first slot when none are occupied', () => {
    expect(selectNextOpenSlot(STAGE0_BUILD_SLOTS, new Set())).toBe('front');
  });

  it('skips occupied slots', () => {
    expect(selectNextOpenSlot(STAGE0_BUILD_SLOTS, new Set(['front', 'back']))).toBe('upper');
  });

  it('returns undefined when all slots are occupied', () => {
    const occupied = new Set(STAGE0_BUILD_SLOTS.map((slot) => slot.id));
    expect(selectNextOpenSlot(STAGE0_BUILD_SLOTS, occupied)).toBeUndefined();
  });
});

describe('getSlotWorldPosition', () => {
  it('adds slot offset to the caravan position', () => {
    const slot = { id: 'test', offset: { x: 10, y: -20 } };
    expect(getSlotWorldPosition({ x: 100, y: 200 }, slot)).toEqual({ x: 110, y: 180 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/buildSlots.test.ts
```

Expected: FAIL because `src/game/buildSlots.ts` does not exist.

- [ ] **Step 3: Implement build slot helpers**

Create `src/game/buildSlots.ts`:

```ts
import type { Point } from './math';

export interface BuildSlot {
  id: string;
  offset: Point;
}

export const STAGE0_BUILD_SLOTS: BuildSlot[] = [
  { id: 'front', offset: { x: 92, y: 0 } },
  { id: 'back', offset: { x: -92, y: 0 } },
  { id: 'upper', offset: { x: 0, y: -78 } },
  { id: 'lower', offset: { x: 0, y: 78 } },
  { id: 'upper-front', offset: { x: 92, y: -78 } },
  { id: 'lower-front', offset: { x: 92, y: 78 } },
  { id: 'upper-back', offset: { x: -92, y: -78 } },
  { id: 'lower-back', offset: { x: -92, y: 78 } },
];

export function selectNextOpenSlot(slots: BuildSlot[], occupiedSlotIds: Set<string>): string | undefined {
  return slots.find((slot) => !occupiedSlotIds.has(slot.id))?.id;
}

export function getSlotWorldPosition(caravanPosition: Point, slot: BuildSlot): Point {
  return {
    x: caravanPosition.x + slot.offset.x,
    y: caravanPosition.y + slot.offset.y,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/buildSlots.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit build slots**

```bash
git add src/game/buildSlots.ts tests/buildSlots.test.ts
git commit -m "feat: add caravan tower build slots"
```

---

### Task 7: Playable Phaser Scene

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Replace the placeholder scene with playable greybox code**

Modify `src/scenes/GameScene.ts`:

```ts
import Phaser from 'phaser';
import { getSlotWorldPosition, selectNextOpenSlot, STAGE0_BUILD_SLOTS } from '../game/buildSlots';
import { applyDamage, selectNearestTarget } from '../game/combat';
import { spendWood } from '../game/inventory';
import { distanceSquared, moveToward, normalizeInput, type Point } from '../game/math';
import { getSpawnInterval, updateSpawnTimer } from '../game/spawnDirector';

const PLAYER_SPEED = 245;
const CARAVAN_SPEED = 24;
const CARAVAN_MAX_HEALTH = 100;
const GATHER_RANGE = 34;
const GATHER_RATE = 8;
const TOWER_COST = 20;
const TOWER_RANGE = 190;
const TOWER_FIRE_INTERVAL = 0.55;
const TOWER_DAMAGE = 10;
const ENEMY_HEALTH = 30;
const ENEMY_SPEED = 72;
const ENEMY_CONTACT_RANGE = 34;
const ENEMY_CONTACT_DAMAGE = 5;
const ENEMY_DAMAGE_COOLDOWN = 1;

interface WoodNode {
  id: string;
  position: Point;
  remaining: number;
  shape: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface Enemy {
  id: string;
  position: Point;
  health: number;
  damageTimer: number;
  shape: Phaser.GameObjects.Arc;
}

interface Tower {
  id: string;
  slotId: string;
  position: Point;
  fireTimer: number;
  shape: Phaser.GameObjects.Rectangle;
  rangeShape: Phaser.GameObjects.Arc;
}

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R', Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Arc;
  private caravan!: Phaser.GameObjects.Rectangle;
  private hud!: Phaser.GameObjects.Text;
  private gameOverText?: Phaser.GameObjects.Text;
  private playerPosition: Point = { x: 120, y: 360 };
  private caravanPosition: Point = { x: 220, y: 360 };
  private caravanHealth = CARAVAN_MAX_HEALTH;
  private wood = 0;
  private elapsedSeconds = 0;
  private spawnTimer = 0;
  private enemySequence = 0;
  private towerSequence = 0;
  private gameOver = false;
  private woodNodes: WoodNode[] = [];
  private enemies: Enemy[] = [];
  private towers: Tower[] = [];

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.resetState();
    this.cameras.main.setBounds(0, 0, 5200, 720);

    this.add.grid(2600, 360, 5200, 720, 64, 64, 0x24313d, 0.35, 0x334452, 0.45);
    this.player = this.add.circle(this.playerPosition.x, this.playerPosition.y, 14, 0x42a5f5);
    this.caravan = this.add.rectangle(this.caravanPosition.x, this.caravanPosition.y, 86, 54, 0x4caf50);
    this.hud = this.add.text(18, 18, '', {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '18px',
      lineSpacing: 6,
    });
    this.hud.setScrollFactor(0);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,SPACE,R') as Record<
      'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R',
      Phaser.Input.Keyboard.Key
    >;

    this.createWoodNodes();
    this.updateHud();
  }

  update(_time: number, deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
        this.scene.restart();
      }
      return;
    }

    this.elapsedSeconds += deltaSeconds;
    this.updatePlayer(deltaSeconds);
    this.updateCaravan(deltaSeconds);
    this.updateGathering(deltaSeconds);
    this.updateBuilding();
    this.updateSpawning(deltaSeconds);
    this.updateEnemies(deltaSeconds);
    this.updateTowers(deltaSeconds);
    this.updateCamera();
    this.updateHud();

    if (this.caravanHealth <= 0) {
      this.showGameOver();
    }
  }

  private resetState(): void {
    this.playerPosition = { x: 120, y: 360 };
    this.caravanPosition = { x: 220, y: 360 };
    this.caravanHealth = CARAVAN_MAX_HEALTH;
    this.wood = 0;
    this.elapsedSeconds = 0;
    this.spawnTimer = 0;
    this.enemySequence = 0;
    this.towerSequence = 0;
    this.gameOver = false;
    this.woodNodes = [];
    this.enemies = [];
    this.towers = [];
    this.gameOverText = undefined;
  }

  private createWoodNodes(): void {
    const nodes = [
      { x: 360, y: 260, amount: 24 },
      { x: 520, y: 470, amount: 18 },
      { x: 760, y: 210, amount: 30 },
      { x: 960, y: 520, amount: 20 },
      { x: 1220, y: 330, amount: 26 },
      { x: 1520, y: 220, amount: 24 },
      { x: 1840, y: 500, amount: 30 },
      { x: 2220, y: 290, amount: 18 },
      { x: 2680, y: 470, amount: 26 },
    ];

    this.woodNodes = nodes.map((node, index) => {
      const shape = this.add.circle(node.x, node.y, 15, 0x8d6e63);
      const label = this.add.text(node.x - 10, node.y - 34, `${node.amount}`, {
        color: '#fef3c7',
        fontFamily: 'monospace',
        fontSize: '12px',
      });
      return {
        id: `wood-${index}`,
        position: { x: node.x, y: node.y },
        remaining: node.amount,
        shape,
        label,
      };
    });
  }

  private updatePlayer(deltaSeconds: number): void {
    const xInput = (this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0);
    const yInput = (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0) - (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0);
    const direction = normalizeInput(xInput, yInput);

    this.playerPosition.x += direction.x * PLAYER_SPEED * deltaSeconds;
    this.playerPosition.y += direction.y * PLAYER_SPEED * deltaSeconds;
    this.playerPosition.y = Phaser.Math.Clamp(this.playerPosition.y, 36, 684);
    this.player.setPosition(this.playerPosition.x, this.playerPosition.y);
  }

  private updateCaravan(deltaSeconds: number): void {
    this.caravanPosition.x += CARAVAN_SPEED * deltaSeconds;
    this.caravan.setPosition(this.caravanPosition.x, this.caravanPosition.y);

    for (const tower of this.towers) {
      const slot = STAGE0_BUILD_SLOTS.find((candidate) => candidate.id === tower.slotId);
      if (!slot) {
        continue;
      }
      tower.position = getSlotWorldPosition(this.caravanPosition, slot);
      tower.shape.setPosition(tower.position.x, tower.position.y);
      tower.rangeShape.setPosition(tower.position.x, tower.position.y);
    }
  }

  private updateGathering(deltaSeconds: number): void {
    for (const node of [...this.woodNodes]) {
      if (distanceSquared(this.playerPosition, node.position) > GATHER_RANGE * GATHER_RANGE) {
        continue;
      }

      const gathered = Math.min(node.remaining, GATHER_RATE * deltaSeconds);
      node.remaining -= gathered;
      this.wood = Math.floor(this.wood + gathered);
      node.label.setText(`${Math.ceil(node.remaining)}`);

      if (node.remaining <= 0.01) {
        node.shape.destroy();
        node.label.destroy();
        this.woodNodes = this.woodNodes.filter((candidate) => candidate.id !== node.id);
      }
    }
  }

  private updateBuilding(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      return;
    }

    const spendResult = spendWood(this.wood, TOWER_COST);
    if (!spendResult.ok) {
      return;
    }

    const occupiedSlots = new Set(this.towers.map((tower) => tower.slotId));
    const slotId = selectNextOpenSlot(STAGE0_BUILD_SLOTS, occupiedSlots);
    const slot = STAGE0_BUILD_SLOTS.find((candidate) => candidate.id === slotId);
    if (!slot) {
      return;
    }

    this.wood = spendResult.wood;
    const position = getSlotWorldPosition(this.caravanPosition, slot);
    const rangeShape = this.add.circle(position.x, position.y, TOWER_RANGE, 0xffffff, 0);
    rangeShape.setStrokeStyle(1, 0x94a3b8, 0.35);
    const shape = this.add.rectangle(position.x, position.y, 24, 24, 0x9ca3af);
    this.towers.push({
      id: `tower-${this.towerSequence++}`,
      slotId,
      position,
      fireTimer: 0,
      shape,
      rangeShape,
    });
  }

  private updateSpawning(deltaSeconds: number): void {
    const interval = getSpawnInterval(this.elapsedSeconds);
    const result = updateSpawnTimer(this.spawnTimer, deltaSeconds, interval);
    this.spawnTimer = result.timer;

    for (let index = 0; index < result.spawnCount; index += 1) {
      this.spawnEnemy();
    }
  }

  private spawnEnemy(): void {
    const sideOffset = (this.enemySequence % 3) - 1;
    const position = {
      x: this.caravanPosition.x + 720 + (this.enemySequence % 2) * 160,
      y: Phaser.Math.Clamp(this.caravanPosition.y + sideOffset * 210, 60, 660),
    };
    const shape = this.add.circle(position.x, position.y, 13, 0xef4444);
    this.enemies.push({
      id: `enemy-${this.enemySequence++}`,
      position,
      health: ENEMY_HEALTH,
      damageTimer: 0,
      shape,
    });
  }

  private updateEnemies(deltaSeconds: number): void {
    for (const enemy of this.enemies) {
      enemy.position = moveToward(enemy.position, this.caravanPosition, ENEMY_SPEED * deltaSeconds);
      enemy.shape.setPosition(enemy.position.x, enemy.position.y);
      enemy.damageTimer = Math.max(0, enemy.damageTimer - deltaSeconds);

      const isTouchingCaravan = distanceSquared(enemy.position, this.caravanPosition) <= ENEMY_CONTACT_RANGE * ENEMY_CONTACT_RANGE;
      if (isTouchingCaravan && enemy.damageTimer <= 0) {
        this.caravanHealth = Math.max(0, this.caravanHealth - ENEMY_CONTACT_DAMAGE);
        enemy.damageTimer = ENEMY_DAMAGE_COOLDOWN;
      }
    }
  }

  private updateTowers(deltaSeconds: number): void {
    for (const tower of this.towers) {
      tower.fireTimer = Math.max(0, tower.fireTimer - deltaSeconds);
      if (tower.fireTimer > 0) {
        continue;
      }

      const target = selectNearestTarget(tower.position, this.enemies, TOWER_RANGE);
      if (!target) {
        continue;
      }

      const result = applyDamage(target.health, TOWER_DAMAGE);
      target.health = result.health;
      this.drawShot(tower.position, target.position);
      tower.fireTimer = TOWER_FIRE_INTERVAL;

      if (result.dead) {
        target.shape.destroy();
        this.enemies = this.enemies.filter((enemy) => enemy.id !== target.id);
      }
    }
  }

  private drawShot(from: Point, to: Point): void {
    const line = this.add.line(0, 0, from.x, from.y, to.x, to.y, 0xfacc15, 0.85).setOrigin(0, 0);
    this.time.delayedCall(80, () => line.destroy());
  }

  private updateCamera(): void {
    const focusX = (this.playerPosition.x + this.caravanPosition.x) / 2;
    const focusY = (this.playerPosition.y + this.caravanPosition.y) / 2;
    this.cameras.main.centerOn(focusX, focusY);
  }

  private updateHud(): void {
    this.hud.setText([
      `Caravan HP: ${this.caravanHealth}/${CARAVAN_MAX_HEALTH}`,
      `Wood: ${this.wood}`,
      `Time: ${this.elapsedSeconds.toFixed(1)}s`,
      `Towers: ${this.towers.length}/${STAGE0_BUILD_SLOTS.length}`,
      `Space: Tower (${TOWER_COST} wood)`,
    ]);
  }

  private showGameOver(): void {
    this.gameOver = true;
    this.gameOverText = this.add.text(640, 320, `Caravan Destroyed\nSurvived: ${this.elapsedSeconds.toFixed(1)}s\nPress R to restart`, {
      align: 'center',
      color: '#fee2e2',
      fontFamily: 'monospace',
      fontSize: '34px',
      lineSpacing: 12,
    });
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setScrollFactor(0);
  }
}
```

Confirm `src/main.ts` still contains:

```ts
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#1f2933',
  scene: [GameScene],
};

new Phaser.Game(config);
```

- [ ] **Step 2: Run unit tests**

Run:

```bash
npm test
```

Expected: PASS for all tests.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Start dev server for manual playtest**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL, normally `http://127.0.0.1:5173/`.

- [ ] **Step 5: Manual playtest**

Open the local URL and verify:

- WASD and arrow keys move the player.
- The green caravan moves right.
- Standing near brown wood nodes increases wood.
- Pressing `Space` with at least 20 wood places a tower.
- Towers shoot red enemies with yellow shot lines.
- Red enemies damage the caravan.
- Game over appears when caravan health reaches 0.
- Pressing `R` restarts after game over.

- [ ] **Step 6: Commit playable scene**

```bash
git add src/scenes/GameScene.ts src/main.ts
git commit -m "feat: build stage 0 playable greybox"
```

---

### Task 8: Final Verification and Documentation

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/plans/2026-04-29-phaser-stage-0-greybox.md`

- [ ] **Step 1: Create README**

Create `README.md`:

```md
# Caravan Greybox

Stage 0 Phaser greybox prototype for a moving-base survival defense loop.

## Requirements

- Node.js 20 or newer
- npm

## Commands

- `npm install` - install dependencies
- `npm run dev` - start local dev server
- `npm test` - run pure TypeScript rule tests
- `npm run build` - type-check and build production files

## Controls

- `W`, `A`, `S`, `D` or arrow keys - move
- `Space` - build an arrow tower when you have 20 wood
- `R` - restart after game over

## Stage 0 Goal

Gather wood away from the moving caravan, build towers around it, and survive as long as possible while enemies attack the caravan.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run build
```

Expected: both commands PASS.

- [ ] **Step 3: Check git status**

Run:

```bash
git status --short
```

Expected: only intentional untracked files remain, such as pre-existing research docs if they were not part of the implementation commits.

- [ ] **Step 4: Commit README and completed plan updates**

```bash
git add README.md docs/superpowers/plans/2026-04-29-phaser-stage-0-greybox.md
git commit -m "docs: add stage 0 run instructions"
```

---

## Plan Self-Review

- Spec coverage: Tasks cover Phaser/Vite setup, WASD movement, moving caravan, wood gathering, tower building, automatic tower targeting, enemies, caravan damage, game over, restart, HUD, tests, build, and manual playtest.
- Placeholder scan: No placeholder markers or unspecified code steps remain.
- Type consistency: `Point`, `Targetable`, `BuildSlot`, spawn timer helpers, and file paths are consistent across tasks.
