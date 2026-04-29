import Phaser from 'phaser';
import { getSlotWorldPosition, selectNextOpenSlot, STAGE0_BUILD_SLOTS } from '../game/buildSlots';
import { applyDamage, selectNearestTarget } from '../game/combat';
import { addWood, spendWood } from '../game/inventory';
import { distanceSquared, moveToward, normalizeInput, type Point } from '../game/math';
import { getObjectiveText } from '../game/objective';
import { getSpawnInterval, updateSpawnTimer } from '../game/spawnDirector';
import {
  addExperience,
  createExperienceState,
  ENEMY_EXPERIENCE_REWARD,
  requiredExperienceForLevel,
  type ExperienceState,
} from '../game/experience';
import { DEFAULT_RUN_STATS, type RunStats, type UpgradeDefinition } from '../game/upgrades';

const PLAYER_SPEED = 245;
const CARAVAN_SPEED = 24;
const GATHER_RANGE = 34;
const TOWER_COST = 20;
const ENEMY_HEALTH = 30;
const ENEMY_SPEED = 72;
const ENEMY_CONTACT_RANGE = 34;
const ENEMY_CONTACT_DAMAGE = 5;
const ENEMY_DAMAGE_COOLDOWN = 1;
const WORLD_WIDTH = 12000;
const OVERLAY_DEPTH = 1000;
const SPAWN_MARGIN = 96;
const THREAT_RANGE = 260;
const FEEDBACK_DURATION = 1.4;
const FEEDBACK_Y = 236;
const DAMAGE_FLASH_DURATION = 0.18;
const CARAVAN_NORMAL_COLOR = 0x4caf50;
const CARAVAN_DAMAGE_COLOR = 0xef4444;

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

type GameKey = 'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R' | 'ONE' | 'TWO' | 'THREE';

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<GameKey, Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Arc;
  private caravan!: Phaser.GameObjects.Rectangle;
  private hud!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private gameOverText?: Phaser.GameObjects.Text;
  private playerPosition: Point = { x: 120, y: 360 };
  private caravanPosition: Point = { x: 220, y: 360 };
  private stats: RunStats = { ...DEFAULT_RUN_STATS };
  private experience: ExperienceState = createExperienceState();
  private upgradeSelecting = false;
  private upgradeChoices: UpgradeDefinition[] = [];
  private upgradeOverlay?: Phaser.GameObjects.Container;
  private wood = 0;
  private elapsedSeconds = 0;
  private spawnTimer = 0;
  private feedbackTimer = 0;
  private caravanDamageFlashTimer = 0;
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
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, 720);

    this.add.grid(WORLD_WIDTH / 2, 360, WORLD_WIDTH, 720, 64, 64, 0x24313d, 0.35, 0x334452, 0.45);
    this.player = this.add.circle(this.playerPosition.x, this.playerPosition.y, 14, 0x42a5f5);
    this.caravan = this.add.rectangle(this.caravanPosition.x, this.caravanPosition.y, 86, 54, CARAVAN_NORMAL_COLOR);
    this.hud = this.add.text(18, 18, '', {
      color: '#f8fafc',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '18px',
      lineSpacing: 6,
    });
    this.hud.setScrollFactor(0);
    this.hud.setDepth(OVERLAY_DEPTH);
    this.feedbackText = this.add.text(18, FEEDBACK_Y, '', {
      color: '#facc15',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '18px',
    });
    this.feedbackText.setScrollFactor(0);
    this.feedbackText.setDepth(OVERLAY_DEPTH);

    this.cursors = this.input.keyboard!.createCursorKeys();
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
    this.updateFeedback(deltaSeconds);
    this.updateHud();

    if (this.stats.caravanHealth <= 0) {
      this.showGameOver();
    }
  }

  private resetState(): void {
    this.playerPosition = { x: 120, y: 360 };
    this.caravanPosition = { x: 220, y: 360 };
    this.stats = { ...DEFAULT_RUN_STATS };
    this.experience = createExperienceState();
    this.upgradeSelecting = false;
    this.upgradeChoices = [];
    this.upgradeOverlay = undefined;
    this.wood = 0;
    this.elapsedSeconds = 0;
    this.spawnTimer = 0;
    this.feedbackTimer = 0;
    this.caravanDamageFlashTimer = 0;
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
    let gatheredThisFrame = false;

    for (const node of [...this.woodNodes]) {
      if (distanceSquared(this.playerPosition, node.position) > GATHER_RANGE * GATHER_RANGE) {
        continue;
      }

      const gatherAmount = this.stats.gatherRate * deltaSeconds;
      const gathered = node.remaining <= gatherAmount ? node.remaining : gatherAmount;
      node.remaining -= gathered;
      this.wood = addWood(this.wood, gathered);
      if (gathered > 0) {
        gatheredThisFrame = true;
      }
      node.label.setText(`${Math.ceil(Math.max(0, node.remaining))}`);

      if (node.remaining <= 0) {
        node.shape.destroy();
        node.label.destroy();
        this.woodNodes = this.woodNodes.filter((candidate) => candidate.id !== node.id);
      }
    }

    if (gatheredThisFrame && this.feedbackTimer <= 0) {
      this.showFeedback(`采集中 +${this.formatNumber(this.stats.gatherRate)}/秒`, '#bbf7d0');
    }
  }

  private updateBuilding(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      return;
    }

    const occupiedSlots = new Set(this.towers.map((tower) => tower.slotId));
    const slotId = selectNextOpenSlot(STAGE0_BUILD_SLOTS, occupiedSlots);
    if (slotId === undefined) {
      this.showFeedback('箭塔槽位已满', '#fde68a');
      return;
    }

    const slot = STAGE0_BUILD_SLOTS.find((candidate) => candidate.id === slotId);
    if (!slot) {
      return;
    }

    const spendResult = spendWood(this.wood, TOWER_COST);
    if (!spendResult.ok) {
      this.showFeedback(`木材不足，需要 ${TOWER_COST}`, '#fde68a');
      return;
    }

    this.wood = spendResult.wood;
    const position = getSlotWorldPosition(this.caravanPosition, slot);
    const rangeShape = this.add.circle(position.x, position.y, this.stats.towerRange, 0xffffff, 0);
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
    const cameraRightEdge = this.cameras.main.worldView.right;
    const forwardSpawnX = cameraRightEdge + SPAWN_MARGIN + (this.enemySequence % 2) * 160;
    const position = {
      x: Math.min(forwardSpawnX, WORLD_WIDTH - SPAWN_MARGIN),
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
        this.stats.caravanHealth = Math.max(0, this.stats.caravanHealth - ENEMY_CONTACT_DAMAGE);
        enemy.damageTimer = ENEMY_DAMAGE_COOLDOWN;
        this.caravanDamageFlashTimer = DAMAGE_FLASH_DURATION;
        this.showFeedback('行城遭到攻击！', '#fecaca');
      }
    }
  }

  private updateTowers(deltaSeconds: number): void {
    for (const tower of this.towers) {
      tower.fireTimer = Math.max(0, tower.fireTimer - deltaSeconds);
      if (tower.fireTimer > 0) {
        continue;
      }

      const target = selectNearestTarget(tower.position, this.enemies, this.stats.towerRange);
      if (!target) {
        continue;
      }

      const result = applyDamage(target.health, this.stats.towerDamage);
      target.health = result.health;
      this.drawShot(tower.position, target.position);
      tower.fireTimer = this.stats.towerFireInterval;

      if (result.dead) {
        target.shape.destroy();
        this.enemies = this.enemies.filter((enemy) => enemy.id !== target.id);
        this.awardEnemyExperience();
      }
    }
  }

  private awardEnemyExperience(): void {
    if (this.gameOver || this.stats.caravanHealth <= 0) {
      return;
    }

    this.experience = addExperience(this.experience, ENEMY_EXPERIENCE_REWARD);
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

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  }

  private updateTowerRangeVisuals(): void {
    for (const tower of this.towers) {
      tower.rangeShape.setRadius(this.stats.towerRange);
    }
  }

  private updateFeedback(deltaSeconds: number): void {
    this.feedbackTimer = Math.max(0, this.feedbackTimer - deltaSeconds);
    if (this.feedbackTimer <= 0) {
      this.feedbackText.setText('');
    }

    this.caravanDamageFlashTimer = Math.max(0, this.caravanDamageFlashTimer - deltaSeconds);
    this.caravan.setFillStyle(this.caravanDamageFlashTimer > 0 ? CARAVAN_DAMAGE_COLOR : CARAVAN_NORMAL_COLOR);
  }

  private updateHud(): void {
    const objective = getObjectiveText({
      wood: this.wood,
      towerCost: TOWER_COST,
      hasOpenTowerSlot: this.hasOpenTowerSlot(),
      caravanThreatened: this.isCaravanThreatened(),
    });

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
  }

  private showGameOver(): void {
    this.gameOver = true;
    this.gameOverText = this.add.text(
      640,
      320,
      `行城被摧毁\n坚持时间：${this.elapsedSeconds.toFixed(1)} 秒\n按 R 重新开始`,
      {
        align: 'center',
        color: '#fee2e2',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '34px',
        lineSpacing: 12,
      },
    );
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setScrollFactor(0);
    this.gameOverText.setDepth(OVERLAY_DEPTH);
  }
}
