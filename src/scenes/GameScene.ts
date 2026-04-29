import Phaser from 'phaser';
import { getSlotWorldPosition, selectNextOpenSlot, STAGE0_BUILD_SLOTS } from '../game/buildSlots';
import { applyDamage, selectNearestTarget } from '../game/combat';
import { addWood, spendWood } from '../game/inventory';
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
    const xInput =
      (this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) -
      (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0);
    const yInput =
      (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0) -
      (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0);
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
      this.wood = addWood(this.wood, gathered);
      node.label.setText(`${Math.ceil(Math.max(0, node.remaining))}`);

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

    const occupiedSlots = new Set(this.towers.map((tower) => tower.slotId));
    const slotId = selectNextOpenSlot(STAGE0_BUILD_SLOTS, occupiedSlots);
    if (slotId === undefined) {
      return;
    }

    const slot = STAGE0_BUILD_SLOTS.find((candidate) => candidate.id === slotId);
    if (!slot) {
      return;
    }

    const spendResult = spendWood(this.wood, TOWER_COST);
    if (!spendResult.ok) {
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

      const isTouchingCaravan =
        distanceSquared(enemy.position, this.caravanPosition) <= ENEMY_CONTACT_RANGE * ENEMY_CONTACT_RANGE;
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
      `Wood: ${Math.floor(this.wood)}`,
      `Time: ${this.elapsedSeconds.toFixed(1)}s`,
      `Towers: ${this.towers.length}/${STAGE0_BUILD_SLOTS.length}`,
      `Space: Tower (${TOWER_COST} wood)`,
    ]);
  }

  private showGameOver(): void {
    this.gameOver = true;
    this.gameOverText = this.add.text(
      640,
      320,
      `Caravan Destroyed\nSurvived: ${this.elapsedSeconds.toFixed(1)}s\nPress R to restart`,
      {
        align: 'center',
        color: '#fee2e2',
        fontFamily: 'monospace',
        fontSize: '34px',
        lineSpacing: 12,
      },
    );
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setScrollFactor(0);
  }
}
