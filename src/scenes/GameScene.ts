import Phaser from 'phaser';
import {
  getCaravanCenter,
  getSlotWorldPosition,
  CELL_SIZE,
  GRID_BUILD_SLOTS,
  getBuildingName,
  getBuildingCostText,
  type BuildingType,
  type BuildSlot,
} from '../game/buildSlots';
import { applyDamage, selectHighestHealthTarget, selectNearestTarget } from '../game/combat';
import { addWood, spendWood } from '../game/inventory';
import { addStone, spendStone } from '../game/stoneInventory';
import { distanceSquared, moveToward, normalizeInput, type Point } from '../game/math';
import { getObjectiveText } from '../game/objective';
import { createWaveState, updateWaveState, type WaveState } from '../game/waveDirector';
import { getEnemyDefinition, type EnemyTypeId } from '../game/enemies';
import {
  addExperience,
  consumePendingLevelUp,
  createExperienceState,
  hasPendingLevelUp,
  requiredExperienceForLevel,
  type ExperienceState,
} from '../game/experience';
import {
  applyUpgrade,
  DEFAULT_RUN_STATS,
  pickUpgradeChoices,
  UPGRADE_POOL,
  type RunStats,
  type UpgradeDefinition,
} from '../game/upgrades';
import {
  damageWall,
  getWallHealthRatio,
  isWallDestroyed,
  WALL_COST,
} from '../game/walls';
import {
  formatVictoryStats,
  isVictoryConditionMet,
  MAX_WAVE,
  type GameStats,
} from '../game/victory';
import {
  createResourceSpawnerState,
  updateResourceSpawner,
  collectDepletedNodes,
  type ResourceNode,
  type ResourceSpawnerState,
} from '../game/resourceSpawner';

const PLAYER_SPEED = 245;
const CARAVAN_SPEED = 40;
const GATHER_RANGE = 40;
const ARROW_TOWER_COST = 20;
const CATAPULT_COST_WOOD = 20;
const CATAPULT_COST_STONE = 10;
const ENEMY_CONTACT_RANGE = 34;
const ENEMY_DAMAGE_COOLDOWN = 1;
const WORLD_WIDTH = 50000;
const OVERLAY_DEPTH = 1000;
const SPAWN_MARGIN = 96;
const THREAT_RANGE = 260;
const FEEDBACK_DURATION = 1.4;
const UPGRADE_INPUT_COOLDOWN = 0.2;
const FEEDBACK_Y = 306;
const DAMAGE_FLASH_DURATION = 0.18;
const CARAVAN_NORMAL_COLOR = 0x00695c;
const CARAVAN_DAMAGE_COLOR = 0xef4444;
const WALL_BLOCK_RANGE = 25;
const WALL_ATTACK_COOLDOWN = 1;
const WALL_DAMAGE_PER_HIT = 5;

interface RenderedNode {
  node: ResourceNode;
  trunk: Phaser.GameObjects.Rectangle;
  canopy: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  progressBar?: Phaser.GameObjects.Rectangle;
  gatherTimer: number;
}

interface StoneRenderedNode {
  node: ResourceNode;
  shape: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  progressBar?: Phaser.GameObjects.Rectangle;
  gatherTimer: number;
}

interface Wall {
  id: string;
  slotId: string;
  position: Point;
  health: number;
  maxHealth: number;
  shape: Phaser.GameObjects.Rectangle;
  healthBar: Phaser.GameObjects.Rectangle;
  healthText: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  crackLines: Phaser.GameObjects.Line[];
}

interface Enemy {
  id: string;
  type: EnemyTypeId;
  position: Point;
  radius: number;
  health: number;
  maxHealth: number;
  speed: number;
  contactDamage: number;
  experienceReward: number;
  damageTimer: number;
  shape: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  healthBar: Phaser.GameObjects.Rectangle;
  healthBarBg: Phaser.GameObjects.Rectangle;
  minionSpawnTimer?: number;
  rangedAttackTimer?: number;
  wallAttackTimer?: number;
  blockedByWallId?: string;
}

interface Tower {
  id: string;
  slotId: string;
  position: Point;
  fireTimer: number;
  // 视觉元素
  base: Phaser.GameObjects.Container;
  type: 'arrow' | 'catapult';
  label: Phaser.GameObjects.Text;
  rangeShape: Phaser.GameObjects.Arc;
}

interface FloatingText {
  text: Phaser.GameObjects.Text;
  timer: number;
}

type GameKey = 'W' | 'A' | 'S' | 'D' | 'B' | 'R' | 'ONE' | 'TWO' | 'THREE';

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<GameKey, Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Container;
  private caravan!: Phaser.GameObjects.Rectangle;
  private caravanHealthBar!: Phaser.GameObjects.Rectangle;
  private caravanHealthBarBg!: Phaser.GameObjects.Rectangle;
  private caravanHealthText!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private gameOverText?: Phaser.GameObjects.Text;
  private playerPosition: Point = { x: 120, y: 360 };
  private caravanTopLeft: Point = { x: 172, y: 312 };
  private stats: RunStats = { ...DEFAULT_RUN_STATS };
  private experience: ExperienceState = createExperienceState();
  private upgradeSelecting = false;
  private upgradeInputCooldown = 0;
  private upgradeChoices: UpgradeDefinition[] = [];
  private upgradeOverlay?: Phaser.GameObjects.Container;
  private wood = 0;
  private stone = 0;
  private elapsedSeconds = 0;
  private waveState: WaveState = createWaveState();
  private feedbackTimer = 0;
  private caravanDamageFlashTimer = 0;
  private enemySequence = 0;
  private towerSequence = 0;
  private wallSequence = 0;
  private gameOver = false;
  private victoryAchieved = false;
  private victoryText?: Phaser.GameObjects.Text;
  private totalEnemiesKilled = 0;
  private totalWoodGathered = 0;
  private totalStoneGathered = 0;
  private totalWallsBuilt = 0;
  private totalTowersBuilt = 0;
  private resourceSpawner: ResourceSpawnerState = createResourceSpawnerState();
  private woodRenderedNodes: RenderedNode[] = [];
  private stoneRenderedNodes: StoneRenderedNode[] = [];
  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private walls: Wall[] = [];
  private floatingTexts: FloatingText[] = [];
  private roadLines: Phaser.GameObjects.Line[] = [];

  // Build mode
  private buildMode = false;
  private buildingOverlay?: Phaser.GameObjects.Container;
  private selectedBuildSlot?: BuildSlot;
  private buildSlotHighlights: Map<string, Phaser.GameObjects.Rectangle> = new Map();

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.resetState();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, 720);

    this.createRoad();
    this.player = this.createPlayerContainer(this.playerPosition.x, this.playerPosition.y);
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    this.caravan = this.add.rectangle(caravanCenter.x, caravanCenter.y, 96, 96, CARAVAN_NORMAL_COLOR);
    this.caravan.setDepth(5);
    this.createCaravanHealthBar(caravanCenter.x, caravanCenter.y);

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
      B: Phaser.Input.Keyboard.KeyCodes.B,
      R: Phaser.Input.Keyboard.KeyCodes.R,
      ONE: Phaser.Input.Keyboard.KeyCodes.ONE,
      TWO: Phaser.Input.Keyboard.KeyCodes.TWO,
      THREE: Phaser.Input.Keyboard.KeyCodes.THREE,
    }) as Record<GameKey, Phaser.Input.Keyboard.Key>;

    this.createInitialWoodNodes();
    this.createInitialStoneNodes();
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

    if (this.upgradeSelecting) {
      this.upgradeInputCooldown = Math.max(0, this.upgradeInputCooldown - deltaSeconds);
      this.updateUpgradeInput();
      this.updateHud();
      return;
    }

    this.handleBuildModeToggle();

    this.elapsedSeconds += deltaSeconds;
    this.updatePlayer(deltaSeconds);
    this.updateCaravan(deltaSeconds);
    this.updateResourceSpawning(deltaSeconds);
    this.updateGathering(deltaSeconds);
    this.updateSpawning(deltaSeconds);
    this.updateEnemies(deltaSeconds);
    this.updateTowers(deltaSeconds);
    this.updateCamera();
    this.updateFloatingTexts(deltaSeconds);
    this.updateFeedback(deltaSeconds);
    this.applyPendingWallRepair();
    this.updateHud();

    if (this.victoryAchieved) {
      return;
    }

    if (isVictoryConditionMet(this.waveState.currentWave, this.enemies.length)) {
      this.showVictory();
    }

    if (this.stats.caravanHealth <= 0) {
      this.showGameOver();
    }
  }

  private resetState(): void {
    this.playerPosition = { x: 120, y: 360 };
    this.caravanTopLeft = { x: 172, y: 312 };
    this.stats = { ...DEFAULT_RUN_STATS };
    this.experience = createExperienceState();
    this.hideUpgradeOverlay();
    this.upgradeSelecting = false;
    this.upgradeInputCooldown = 0;
    this.upgradeChoices = [];
    this.upgradeOverlay = undefined;
    this.wood = 0;
    this.stone = 0;
    this.elapsedSeconds = 0;
    this.waveState = createWaveState();
    this.feedbackTimer = 0;
    this.caravanDamageFlashTimer = 0;
    this.enemySequence = 0;
    this.towerSequence = 0;
    this.wallSequence = 0;
    this.gameOver = false;
    this.victoryAchieved = false;
    this.victoryText = undefined;
    this.totalEnemiesKilled = 0;
    this.totalWoodGathered = 0;
    this.totalStoneGathered = 0;
    this.totalWallsBuilt = 0;
    this.totalTowersBuilt = 0;
    this.resourceSpawner = createResourceSpawnerState();
    this.woodRenderedNodes = [];
    this.stoneRenderedNodes = [];
    this.enemies = [];
    this.towers = [];
    this.walls = [];
    this.floatingTexts = [];
    this.roadLines = [];
    this.gameOverText = undefined;
    this.buildMode = false;
    this.buildingOverlay = undefined;
    this.selectedBuildSlot = undefined;
    this.buildSlotHighlights = new Map();
  }

  // ── Road ──

  private createRoad(): void {
    // 道路背景
    this.add.rectangle(WORLD_WIDTH / 2, 360, WORLD_WIDTH, 120, 0x3e2723, 0.5);
    // 道路中心虚线
    for (let x = 0; x < WORLD_WIDTH; x += 40) {
      const line = this.add.line(0, 0, x, 360, x + 20, 360, 0xffffff, 0.15).setOrigin(0, 0);
      this.roadLines.push(line);
    }
  }

  // ── Player ──

  private createPlayerContainer(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(10);
    // 身体
    const body = this.add.circle(0, 0, 14, 0x42a5f5);
    // 光环
    const ring = this.add.circle(0, 0, 18, 0x42a5f5, 0);
    ring.setStrokeStyle(1, 0x90caf9, 0.4);
    container.add([body, ring]);
    return container;
  }

  // ── Caravan Health Bar ──

  private createCaravanHealthBar(centerX: number, centerY: number): void {
    const barWidth = 100;
    const barY = centerY - 58;
    this.caravanHealthBarBg = this.add.rectangle(centerX, barY, barWidth + 4, 10, 0x1f2937);
    this.caravanHealthBarBg.setDepth(6);
    this.caravanHealthBar = this.add.rectangle(centerX - (barWidth / 2) + 2, barY, barWidth, 8, 0x4caf50);
    this.caravanHealthBar.setOrigin(0, 0.5);
    this.caravanHealthBar.setDepth(7);
    this.caravanHealthText = this.add.text(centerX, barY, `${Math.ceil(this.stats.caravanHealth)}/${this.stats.caravanMaxHealth}`, {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '11px',
    });
    this.caravanHealthText.setOrigin(0.5);
    this.caravanHealthText.setDepth(8);
  }

  private updateCaravanHealthBar(): void {
    const ratio = this.stats.caravanHealth / this.stats.caravanMaxHealth;
    const barWidth = 100 * Math.max(0, ratio);
    this.caravanHealthBar.setSize(Math.max(0, barWidth), 8);
    if (ratio > 0.5) {
      this.caravanHealthBar.setFillStyle(0x4caf50);
    } else if (ratio > 0.25) {
      this.caravanHealthBar.setFillStyle(0xfdd835);
    } else {
      this.caravanHealthBar.setFillStyle(0xef4444);
    }
    this.caravanHealthText.setText(`${Math.ceil(this.stats.caravanHealth)}/${this.stats.caravanMaxHealth}`);
  }

  private updateCaravanHealthBarPosition(centerX: number, centerY: number): void {
    const barY = centerY - 58;
    this.caravanHealthBarBg.setPosition(centerX, barY);
    this.caravanHealthBar.setPosition(centerX - 48, barY);
    this.caravanHealthText.setPosition(centerX, barY);
  }

  // ── Initial Resource Nodes (first batch) ──

  private createInitialWoodNodes(): void {
    const nodes = [
      { x: 360, y: 260, amount: 24 },
      { x: 520, y: 470, amount: 18 },
      { x: 760, y: 210, amount: 30 },
      { x: 960, y: 520, amount: 20 },
      { x: 1220, y: 330, amount: 26 },
    ];
    for (const node of nodes) {
      this.createWoodNodeVisual(node.x, node.y, node.amount);
    }
    this.resourceSpawner.lastSpawnX = 1220;
  }

  private createInitialStoneNodes(): void {
    const nodes = [
      { x: 400, y: 200, amount: 20 },
      { x: 750, y: 500, amount: 15 },
      { x: 1200, y: 280, amount: 25 },
    ];
    for (const node of nodes) {
      this.createStoneNodeVisual(node.x, node.y, node.amount);
    }
  }

  // ── Wood Node Visual (树干 + 树冠) ──

  private createWoodNodeVisual(x: number, y: number, amount: number): RenderedNode {
    const trunk = this.add.rectangle(x, y + 8, 8, 18, 0x5d4037);
    trunk.setDepth(2);
    const canopy = this.add.circle(x, y - 8, 16, 0x4caf50);
    canopy.setDepth(3);
    const label = this.add.text(x - 8, y - 28, `${amount}`, {
      color: '#fef3c7',
      fontFamily: 'monospace',
      fontSize: '11px',
    });
    label.setDepth(4);
    const node: ResourceNode = {
      id: `wood-${this.resourceSpawner.nextId++}`,
      position: { x, y },
      remaining: amount,
      maxAmount: amount,
      type: 'wood',
      radius: 18,
      color: 0x4caf50,
    };
    this.resourceSpawner.woodNodes.push(node);
    const rendered: RenderedNode = { node, trunk, canopy, label, gatherTimer: 0 };
    this.woodRenderedNodes.push(rendered);
    return rendered;
  }

  // ── Stone Node Visual (灰色石块) ──

  private createStoneNodeVisual(x: number, y: number, amount: number): StoneRenderedNode {
    const shape = this.add.rectangle(x, y, 24, 20, 0x78909c);
    shape.setDepth(2);
    shape.setStrokeStyle(1, 0x90a4ae, 0.5);
    const label = this.add.text(x - 8, y - 18, `${amount}`, {
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: '11px',
    });
    label.setDepth(4);
    const node: ResourceNode = {
      id: `stone-${this.resourceSpawner.nextId++}`,
      position: { x, y },
      remaining: amount,
      maxAmount: amount,
      type: 'stone',
      radius: 14,
      color: 0x78909c,
    };
    this.resourceSpawner.stoneNodes.push(node);
    const rendered: StoneRenderedNode = { node, shape, label, gatherTimer: 0 };
    this.stoneRenderedNodes.push(rendered);
    return rendered;
  }

  // ── Resource Spawning (dynamic) ──

  private updateResourceSpawning(deltaSeconds: number): void {
    const camera = this.cameras.main;
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    const { spawned } = updateResourceSpawner(
      this.resourceSpawner,
      caravanCenter.x,
      camera.worldView.right,
      camera.worldView.left,
      720,
      Math.random,
    );

    for (const node of spawned) {
      if (node.type === 'wood') {
        this.createWoodNodeVisual(node.position.x, node.position.y, node.remaining);
      } else {
        this.createStoneNodeVisual(node.position.x, node.position.y, node.remaining);
      }
    }

    // 清理已耗尽的节点
    this.removeDepletedWoodNodes();
    this.removeDepletedStoneNodes();
  }

  private removeDepletedWoodNodes(): void {
    const depleted = collectDepletedNodes(this.resourceSpawner.woodNodes);
    for (const d of depleted) {
      const idx = this.woodRenderedNodes.findIndex((r) => r.node.id === d.id);
      if (idx >= 0) {
        const r = this.woodRenderedNodes[idx];
        r.trunk.destroy();
        r.canopy.destroy();
        r.label.destroy();
        r.progressBar?.destroy();
        this.woodRenderedNodes.splice(idx, 1);
      }
    }
  }

  private removeDepletedStoneNodes(): void {
    const depleted = collectDepletedNodes(this.resourceSpawner.stoneNodes);
    for (const d of depleted) {
      const idx = this.stoneRenderedNodes.findIndex((r) => r.node.id === d.id);
      if (idx >= 0) {
        const r = this.stoneRenderedNodes[idx];
        r.shape.destroy();
        r.label.destroy();
        r.progressBar?.destroy();
        this.stoneRenderedNodes.splice(idx, 1);
      }
    }
  }

  private getSlotCenter(slot: BuildSlot): Point {
    const pos = getSlotWorldPosition(this.caravanTopLeft, slot);
    return {
      x: pos.x + CELL_SIZE / 2,
      y: pos.y + CELL_SIZE / 2,
    };
  }

  private getOccupiedSlotIds(): Set<string> {
    const ids = new Set<string>();
    for (const t of this.towers) ids.add(t.slotId);
    for (const w of this.walls) ids.add(w.slotId);
    return ids;
  }

  private handleBuildModeToggle(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.B)) {
      return;
    }

    if (this.buildMode) {
      this.buildMode = false;
      this.destroyBuildSlotHighlights();
      this.hideBuildMenu();
    } else {
      this.buildMode = true;
      this.createBuildSlotHighlights();
    }
  }

  private createBuildSlotHighlights(): void {
    const occupiedSlotIds = this.getOccupiedSlotIds();

    for (const slot of GRID_BUILD_SLOTS) {
      if (occupiedSlotIds.has(slot.id)) {
        continue;
      }

      const center = this.getSlotCenter(slot);
      const highlight = this.add.rectangle(center.x, center.y, 44, 44, 0xffffff, 0.1);
      highlight.setStrokeStyle(1, 0xfacc15, 0.6);
      highlight.setInteractive({ useHandCursor: true });
      highlight.on('pointerover', () => {
        highlight.setFillStyle(0xfacc15, 0.25);
      });
      highlight.on('pointerout', () => {
        highlight.setFillStyle(0xffffff, 0.1);
      });
      highlight.on('pointerdown', () => {
        this.showBuildMenu(slot);
      });

      this.buildSlotHighlights.set(slot.id, highlight);
    }
  }

  private destroyBuildSlotHighlights(): void {
    for (const highlight of this.buildSlotHighlights.values()) {
      highlight.destroy();
    }
    this.buildSlotHighlights.clear();
  }

  private updateBuildSlotHighlights(): void {
    for (const [slotId, highlight] of this.buildSlotHighlights) {
      const slot = GRID_BUILD_SLOTS.find((s) => s.id === slotId);
      if (!slot) {
        continue;
      }
      const center = this.getSlotCenter(slot);
      highlight.setPosition(center.x, center.y);
    }
  }

  private removeBuildSlotHighlight(slotId: string): void {
    const highlight = this.buildSlotHighlights.get(slotId);
    if (highlight) {
      highlight.destroy();
      this.buildSlotHighlights.delete(slotId);
    }
  }

  private showBuildMenu(slot: BuildSlot): void {
    this.hideBuildMenu();

    const camera = this.cameras.main;
    const slotCenter = this.getSlotCenter(slot);
    const screenX = slotCenter.x - camera.scrollX;
    const screenY = slotCenter.y - camera.scrollY;

    const overlay = this.add.container(screenX, screenY);
    overlay.setScrollFactor(0);
    overlay.setDepth(OVERLAY_DEPTH + 30);

    const backdrop = this.add.rectangle(0, 0, 220, 100, 0x111827, 0.95);
    backdrop.setStrokeStyle(2, 0xfacc15, 0.85);

    const title = this.add.text(0, -36, '选择建筑', {
      color: '#fef3c7',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '16px',
    });
    title.setOrigin(0.5);

    overlay.add([backdrop, title]);

    type BuildOption = { type: BuildingType; label: string; cost: string };
    const options: BuildOption[] = [];

    if (slot.buildingType === 'wall') {
      options.push({ type: 'wall', label: getBuildingName('wall'), cost: getBuildingCostText('wall') });
    } else {
      options.push({ type: 'arrow', label: getBuildingName('arrow'), cost: getBuildingCostText('arrow') });
      options.push({ type: 'catapult', label: getBuildingName('catapult'), cost: getBuildingCostText('catapult') });
    }

    options.forEach((option, index) => {
      const y = -8 + index * 34;
      const btn = this.add.rectangle(0, y, 200, 28, 0x1f2937, 1);
      btn.setStrokeStyle(1, 0x94a3b8, 0.5);
      btn.setInteractive({ useHandCursor: true });

      const name = this.add.text(-90, y, option.label, {
        color: '#f8fafc',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
      });
      name.setOrigin(0, 0.5);

      const cost = this.add.text(90, y, option.cost, {
        color: '#bfdbfe',
        fontFamily: 'monospace',
        fontSize: '12px',
      });
      cost.setOrigin(1, 0.5);

      btn.on('pointerdown', () => {
        this.buildFromMenu(option.type, slot);
      });

      overlay.add([btn, name, cost]);
    });

    this.buildingOverlay = overlay;
    this.selectedBuildSlot = slot;
  }

  private hideBuildMenu(): void {
    if (!this.buildingOverlay) {
      return;
    }
    this.buildingOverlay.destroy(true);
    this.buildingOverlay = undefined;
    this.selectedBuildSlot = undefined;
  }

  private buildFromMenu(buildingType: BuildingType, slot: BuildSlot): void {
    const center = this.getSlotCenter(slot);

    switch (buildingType) {
      case 'arrow': {
        const result = spendWood(this.wood, ARROW_TOWER_COST);
        if (!result.ok) {
          this.showFeedback(`木材不足，需要 ${ARROW_TOWER_COST}`, '#fde68a');
          return;
        }
        this.wood = result.wood;
        this.buildArrowTower(slot, center);
        break;
      }
      case 'catapult': {
        const woodResult = spendWood(this.wood, CATAPULT_COST_WOOD);
        if (!woodResult.ok) {
          this.showFeedback(`木材不足，需要 ${CATAPULT_COST_WOOD}`, '#fde68a');
          return;
        }
        const stoneResult = spendStone(this.stone, CATAPULT_COST_STONE);
        if (!stoneResult.ok) {
          this.showFeedback(`石料不足，需要 ${CATAPULT_COST_STONE}`, '#fde68a');
          return;
        }
        this.wood = woodResult.wood;
        this.stone = stoneResult.wood;
        this.buildCatapult(slot, center);
        break;
      }
      case 'wall': {
        const result = spendWood(this.wood, WALL_COST);
        if (!result.ok) {
          this.showFeedback(`木材不足，需要 ${WALL_COST}`, '#fde68a');
          return;
        }
        this.wood = result.wood;
        this.buildWall(slot, center);
        break;
      }
    }

    this.hideBuildMenu();
    this.removeBuildSlotHighlight(slot.id);
    this.updateHud();
  }

  // ── Tower: Arrow (三角形图标) ──

  private buildArrowTower(slot: BuildSlot, center: Point): void {
    const rangeShape = this.add.circle(center.x, center.y, this.stats.towerRange, 0xffffff, 0);
    rangeShape.setStrokeStyle(1, 0x94a3b8, 0.35);
    rangeShape.setDepth(4);

    const base = this.add.container(center.x, center.y);
    base.setDepth(6);

    // 棕色底座
    const baseRect = this.add.rectangle(0, 0, 28, 28, 0x8d6e63);
    // 三角形塔尖
    const triangle = this.add.triangle(0, -8, -12, 8, 12, 8, 0, -12, 0x607d8b);
    // 箭头图标
    const arrow = this.add.triangle(0, -16, -6, 0, 6, 0, 0, -8, 0xfacc15);
    base.add([baseRect, triangle, arrow]);

    const label = this.add.text(center.x, center.y - 28, '箭塔', {
      color: '#f8fafc',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '11px',
    });
    label.setOrigin(0.5);
    label.setDepth(8);

    this.towers.push({
      id: `tower-${this.towerSequence++}`,
      slotId: slot.id,
      position: { x: center.x, y: center.y },
      fireTimer: 0,
      base,
      type: 'arrow',
      label,
      rangeShape,
    });
    this.totalTowersBuilt++;
  }

  // ── Tower: Catapult (圆形图标) ──

  private buildCatapult(slot: BuildSlot, center: Point): void {
    const rangeShape = this.add.circle(center.x, center.y, this.stats.catapultRange, 0xffffff, 0);
    rangeShape.setStrokeStyle(1, 0xff9800, 0.35);
    rangeShape.setDepth(4);

    const base = this.add.container(center.x, center.y);
    base.setDepth(6);

    // 深灰色圆形底座
    const circle = this.add.circle(0, 0, 18, 0x616161);
    circle.setStrokeStyle(2, 0x424242, 0.8);
    // 抛射臂
    const arm = this.add.rectangle(0, -10, 6, 20, 0x9e9e9e);
    base.add([circle, arm]);

    const label = this.add.text(center.x, center.y - 28, '投石车', {
      color: '#f8fafc',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '11px',
    });
    label.setOrigin(0.5);
    label.setDepth(8);

    this.towers.push({
      id: `tower-${this.towerSequence++}`,
      slotId: slot.id,
      position: { x: center.x, y: center.y },
      fireTimer: 0,
      base,
      type: 'catapult',
      label,
      rangeShape,
    });
    this.totalTowersBuilt++;
  }

  // ── Wall (砖纹矩形) ──

  private buildWall(slot: BuildSlot, center: Point): void {
    const maxHp = this.stats.wallMaxHealth;
    const shape = this.add.rectangle(center.x, center.y, 16, 40, 0x795548);
    shape.setStrokeStyle(1, 0x5d4037, 0.8);
    shape.setDepth(6);
    // 砖纹线
    const crackLines: Phaser.GameObjects.Line[] = [];
    const h1 = this.add.line(0, 0, center.x - 6, center.y - 8, center.x + 6, center.y - 8, 0x5d4037, 0.5).setOrigin(0, 0);
    const h2 = this.add.line(0, 0, center.x - 6, center.y + 8, center.x + 6, center.y + 8, 0x5d4037, 0.5).setOrigin(0, 0);
    h1.setDepth(7);
    h2.setDepth(7);
    crackLines.push(h1, h2);

    const healthBar = this.add.rectangle(center.x, center.y - 28, 24, 4, 0x4caf50);
    healthBar.setDepth(8);
    const healthText = this.add.text(center.x - 10, center.y - 28, `${maxHp}`, {
      color: '#f8fafc',
      fontFamily: 'monospace',
      fontSize: '10px',
    });
    healthText.setDepth(9);
    const label = this.add.text(center.x, center.y - 42, '城墙', {
      color: '#f8fafc',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '11px',
    });
    label.setOrigin(0.5);
    label.setDepth(8);

    this.walls.push({
      id: `wall-${this.wallSequence++}`,
      slotId: slot.id,
      position: { x: center.x, y: center.y },
      health: maxHp,
      maxHealth: maxHp,
      shape,
      healthBar,
      healthText,
      label,
      crackLines,
    });
    this.totalWallsBuilt++;
  }

  // ── Player ──

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

  // ── Caravan ──

  private updateCaravan(deltaSeconds: number): void {
    this.caravanTopLeft.x += CARAVAN_SPEED * deltaSeconds;
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    this.caravan.setPosition(caravanCenter.x, caravanCenter.y);
    this.updateCaravanHealthBarPosition(caravanCenter.x, caravanCenter.y);
    this.updateCaravanHealthBar();

    for (const tower of this.towers) {
      const slot = GRID_BUILD_SLOTS.find((candidate) => candidate.id === tower.slotId);
      if (!slot) {
        continue;
      }

      const center = this.getSlotCenter(slot);
      tower.position = { x: center.x, y: center.y };
      tower.base.setPosition(center.x, center.y);
      tower.rangeShape.setPosition(center.x, center.y);
      tower.label.setPosition(center.x, center.y - 28);
    }

    for (const wall of this.walls) {
      const slot = GRID_BUILD_SLOTS.find((candidate) => candidate.id === wall.slotId);
      if (!slot) {
        continue;
      }

      const center = this.getSlotCenter(slot);
      wall.position = { x: center.x, y: center.y };
      wall.shape.setPosition(center.x, center.y);
      wall.healthBar.setPosition(center.x, center.y - 28);
      wall.healthText.setPosition(center.x - 10, center.y - 28);
      wall.label.setPosition(center.x, center.y - 42);
      for (const line of wall.crackLines) {
        line.setPosition(center.x, center.y);
      }
    }

    if (this.buildMode) {
      this.updateBuildSlotHighlights();
    }
  }

  // ── Gathering ──

  private updateGathering(deltaSeconds: number): void {
    let gatheredThisFrame = false;

    for (const rendered of [...this.woodRenderedNodes]) {
      const { node } = rendered;
      if (node.remaining <= 0) continue;
      if (distanceSquared(this.playerPosition, node.position) > GATHER_RANGE * GATHER_RANGE) {
        rendered.gatherTimer = 0;
        rendered.progressBar?.destroy();
        rendered.progressBar = undefined;
        continue;
      }

      rendered.gatherTimer += deltaSeconds;
      const gatherTime = 0.5; // 每次采集 0.5s
      const gatherAmount = this.stats.gatherRate * deltaSeconds;
      if (rendered.gatherTimer >= gatherTime) {
        const gathered = Math.min(gatherAmount, node.remaining);
        node.remaining -= gathered;
        this.wood = addWood(this.wood, gathered);
        this.totalWoodGathered += gathered;
        if (gathered > 0) gatheredThisFrame = true;
        rendered.gatherTimer = 0;

        // 采集进度条
        if (node.remaining > 0) {
          if (!rendered.progressBar) {
            rendered.progressBar = this.add.rectangle(node.position.x, node.position.y + 22, 24, 3, 0x8bc34a);
            rendered.progressBar.setDepth(5);
          }
        }
      }

      rendered.label.setText(`${Math.ceil(Math.max(0, node.remaining))}`);

      // 树干闪烁（采集中）
      const canopyScale = 1 + Math.sin(rendered.gatherTimer * 10) * 0.08;
      rendered.canopy.setScale(canopyScale);
    }

    for (const rendered of [...this.stoneRenderedNodes]) {
      const { node } = rendered;
      if (node.remaining <= 0) continue;
      if (distanceSquared(this.playerPosition, node.position) > GATHER_RANGE * GATHER_RANGE) {
        rendered.gatherTimer = 0;
        rendered.progressBar?.destroy();
        rendered.progressBar = undefined;
        continue;
      }

      rendered.gatherTimer += deltaSeconds;
      const gatherTime = 0.5;
      const gathered = Math.min(this.stats.gatherRate * deltaSeconds, node.remaining);
      node.remaining -= gathered;
      this.stone = addStone(this.stone, gathered);
      this.totalStoneGathered += gathered;
      if (gathered > 0) gatheredThisFrame = true;
      rendered.gatherTimer = 0;

      rendered.label.setText(`${Math.ceil(Math.max(0, node.remaining))}`);

      // 石块闪烁
      const flash = 0.7 + Math.sin(rendered.gatherTimer * 10) * 0.3;
      rendered.shape.setAlpha(flash);
    }

    if (gatheredThisFrame && this.feedbackTimer <= 0) {
      this.showFeedback(`采集中 +${this.formatNumber(this.stats.gatherRate)}/秒`, '#bbf7d0');
    }
  }

  // ── Wave Spawning ──

  private updateSpawning(deltaSeconds: number): void {
    const result = updateWaveState(this.waveState, deltaSeconds);
    this.waveState = result.state;

    if (!result.startedWave) {
      return;
    }

    this.showFeedback(`第 ${this.waveState.currentWave} 波来袭！`);

    const spawnBatchStart = this.enemySequence;
    result.spawnedEnemies.forEach((type, index) => {
      this.spawnEnemy(type, index, spawnBatchStart);
    });
  }

  // ── Enemy Spawn ──

  private spawnEnemy(type: EnemyTypeId = 'grunt', waveIndex = 0, spawnBatchStart = this.enemySequence): void {
    const definition = getEnemyDefinition(type);
    if (!definition) {
      return;
    }

    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    const placementIndex = spawnBatchStart + waveIndex;
    const sideOffset = (placementIndex % 3) - 1;
    const depthOffset = Math.floor(waveIndex / 3) * 72;
    const cameraRightEdge = this.cameras.main.worldView.right;
    const forwardSpawnX = cameraRightEdge + SPAWN_MARGIN + (placementIndex % 2) * 160 + depthOffset;
    const position = {
      x: Math.min(forwardSpawnX, WORLD_WIDTH - SPAWN_MARGIN),
      y: Phaser.Math.Clamp(caravanCenter.y + sideOffset * 210, 60, 660),
    };
    const shape = this.add.circle(position.x, position.y, definition.radius, definition.color);
    shape.setDepth(8);
    const label = this.add.text(position.x, position.y - definition.radius - 20, definition.label, {
      color: '#f8fafc',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '12px',
    });
    label.setOrigin(0.5);
    label.setDepth(10);

    // 血条背景
    const barWidth = definition.radius * 2 + 4;
    const healthBarY = position.y - definition.radius - 10;
    const healthBarBg = this.add.rectangle(position.x, healthBarY, barWidth, 5, 0x1f2937);
    healthBarBg.setDepth(9);
    const healthBar = this.add.rectangle(position.x - barWidth / 2 + 2, healthBarY, barWidth - 4, 3, 0x4caf50);
    healthBar.setOrigin(0, 0.5);
    healthBar.setDepth(10);

    const maxHealth = definition.health;

    this.enemies.push({
      id: `enemy-${this.enemySequence++}`,
      type,
      position,
      radius: definition.radius,
      health: definition.health,
      maxHealth,
      speed: definition.speed,
      contactDamage: definition.contactDamage,
      experienceReward: definition.experienceReward,
      damageTimer: 0,
      shape,
      label,
      healthBar,
      healthBarBg,
      minionSpawnTimer: definition.minionSpawnInterval ? 0 : undefined,
      rangedAttackTimer: definition.rangedAttackCooldown ? 0 : undefined,
      wallAttackTimer: 0,
    });
  }

  private spawnEnemyNear(type: EnemyTypeId, nearPosition: Point, offset: number): void {
    const definition = getEnemyDefinition(type);
    if (!definition) {
      return;
    }

    const position = {
      x: Phaser.Math.Clamp(nearPosition.x + offset, 50, WORLD_WIDTH - 50),
      y: Phaser.Math.Clamp(nearPosition.y + (offset % 2 === 0 ? 30 : -30), 60, 660),
    };
    const shape = this.add.circle(position.x, position.y, definition.radius, definition.color);
    shape.setDepth(8);
    const label = this.add.text(position.x, position.y - definition.radius - 20, definition.label, {
      color: '#f8fafc',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '12px',
    });
    label.setOrigin(0.5);
    label.setDepth(10);

    const barWidth = definition.radius * 2 + 4;
    const healthBarY = position.y - definition.radius - 10;
    const healthBarBg = this.add.rectangle(position.x, healthBarY, barWidth, 5, 0x1f2937);
    healthBarBg.setDepth(9);
    const healthBar = this.add.rectangle(position.x - barWidth / 2 + 2, healthBarY, barWidth - 4, 3, 0x4caf50);
    healthBar.setOrigin(0, 0.5);
    healthBar.setDepth(10);

    this.enemies.push({
      id: `enemy-${this.enemySequence++}`,
      type,
      position,
      radius: definition.radius,
      health: definition.health,
      maxHealth: definition.health,
      speed: definition.speed,
      contactDamage: definition.contactDamage,
      experienceReward: definition.experienceReward,
      damageTimer: 0,
      shape,
      label,
      healthBar,
      healthBarBg,
      minionSpawnTimer: definition.minionSpawnInterval ? 0 : undefined,
      rangedAttackTimer: definition.rangedAttackCooldown ? 0 : undefined,
      wallAttackTimer: 0,
    });
  }

  // ── Update Enemy Visual ──

  private updateEnemyHealthBar(enemy: Enemy): void {
    const ratio = enemy.health / enemy.maxHealth;
    const barWidth = (enemy.radius * 2 + 4 - 4) * Math.max(0, ratio);
    enemy.healthBar.setSize(Math.max(0, barWidth), 3);
    if (ratio > 0.5) {
      enemy.healthBar.setFillStyle(0x4caf50);
    } else if (ratio > 0.25) {
      enemy.healthBar.setFillStyle(0xfdd835);
    } else {
      enemy.healthBar.setFillStyle(0xef4444);
    }
  }

  private updateWallVisual(wall: Wall): void {
    const ratio = getWallHealthRatio(wall);
    const barWidth = 24 * ratio;
    wall.healthBar.setSize(Math.max(0, barWidth), 4);
    if (ratio > 0.5) {
      wall.healthBar.setFillStyle(0x4caf50);
    } else if (ratio > 0.25) {
      wall.healthBar.setFillStyle(0xfdd835);
    } else {
      wall.healthBar.setFillStyle(0xef4444);
    }
    wall.healthText.setText(`${Math.ceil(wall.health)}`);

    // 受损显示裂缝
    if (ratio < 0.5) {
      for (const line of wall.crackLines) {
        line.setStrokeStyle(2, 0xef4444, 0.6);
      }
    }
  }

  // ── Enemies ──

  private updateEnemies(deltaSeconds: number): void {
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);

    for (const enemy of this.enemies) {
      enemy.damageTimer = Math.max(0, enemy.damageTimer - deltaSeconds);
      enemy.shape.setPosition(enemy.position.x, enemy.position.y);
      enemy.label.setPosition(enemy.position.x, enemy.position.y - enemy.radius - 20);

      // 血条跟随
      const healthBarY = enemy.position.y - enemy.radius - 10;
      const barWidth = enemy.radius * 2 + 4;
      enemy.healthBarBg.setPosition(enemy.position.x, healthBarY);
      enemy.healthBar.setPosition(enemy.position.x - barWidth / 2 + 2, healthBarY);
      this.updateEnemyHealthBar(enemy);

      // Boss 召唤
      if (enemy.type === 'boss' && enemy.minionSpawnTimer !== undefined) {
        const definition = getEnemyDefinition('boss');
        enemy.minionSpawnTimer += deltaSeconds;
        if (definition && enemy.minionSpawnTimer >= definition.minionSpawnInterval!) {
          enemy.minionSpawnTimer = 0;
          const count = definition.minionCount ?? 2;
          for (let i = 0; i < count; i++) {
            this.spawnEnemyNear(definition.minionType ?? 'grunt', enemy.position, i * 40);
          }
        }
      }

      // 投石怪远程攻击
      if (enemy.type === 'thrower') {
        const definition = getEnemyDefinition('thrower');
        if (definition && definition.preferredDistance) {
          const distToCaravan = Math.sqrt(distanceSquared(enemy.position, caravanCenter));
          if (distToCaravan <= definition.preferredDistance + 20) {
            enemy.rangedAttackTimer = (enemy.rangedAttackTimer ?? 0) + deltaSeconds;
            const cooldown = definition.rangedAttackCooldown ?? 1.5;
            if (enemy.rangedAttackTimer >= cooldown) {
              enemy.rangedAttackTimer = 0;
              const rangedDmg = definition.rangedAttackDamage ?? 5;
              this.stats.caravanHealth = Math.max(0, this.stats.caravanHealth - rangedDmg);
              this.caravanDamageFlashTimer = DAMAGE_FLASH_DURATION;
              this.showFeedback('投石怪攻击了行城！', '#fecaca');
              // 投射物视觉效果
              this.drawProjectileToTarget(enemy.position, caravanCenter, 0xff6f00, 150);
            }
            continue;
          }
        }
      }

      // 墙体阻挡
      let blockedByWall: Wall | undefined;
      let minWallDist = Number.POSITIVE_INFINITY;
      for (const wall of this.walls) {
        const wallDist = distanceSquared(enemy.position, wall.position);
        const blockThreshold = (enemy.radius + WALL_BLOCK_RANGE) * (enemy.radius + WALL_BLOCK_RANGE);
        if (wallDist <= blockThreshold && wallDist < minWallDist) {
          blockedByWall = wall;
          minWallDist = wallDist;
        }
      }

      if (blockedByWall) {
        enemy.blockedByWallId = blockedByWall.id;
        enemy.wallAttackTimer = (enemy.wallAttackTimer ?? 0) + deltaSeconds;
        if (enemy.wallAttackTimer >= WALL_ATTACK_COOLDOWN) {
          enemy.wallAttackTimer = 0;
          const newState = damageWall(
            {
              id: blockedByWall.id,
              slotId: blockedByWall.slotId,
              position: blockedByWall.position,
              health: blockedByWall.health,
              maxHealth: blockedByWall.maxHealth,
            },
            WALL_DAMAGE_PER_HIT,
          );
          blockedByWall.health = newState.health;
          this.updateWallVisual(blockedByWall);
          if (isWallDestroyed(blockedByWall)) {
            blockedByWall.shape.destroy();
            blockedByWall.healthBar.destroy();
            blockedByWall.healthText.destroy();
            blockedByWall.label.destroy();
            for (const line of blockedByWall.crackLines) line.destroy();
            this.walls = this.walls.filter((w) => w.id !== blockedByWall!.id);
            enemy.blockedByWallId = undefined;
            enemy.wallAttackTimer = 0;
          }
        }
        continue;
      }

      enemy.blockedByWallId = undefined;
      enemy.wallAttackTimer = 0;

      enemy.position = moveToward(enemy.position, caravanCenter, enemy.speed * deltaSeconds);

      // 攻击行城
      const isTouchingCaravan =
        distanceSquared(enemy.position, caravanCenter) <= ENEMY_CONTACT_RANGE * ENEMY_CONTACT_RANGE;
      if (isTouchingCaravan && enemy.damageTimer <= 0) {
        this.stats.caravanHealth = Math.max(0, this.stats.caravanHealth - enemy.contactDamage);
        enemy.damageTimer = ENEMY_DAMAGE_COOLDOWN;
        this.caravanDamageFlashTimer = DAMAGE_FLASH_DURATION;
        this.showFeedback('行城遭到攻击！', '#fecaca');
      }
    }
  }

  // ── Towers ──

  private updateTowers(deltaSeconds: number): void {
    for (const tower of this.towers) {
      tower.fireTimer = Math.max(0, tower.fireTimer - deltaSeconds);
      if (tower.fireTimer > 0) {
        continue;
      }

      if (tower.type === 'arrow') {
        const target = selectNearestTarget(tower.position, this.enemies, this.stats.towerRange);
        if (!target) {
          continue;
        }

        const result = applyDamage(target.health, this.stats.towerDamage);
        target.health = result.health;
        // 箭：快速直线投射
        this.drawArrowProjectile(tower.position, target.position);
        tower.fireTimer = this.stats.towerFireInterval;

        if (result.dead) {
          this.removeEnemy(target);
        }
      } else if (tower.type === 'catapult') {
        const target = selectHighestHealthTarget(tower.position, this.enemies, this.stats.catapultRange);
        if (!target) {
          continue;
        }

        const result = applyDamage(target.health, this.stats.catapultDamage);
        target.health = result.health;
        // 投石：抛物线投射
        this.drawCatapultProjectile(tower.position, target.position);

        const killedIds = new Set<string>();
        if (result.dead) {
          killedIds.add(target.id);
        }

        for (const enemy of this.enemies) {
          if (enemy.id === target.id) {
            continue;
          }
          const splashDist = distanceSquared(enemy.position, target.position);
          if (splashDist <= this.stats.catapultSplashRadius * this.stats.catapultSplashRadius) {
            const splashResult = applyDamage(enemy.health, this.stats.catapultDamage);
            enemy.health = splashResult.health;
            if (splashResult.dead) {
              killedIds.add(enemy.id);
            }
          }
        }

        this.drawSplashCircle(target.position, this.stats.catapultSplashRadius);

        for (const id of killedIds) {
          const killed = this.enemies.find((e) => e.id === id);
          if (killed) {
            this.removeEnemy(killed);
          }
        }

        tower.fireTimer = this.stats.catapultFireInterval;
      }
    }
  }

  // ── Arrow Projectile ──

  private drawArrowProjectile(from: Point, to: Point): void {
    const arrow = this.add.circle(from.x, from.y, 3, 0xfacc15);
    arrow.setDepth(12);
    const duration = 120;
    this.tweens.add({
      targets: arrow,
      x: to.x,
      y: to.y,
      duration,
      ease: 'Linear',
      onComplete: () => {
        // 命中闪烁
        const flash = this.add.circle(to.x, to.y, 6, 0xffffff, 0.8);
        flash.setDepth(12);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          scale: 2,
          duration: 100,
          onComplete: () => flash.destroy(),
        });
        arrow.destroy();
      },
    });
  }

  // ── Catapult Projectile (抛物线) ──

  private drawCatapultProjectile(from: Point, to: Point): void {
    const rock = this.add.circle(from.x, from.y, 5, 0xff9800);
    rock.setDepth(12);
    const duration = 400;
    const midX = (from.x + to.x) / 2;
    const midY = Math.min(from.y, to.y) - 60;
    this.tweens.add({
      targets: rock,
      x: to.x,
      y: to.y,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        // 模拟抛物线
        const progress = tween.progress;
        const arcY = midY - Math.sin(progress * Math.PI) * 80;
        rock.setY(arcY + (to.y - arcY) * progress + from.y * (1 - progress) * Math.sin((1 - progress) * Math.PI) * 0.3);
      },
      onComplete: () => {
        // 爆炸效果
        const boom = this.add.circle(to.x, to.y, 15, 0xff9800, 0.6);
        boom.setDepth(12);
        this.tweens.add({
          targets: boom,
          alpha: 0,
          scale: 3,
          duration: 200,
          onComplete: () => boom.destroy(),
        });
        rock.destroy();
      },
    });
  }

  // ── Thrower Projectile ──

  private drawProjectileToTarget(from: Point, to: Point, color: number, speed: number): void {
    const proj = this.add.circle(from.x, from.y, 4, color);
    proj.setDepth(12);
    this.tweens.add({
      targets: proj,
      x: to.x,
      y: to.y,
      duration: (Math.sqrt(distanceSquared(from, to)) / speed) * 1000,
      ease: 'Linear',
      onComplete: () => {
        const flash = this.add.circle(to.x, to.y, 8, 0xff6f00, 0.5);
        flash.setDepth(12);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          scale: 2,
          duration: 150,
          onComplete: () => flash.destroy(),
        });
        proj.destroy();
      },
    });
  }

  private drawSplashCircle(center: Point, radius: number): void {
    const circle = this.add.circle(center.x, center.y, radius, 0xff9800, 0);
    circle.setStrokeStyle(2, 0xff9800, 0.4);
    circle.setDepth(11);
    this.tweens.add({
      targets: circle,
      alpha: 0,
      scale: 1.5,
      duration: 250,
      onComplete: () => circle.destroy(),
    });
  }

  private removeEnemy(enemy: Enemy): void {
    // 击杀爆炸效果
    const explosion = this.add.circle(enemy.position.x, enemy.position.y, enemy.radius * 2, enemy.shape.fillColor, 0.6);
    explosion.setDepth(12);
    this.tweens.add({
      targets: explosion,
      alpha: 0,
      scale: 0.1,
      duration: 300,
      onComplete: () => explosion.destroy(),
    });

    // 经验球飞出
    const xpOrb = this.add.circle(enemy.position.x, enemy.position.y, 4, 0x76ff03, 0.9);
    xpOrb.setDepth(13);
    this.tweens.add({
      targets: xpOrb,
      y: enemy.position.y - 30,
      alpha: 0,
      duration: 500,
      onComplete: () => xpOrb.destroy(),
    });

    // 伤害数字
    this.showFloatingText(enemy.position.x, enemy.position.y - enemy.radius, '✕', 0xef4444, 400);

    enemy.shape.destroy();
    enemy.label.destroy();
    enemy.healthBar.destroy();
    enemy.healthBarBg.destroy();
    this.enemies = this.enemies.filter((e) => e.id !== enemy.id);
    this.totalEnemiesKilled++;
    this.awardEnemyExperience(enemy.experienceReward);
  }

  private awardEnemyExperience(amount: number): void {
    if (this.gameOver || this.stats.caravanHealth <= 0) {
      return;
    }

    this.experience = addExperience(this.experience, amount);
    this.tryOpenUpgradeChoices();
  }

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

  private updateUpgradeInput(): void {
    if (this.upgradeInputCooldown > 0) {
      return;
    }

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

  private drawShot(from: Point, to: Point, color = 0xfacc15): void {
    const line = this.add.line(0, 0, from.x, from.y, to.x, to.y, color, 0.85).setOrigin(0, 0);
    this.time.delayedCall(80, () => line.destroy());
  }

  // ── Floating Damage Text ──

  private showFloatingText(x: number, y: number, text: string, color: number, duration: number): void {
    const colorHex = `#${color.toString(16).padStart(6, '0')}`;
    const t = this.add.text(x, y, text, {
      color: colorHex,
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
    });
    t.setOrigin(0.5);
    t.setDepth(14);
    this.floatingTexts.push({ text: t, timer: duration / 1000 });
  }

  private updateFloatingTexts(deltaSeconds: number): void {
    for (const ft of this.floatingTexts) {
      ft.timer -= deltaSeconds;
      ft.text.setY(ft.text.y - 40 * deltaSeconds);
      ft.text.setAlpha(Math.max(0, ft.timer * 2));
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => {
      if (ft.timer <= 0) {
        ft.text.destroy();
        return false;
      }
      return true;
    });
  }

  private applyPendingWallRepair(): void {
    if (this.stats.pendingWallRepair > 0) {
      const repairAmount = this.stats.pendingWallRepair;
      this.stats.pendingWallRepair = 0;
      for (const wall of this.walls) {
        wall.health = Math.min(wall.maxHealth, wall.health + repairAmount);
        this.updateWallVisual(wall);
      }
    }
  }

  private updateCamera(): void {
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    const focusX = (this.playerPosition.x + caravanCenter.x) / 2;
    const focusY = (this.playerPosition.y + caravanCenter.y) / 2;
    this.cameras.main.centerOn(focusX, focusY);
  }

  private hasOpenTowerSlot(): boolean {
    const occupiedSlotIds = this.getOccupiedSlotIds();
    return GRID_BUILD_SLOTS.some(
      (slot) => slot.buildingType !== 'wall' && !occupiedSlotIds.has(slot.id),
    );
  }

  private isCaravanThreatened(): boolean {
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    const threatRangeSquared = THREAT_RANGE * THREAT_RANGE;
    return this.enemies.some(
      (enemy) => enemy.health > 0 && distanceSquared(enemy.position, caravanCenter) <= threatRangeSquared,
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
      // 悬停高亮
      card.on('pointerover', () => {
        card.setStrokeStyle(2, 0xfacc15, 1);
        card.setFillStyle(0x374151, 1);
      });
      card.on('pointerout', () => {
        card.setStrokeStyle(1, 0x94a3b8, 0.7);
        card.setFillStyle(0x1f2937, 1);
      });
      card.on('pointerdown', () => {
        if (this.upgradeInputCooldown > 0) {
          return;
        }
        this.selectUpgrade(index);
      });

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
    this.upgradeInputCooldown = UPGRADE_INPUT_COOLDOWN;
    this.updateTowerRangeVisuals();
    this.updateHud();
    this.tryOpenUpgradeChoices();
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
      towerCost: ARROW_TOWER_COST,
      hasOpenTowerSlot: this.hasOpenTowerSlot(),
      caravanThreatened: this.isCaravanThreatened(),
    });

    const wallSlotCount = GRID_BUILD_SLOTS.filter((s) => s.buildingType === 'wall').length;
    const buildModeText = this.buildMode ? '[B] 建造模式：开启' : '[B] 建造模式：关闭';

    const lines = [
      `行城生命：${Math.ceil(this.stats.caravanHealth)}/${this.stats.caravanMaxHealth}`,
      `木材：${Math.floor(this.wood)}`,
      `石料：${Math.floor(this.stone)}`,
      `等级：${this.experience.level}`,
      `经验：${Math.floor(this.experience.experience)}/${requiredExperienceForLevel(this.experience.level)}`,
      `波次：${this.waveState.currentWave}/${MAX_WAVE}`,
      `下一波：${Math.ceil(this.waveState.nextWaveTimer)} 秒`,
      `时间：${Math.floor(this.elapsedSeconds)} 秒`,
      `箭塔：${this.towers.length}`,
      `城墙：${this.walls.length}/${wallSlotCount}`,
      buildModeText,
      objective,
    ];

    this.hud.setText(lines);
  }

  private showGameOver(): void {
    this.gameOver = true;
    const stats: GameStats = {
      wavesSurvived: this.waveState.currentWave,
      timeElapsed: this.elapsedSeconds,
      enemiesKilled: this.totalEnemiesKilled,
      towersBuilt: this.totalTowersBuilt,
      woodGathered: this.totalWoodGathered,
      stoneGathered: this.totalStoneGathered,
      wallsBuilt: this.totalWallsBuilt,
    };
    this.gameOverText = this.add.text(
      640,
      320,
      formatVictoryStats(stats, false),
      {
        align: 'center',
        color: '#fee2e2',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '26px',
        lineSpacing: 8,
      },
    );
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setScrollFactor(0);
    this.gameOverText.setDepth(OVERLAY_DEPTH);
  }

  private showVictory(): void {
    this.victoryAchieved = true;
    this.gameOver = true;
    const stats: GameStats = {
      wavesSurvived: this.waveState.currentWave,
      timeElapsed: this.elapsedSeconds,
      enemiesKilled: this.totalEnemiesKilled,
      towersBuilt: this.totalTowersBuilt,
      woodGathered: this.totalWoodGathered,
      stoneGathered: this.totalStoneGathered,
      wallsBuilt: this.totalWallsBuilt,
    };
    this.victoryText = this.add.text(
      640,
      300,
      formatVictoryStats(stats, true),
      {
        align: 'center',
        color: '#bbf7d0',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '26px',
        lineSpacing: 8,
      },
    );
    this.victoryText.setOrigin(0.5);
    this.victoryText.setScrollFactor(0);
    this.victoryText.setDepth(OVERLAY_DEPTH);
  }
}
