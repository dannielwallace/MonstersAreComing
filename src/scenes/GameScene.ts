import Phaser from 'phaser';
import {
  addCarriedResource,
  createCarriedResources,
  createResourceWallet,
  depositCarriedResources,
  harvestNode,
  repairCaravanWithStone,
  spendResources,
  type CarriedResources,
  type ResourceAmounts,
  type ResourceWallet,
} from '../game/resources';
import {
  BUILDING_DEFINITIONS,
  computeAdjacencyBonus,
  getBuildingDefinition,
  getBuildingCostText as getCatalogCostText,
  spendBuildingCost,
  canBuild,
  type PlacedBuilding,
} from '../game/buildings';
import {
  createShopState,
  purchaseShopItem,
  rerollShop,
  type ShopItem,
  type ShopState,
} from '../game/shop';
import {
  addWeapon,
  createWeaponState,
  getWeaponDefinition,
  markWeaponFired,
  updateWeaponTimers,
  type WeaponState,
} from '../game/weapons';
import {
  createSummonState,
  getMinionDefinition,
  killMinion,
  spawnMinion,
  updateMinionLifetime,
  type MinionState,
  type SummonState,
} from '../game/summons';
import {
  completeRewardCircle,
  createRewardCircle,
  createRouteEventState,
  updateRewardCircle,
  type RouteEvent,
  type RouteEventState,
} from '../game/events';
import {
  createBossState,
  startBoss,
  updateBossState,
  type BossState,
} from '../game/boss';
import {
  addBuildingDamage,
  addBuildingKill,
  addHeroDamage,
  createRunResults,
  formatBuildingDpsRows,
  type RunResults,
} from '../game/results';
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
  type UpgradeId,
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
import {
  createHeroAttackState,
  updateHeroAttack,
  HERO_ATTACK_RANGE,
  HERO_ATTACK_DAMAGE,
} from '../game/hero';

const PLAYER_SPEED = 260;
const CARAVAN_SPEED = 35;
const GATHER_RANGE = 55;
const DEPOSIT_RANGE = 88;
const STONE_REPAIR_RATE = 5;
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
const WALL_BLOCK_RANGE = 25;
const WALL_ATTACK_COOLDOWN = 1;
const WALL_DAMAGE_PER_HIT = 5;
const SCREEN_SHAKE_INTENSITY = 0.004;
const SCREEN_SHAKE_DURATION = 120;

interface RenderedNode {
  node: ResourceNode;
  container: Phaser.GameObjects.Container;
  canopy: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  gatherTimer: number;
}

interface StoneRenderedNode {
  node: ResourceNode;
  shape: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  gatherTimer: number;
}

interface Wall {
  id: string;
  slotId: string;
  position: Point;
  health: number;
  maxHealth: number;
  shape: Phaser.GameObjects.Container;
  healthBar: Phaser.GameObjects.Rectangle;
  healthText: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
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
  body: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  healthBar: Phaser.GameObjects.Rectangle;
  healthBarBg: Phaser.GameObjects.Rectangle;
  hitFlashTimer: number;
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
  base: Phaser.GameObjects.Container;
  type: Exclude<BuildingType, 'wall'>;
  label: Phaser.GameObjects.Text;
  rangeShape: Phaser.GameObjects.Arc;
}

interface FloatingText {
  text: Phaser.GameObjects.Text;
  timer: number;
}

type GameKey = 'W' | 'A' | 'S' | 'D' | 'B' | 'R' | 'ONE' | 'TWO' | 'THREE' | 'SPACE' | 'ESCAPE' | 'P';

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<GameKey, Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Container;
  private playerSword?: Phaser.GameObjects.Container;
  private torchGlow?: Phaser.GameObjects.Arc;
  private caravanBody!: Phaser.GameObjects.Container;
  private caravanHealthBar!: Phaser.GameObjects.Rectangle;
  private caravanHealthBarBg!: Phaser.GameObjects.Rectangle;
  private caravanHealthText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private gameOverText?: Phaser.GameObjects.Text;
  private playerPosition: Point = { x: 290, y: 360 };
  private caravanTopLeft: Point = { x: 172, y: 312 };
  private stats: RunStats = { ...DEFAULT_RUN_STATS };
  private experience: ExperienceState = createExperienceState();
  private upgradeSelecting = false;
  private upgradeInputCooldown = 0;
  private upgradeChoices: UpgradeDefinition[] = [];
  private upgradeOverlay?: Phaser.GameObjects.Container;
  private wallet: ResourceWallet = createResourceWallet();
  private carried: CarriedResources = createCarriedResources();
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
  private heroAttack = createHeroAttackState();
  private lastWaveAnnounced = 0;
  private waveBanner?: Phaser.GameObjects.Text;
  private waveBannerTimer = 0;
  private paused = false;
  private pauseOverlay?: Phaser.GameObjects.Container;

  // Build mode
  private buildMode = false;
  private buildingOverlay?: Phaser.GameObjects.Container;
  private selectedBuildSlot?: BuildSlot;
  private buildSlotHighlights: Map<string, Phaser.GameObjects.Rectangle> = new Map();

  // Card hand
  private cardHand: Exclude<BuildingType, 'wall'>[] = [];
  private cardPanels: Phaser.GameObjects.Rectangle[] = [];  // interactive backgrounds
  private cardLabels: Phaser.GameObjects.Text[] = [];
  private cardCosts: Phaser.GameObjects.Text[] = [];
  private selectedCardIndex = -1;
  private cardHandContainer?: Phaser.GameObjects.Container;

  // HUD panels
  private healthPanel?: Phaser.GameObjects.Container;
  private healthBar?: Phaser.GameObjects.Rectangle;
  private healthBarBg?: Phaser.GameObjects.Rectangle;
  private healthText?: Phaser.GameObjects.Text;
  private healthLabel?: Phaser.GameObjects.Text;
  private wavePanel?: Phaser.GameObjects.Container;
  private waveText?: Phaser.GameObjects.Text;
  private xpBarBg?: Phaser.GameObjects.Rectangle;
  private xpBarFill?: Phaser.GameObjects.Rectangle;
  private xpText?: Phaser.GameObjects.Text;
  private resourcePanel?: Phaser.GameObjects.Container;
  private walletText?: Phaser.GameObjects.Text;
  private carriedText?: Phaser.GameObjects.Text;

  // P1 systems
  private shop?: ShopState;
  private shopOverlay?: Phaser.GameObjects.Container;
  private shopOpen = false;
  private nextShopAtSeconds = 180;
  private weapons: WeaponState = createWeaponState();
  private summons: SummonState = createSummonState();
  private minionVisuals: Map<string, Phaser.GameObjects.Container> = new Map();
  private routeEvents: RouteEventState = createRouteEventState();
  private boss: BossState = createBossState();
  private bossStarted = false;
  private results: RunResults = createRunResults();
  private eventVisuals: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.resetState();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, 720);

    this.createTerrain();
    this.createRoad();
    this.createRoadsideScenery();
    this.createVignette();
    this.player = this.createPlayerContainer(this.playerPosition.x, this.playerPosition.y);
    this.caravanBody = this.createCaravan(getCaravanCenter(this.caravanTopLeft));
    this.createCaravanHealthBar(getCaravanCenter(this.caravanTopLeft));

    this.createHudPanels();
    this.feedbackText = this.add.text(18, FEEDBACK_Y, '', {
      color: '#d4a843',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '14px',
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
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      ESCAPE: Phaser.Input.Keyboard.KeyCodes.ESC,
      P: Phaser.Input.Keyboard.KeyCodes.P,
    }) as Record<GameKey, Phaser.Input.Keyboard.Key>;

    this.createInitialWoodNodes();
    this.createInitialStoneNodes();
    this.addCardToHand('arrow');
    this.updateHudPanels();
    this.createCardHand();

    // Hint text
    const hint = this.add.text(640, 690, 'WASD: 移动 | SPACE: 攻击 | 点击建筑卡片建造 | P: 暂停', {
      color: '#8a7a68',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '12px',
    });
    hint.setOrigin(0.5);
    hint.setScrollFactor(0);
    hint.setDepth(OVERLAY_DEPTH - 1);
  }

  update(_time: number, deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    // Pause toggle
    if (!this.gameOver && (Phaser.Input.Keyboard.JustDown(this.keys.P) || Phaser.Input.Keyboard.JustDown(this.keys.ESCAPE))) {
      if (!this.upgradeSelecting) {
        this.togglePause();
      }
    }
    if (this.paused) return;

    if (this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
        this.scene.restart();
      }
      return;
    }

    if (this.upgradeSelecting) {
      this.upgradeInputCooldown = Math.max(0, this.upgradeInputCooldown - deltaSeconds);
      this.updateUpgradeInput();
      this.updateHudPanels();
      return;
    }

    this.handleBuildModeToggle();

    this.elapsedSeconds += deltaSeconds;
    this.updatePlayer(deltaSeconds);
    this.updateCaravan(deltaSeconds);
    this.updateResourceSpawning(deltaSeconds);
    this.updateGathering(deltaSeconds);
    this.updateResourceDeposit();
    this.maybeOpenShop();
    this.updateHeroAttack(deltaSeconds);
    this.updateWeapons(deltaSeconds);
    this.updateTorch(deltaSeconds);
    this.updateSpawning(deltaSeconds);
    this.updateRouteEvents(deltaSeconds);
    this.updateBoss(deltaSeconds);
    this.updateMinions(deltaSeconds);
    this.updateEnemies(deltaSeconds);
    this.updateTowers(deltaSeconds);
    this.updateCamera();
    this.updateFloatingTexts(deltaSeconds);
    this.updateFeedback(deltaSeconds);
    this.updateWaveBanner(deltaSeconds);
    this.applyPendingWallRepair();
    this.updateHudPanels();

    if (this.victoryAchieved) return;

    if (this.isP1VictoryConditionMet()) {
      this.showVictory();
    }
    if (this.stats.caravanHealth <= 0) {
      this.showGameOver();
    }
  }

  private resetState(): void {
    this.playerPosition = { x: 290, y: 360 };
    this.caravanTopLeft = { x: 172, y: 312 };
    this.stats = { ...DEFAULT_RUN_STATS };
    this.experience = createExperienceState();
    this.hideUpgradeOverlay();
    this.upgradeSelecting = false;
    this.upgradeInputCooldown = 0;
    this.upgradeChoices = [];
    this.upgradeOverlay = undefined;
    this.wallet = createResourceWallet();
    this.carried = createCarriedResources();
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
    this.heroAttack = createHeroAttackState();
    this.lastWaveAnnounced = 0;
    this.waveBannerTimer = 0;
    this.paused = false;
    this.pauseOverlay = undefined;
    this.gameOverText = undefined;
    this.buildMode = false;
    this.buildingOverlay = undefined;
    this.selectedBuildSlot = undefined;
    this.buildSlotHighlights = new Map();
    this.shop = undefined;
    this.shopOpen = false;
    this.nextShopAtSeconds = 180;
    this.hideShopOverlay();
    this.weapons = createWeaponState();
    this.summons = createSummonState();
    for (const visual of this.minionVisuals.values()) visual.destroy(true);
    this.minionVisuals.clear();
    this.routeEvents = createRouteEventState();
    this.boss = createBossState();
    this.bossStarted = false;
    this.results = createRunResults();
    for (const visual of this.eventVisuals.values()) visual.destroy(true);
    this.eventVisuals.clear();
  }

  // ═══════════════════════════════════════════════════
  // TERRAIN & ROAD (暗黑森林风格)
  // ═══════════════════════════════════════════════════

  private createTerrain(): void {
    // 暗色森林地面
    this.add.rectangle(WORLD_WIDTH / 2, 360, WORLD_WIDTH, 720, 0x2a3a28, 0.95).setDepth(0);
    // 地面纹理变化
    for (let x = 0; x < WORLD_WIDTH; x += 60) {
      for (let i = 0; i < 4; i++) {
        const gx = x + Math.random() * 60;
        const gy = 30 + Math.random() * 660;
        const patch = this.add.circle(gx, gy, 15 + Math.random() * 25, 0x2a3a28, 0.3 + Math.random() * 0.2);
        patch.setDepth(0);
      }
    }
    // 远处枯树（背景层）
    for (let x = 0; x < WORLD_WIDTH; x += 200) {
      const treeSide = Math.random() > 0.5 ? 1 : -1;
      const treeY = treeSide > 0 ? 80 + Math.random() * 200 : 480 + Math.random() * 160;
      this.createDeadTree(x + Math.random() * 100, treeY, 0.6 + Math.random() * 0.4);
    }
  }

  private createDeadTree(x: number, y: number, scale = 1): void {
    const g = this.add.graphics();
    g.setDepth(0);
    g.fillStyle(0x1a2a18, 0.6);
    // 树干
    g.fillRect(x - 2 * scale, y - 30 * scale, 4 * scale, 30 * scale);
    // 树枝（枯枝剪影）
    g.fillRect(x - 16 * scale, y - 28 * scale, 16 * scale, 2 * scale);
    g.fillRect(x, y - 20 * scale, 14 * scale, 2 * scale);
    g.fillRect(x - 10 * scale, y - 36 * scale, 2 * scale, 12 * scale);
    // 稀疏枯叶
    g.fillStyle(0x2a3a28, 0.3);
    g.fillCircle(x - 14 * scale, y - 30 * scale, 6 * scale);
    g.fillCircle(x + 8 * scale, y - 22 * scale, 5 * scale);
    g.destroy();
  }

  private createRoad(): void {
    // 土路
    this.add.rectangle(WORLD_WIDTH / 2, 360, WORLD_WIDTH, 100, 0x3a3020, 0.9).setDepth(1);
    // 路边石子
    this.add.rectangle(WORLD_WIDTH / 2, 308, WORLD_WIDTH, 4, 0x4a4030, 0.5).setDepth(1);
    this.add.rectangle(WORLD_WIDTH / 2, 412, WORLD_WIDTH, 4, 0x4a4030, 0.5).setDepth(1);
    // 路面纹理（车辙、坑洼）
    for (let x = 0; x < WORLD_WIDTH; x += 80) {
      const spot = this.add.circle(x + Math.random() * 40, 340 + Math.random() * 40, 3 + Math.random() * 5, 0x2a2018, 0.4);
      spot.setDepth(1);
    }
    // 车辙痕迹
    for (let x = 0; x < WORLD_WIDTH; x += 40) {
      if (Math.random() > 0.4) {
        const rut = this.add.rectangle(x + Math.random() * 20, 350 + Math.random() * 20, 12 + Math.random() * 8, 1.5, 0x2a1a10, 0.3);
        rut.setDepth(1);
      }
    }
    // 路边枯草
    for (let x = 0; x < WORLD_WIDTH; x += 40) {
      for (let side = -1; side <= 1; side += 2) {
        if (Math.random() > 0.5) continue;
        const gx = x + Math.random() * 30;
        const gy = side > 0 ? 295 + Math.random() * 10 : 415 + Math.random() * 10;
        const blade = this.add.line(0, 0, gx, gy, gx + (Math.random() - 0.5) * 6, gy - 8 - Math.random() * 6, 0x3a4a2a, 0.4).setOrigin(0, 0);
        blade.setDepth(1);
      }
    }
  }

  private createRoadsideScenery(): void {
    // Medieval ruins along the road (broken walls, arches, collapsed towers)
    for (let x = 300; x < WORLD_WIDTH; x += 600 + Math.random() * 400) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const ruinY = side > 0 ? 260 + Math.random() * 30 : 440 + Math.random() * 30;
      this.createRoadsideRuin(x + Math.random() * 100, ruinY);
    }

    // Resource clusters: groups of 2-3 wood/stone nodes placed together
    for (let x = 500; x < WORLD_WIDTH; x += 800 + Math.random() * 600) {
      const clusterX = x + Math.random() * 200;
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const cx = clusterX + i * 50 + Math.random() * 30;
        const cy = 180 + Math.random() * 60 + (Math.random() > 0.5 ? 300 : 0);
        // Small tree stump or rock as cluster marker
        if (Math.random() > 0.5) {
          const stump = this.add.circle(cx, cy, 6 + Math.random() * 4, 0x3a2a18, 0.35);
          stump.setDepth(1);
        } else {
          const rock = this.add.circle(cx, cy, 4 + Math.random() * 5, 0x5a5a5a, 0.25);
          rock.setDepth(1);
        }
      }
    }

    // Terrain variety: darker patches, rocky areas, grassy clearings
    for (let x = 0; x < WORLD_WIDTH; x += 300) {
      const variant = Math.random();
      if (variant < 0.3) {
        // Darker mossy patch
        const px = x + Math.random() * 150;
        const py = 100 + Math.random() * 520;
        const moss = this.add.circle(px, py, 40 + Math.random() * 30, 0x1a2a18, 0.2);
        moss.setDepth(0);
      } else if (variant < 0.5) {
        // Rocky area
        const px = x + Math.random() * 150;
        const py = 100 + Math.random() * 520;
        for (let r = 0; r < 3; r++) {
          const rock = this.add.circle(px + Math.random() * 40 - 20, py + Math.random() * 20 - 10, 3 + Math.random() * 6, 0x5a5a5a, 0.3);
          rock.setDepth(0);
        }
      } else if (variant < 0.6) {
        // Grassy clearing (slightly brighter)
        const px = x + Math.random() * 150;
        const patch = this.add.circle(px, 360 + (Math.random() - 0.5) * 300, 80 + Math.random() * 40, 0x3a4a30, 0.15);
        patch.setDepth(0);
      }
    }

    // Roadside debris: broken shields, bones, cart wheels
    for (let x = 0; x < WORLD_WIDTH; x += 150) {
      if (Math.random() > 0.6) continue;
      const dx = x + Math.random() * 80;
      const side = Math.random() > 0.5 ? 1 : -1;
      const dy = side > 0 ? 300 + Math.random() * 8 : 420 + Math.random() * 8;
      const debrisType = Math.random();
      if (debrisType < 0.3) {
        // Small bone fragment
        const bone = this.add.rectangle(dx, dy, 8 + Math.random() * 6, 2, 0xc8c0b0, 0.25);
        bone.setDepth(1);
      } else if (debrisType < 0.6) {
        // Shield fragment (triangle)
        const shield = this.add.triangle(dx, dy, -5, 5, 5, 5, 0, -7, 0x6a4a3a, 0.2);
        shield.setDepth(1);
      } else {
        // Stone rubble
        const rubble = this.add.circle(dx, dy, 4 + Math.random() * 4, 0x7a7568, 0.2);
        rubble.setDepth(1);
      }
    }
  }

  private createRoadsideRuin(x: number, y: number): void {
    const ruinType = Math.floor(Math.random() * 3);
    const g = this.add.graphics();
    g.setDepth(1);

    if (ruinType === 0) {
      // Broken wall section
      const w = 20 + Math.random() * 30;
      const h = 30 + Math.random() * 40;
      g.fillStyle(0x9a9588, 0.35);
      g.fillRect(x - w / 2, y - h, w, h);
      g.fillStyle(0x7a7568, 0.2);
      // Cracks
      g.fillRect(x - w / 4, y - h * 0.6, 2, h * 0.4);
      // Top jagged edge
      for (let cx = x - w / 2; cx < x + w / 2; cx += 8) {
        const ch = Math.random() * 8;
        g.fillStyle(0x9a9588, 0.3);
        g.fillRect(cx, y - h - ch, 6, ch);
      }
    } else if (ruinType === 1) {
      // Collapsed pillar
      g.fillStyle(0x8a8578, 0.3);
      g.fillRect(x - 4, y - 50, 8, 50);
      g.fillRect(x - 12, y - 52, 24, 6);
      // Fallen top piece
      g.fillStyle(0x8a8578, 0.2);
      g.fillRect(x + 6, y - 2, 20, 4);
    } else {
      // Abandoned camp (fire pit)
      g.fillStyle(0x3a3020, 0.5);
      g.fillCircle(x, y, 8);
      // Ash ring
      g.lineStyle(1, 0x6a6058, 0.25);
      g.strokeCircle(x, y, 10);
      // Charred log
      g.fillStyle(0x1a1510, 0.4);
      g.fillRect(x - 12, y - 2, 24, 4);
    }
    g.destroy();
  }

  private createVignette(): void {
    // 全屏统一微暗（简单可靠，不遮挡视线）
    const vignette = this.add.graphics();
    vignette.setDepth(OVERLAY_DEPTH - 5);
    vignette.setScrollFactor(0);
    vignette.fillStyle(0x000000, 0.10);
    vignette.fillRect(0, 0, 1280, 720);
  }

  // ═══════════════════════════════════════════════════
  // PLAYER (英雄)
  // ═══════════════════════════════════════════════════

  private createPlayerContainer(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(15);
    container.setScale(1.0);

    // 阴影
    container.add(this.add.ellipse(0, 14, 18, 6, 0x000000, 0.4));
    // 斗篷（棕色披风，更亮）
    container.add(this.add.triangle(0, 6, -8, -4, 8, -4, 0, 16, 0x7a5a47, 0.9));
    // 身体
    const body = this.add.circle(0, 0, 8, 0x8d6c61);
    body.setStrokeStyle(1.5, 0x5e3723, 0.8);
    container.add(body);
    // 兜帽
    const hood = this.add.triangle(0, -6, -7, 0, 7, 0, 0, -12, 0x6e544e);
    hood.setStrokeStyle(1, 0x5e3723, 0.6);
    container.add(hood);
    // 兜帽阴影（脸部）
    container.add(this.add.circle(0, -2, 4, 0x4a3a2a));
    // 眼睛（明亮微光）
    container.add(this.add.circle(2, -2, 1.2, 0xffdd99, 1));
    container.add(this.add.circle(-2, -2, 1.2, 0xffdd99, 1));
    // 火炬（右手，更亮）
    const torchGroup = this.add.container(0, 0);
    torchGroup.add(this.add.rectangle(10, -2, 2, 16, 0x6d5047));
    torchGroup.add(this.add.circle(10, -11, 3, 0xff8833, 1));
    const torchGlow = this.add.circle(10, -11, 14, 0xff9944, 0.12);
    torchGroup.add(torchGlow);
    this.torchGlow = torchGlow;
    container.add(torchGroup);
    this.playerSword = torchGroup;

    return container;
  }

  // ═══════════════════════════════════════════════════
  // HERO ATTACK
  // ═══════════════════════════════════════════════════

  private updateHeroAttack(deltaSeconds: number): void {
    const xInput =
      (this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) -
      (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0);
    const yInput =
      (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0) -
      (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0);

    const { damagedIds, swingAngle } = updateHeroAttack(
      this.heroAttack,
      deltaSeconds,
      this.playerPosition,
      xInput,
      yInput,
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE),
      this.enemies.map((e) => ({ id: e.id, type: e.type, position: e.position, health: e.health })),
    );

    // 显示挥剑动画
    if (swingAngle >= 0) {
      this.showSwordSlash(swingAngle);
      // 造成伤害
      for (const enemy of this.enemies) {
        if (damagedIds.includes(enemy.id)) {
          const damage = Math.round(HERO_ATTACK_DAMAGE * this.stats.weaponDamageMultiplier);
          enemy.health = Math.max(0, enemy.health - damage);
          this.showDamageNumber(enemy.position.x, enemy.position.y - enemy.radius - 10, damage);
          enemy.hitFlashTimer = 0.1;
          this.screenShake();
          if (enemy.health <= 0) {
            this.removeEnemy(enemy);
          }
        }
      }
    }

    // 更新剑的视觉
    if (this.playerSword) {
      if (this.heroAttack.attackAnimTimer > 0) {
        this.playerSword.setVisible(true);
        this.playerSword.setRotation(this.heroAttack.attackAngle);
        this.playerSword.setAlpha(this.heroAttack.attackAnimTimer / 0.25);
      } else {
        this.playerSword.setVisible(false);
      }
    }
  }

  private updateTorch(deltaSeconds: number): void {
    if (!this.torchGlow) return;
    const pulse = 0.08 + Math.sin(this.elapsedSeconds * 4) * 0.06;
    this.torchGlow.setAlpha(pulse);
    // 火炬火焰也微微跳动
    if (this.playerSword && this.playerSword.list.length > 1) {
      const flame = this.playerSword.list[1] as Phaser.GameObjects.Arc;
      if (flame && flame.setScale) {
        const flicker = 1 + Math.sin(this.elapsedSeconds * 6 + 1) * 0.15;
        flame.setScale(flicker);
      }
    }
  }

  private showSwordSlash(angle: number): void {
    const slash = this.add.arc(
      this.playerPosition.x,
      this.playerPosition.y,
      HERO_ATTACK_RANGE,
      angle - 0.6,
      angle + 0.6,
      false,
      0xffffff,
      0.4,
    );
    slash.setDepth(14);
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.3,
      duration: 200,
      onComplete: () => slash.destroy(),
    });
  }

  private showDamageNumber(x: number, y: number, damage: number): void {
    const colorHex = damage >= 15 ? '#ef4444' : '#fbbf24';
    const t = this.add.text(x + (Math.random() - 0.5) * 20, y, `-${damage}`, {
      color: colorHex,
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
    });
    t.setOrigin(0.5);
    t.setDepth(20);
    this.floatingTexts.push({ text: t, timer: 0.8 });
  }

  private showFloatingResource(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x + (Math.random() - 0.5) * 16, y, text, {
      color,
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
    });
    t.setOrigin(0.5);
    t.setDepth(20);
    this.floatingTexts.push({ text: t, timer: 1.2 });
  }

  // ═══════════════════════════════════════════════════
  // CARAVAN (中世纪城堡)
  // ═══════════════════════════════════════════════════

  private createCaravan(center: Point): Phaser.GameObjects.Container {
    const container = this.add.container(center.x, center.y);
    container.setDepth(8);

    // 城堡阴影
    container.add(this.add.ellipse(2, 56, 120, 18, 0x000000, 0.4));

    // 石墙基座
    const stoneColor = 0x9a9588;
    const stoneDark = 0x7a7568;
    container.add(this.add.rectangle(0, 0, 96, 80, stoneColor));
    container.add(this.add.rectangle(0, 0, 96, 80, stoneColor, 0).setStrokeStyle(2, stoneDark, 0.8));

    // 石砖纹理
    for (let row = -3; row <= 3; row++) {
      for (let col = -4; col <= 4; col++) {
        if (Math.random() > 0.3) {
          const bx = col * 10 + (row % 2 === 0 ? 5 : 0);
          const by = row * 10;
          const brick = this.add.rectangle(bx, by, 8, 7, stoneDark, 0.3);
          brick.setStrokeStyle(0.5, 0x5a5548, 0.2);
          container.add(brick);
        }
      }
    }

    // 四角塔楼
    const towerPositions = [[-40, -32], [40, -32], [-40, 32], [40, 32]];
    for (const [tx, ty] of towerPositions) {
      // 塔身
      container.add(this.add.rectangle(tx as number, ty as number, 18, 18, 0xaa9a88));
      container.add(this.add.rectangle(tx as number, ty as number, 18, 18, 0xaa9a88, 0).setStrokeStyle(1.5, 0x7a6558, 0.6));
      // 塔顶（红色锥形）
      container.add(this.add.triangle(tx as number, (ty as number) - 14, -10, 0, 10, 0, 0, -16, 0x9b3510));
      container.add(this.add.triangle(tx as number, (ty as number) - 14, -10, 0, 10, 0, 0, -16, 0x9b3510, 0).setStrokeStyle(1, 0x5a1500, 0.5));
    }

    // 中央主楼屋顶（尖顶）
    container.add(this.add.triangle(0, -42, -44, 0, 44, 0, 0, -24, 0x9b3510));
    container.add(this.add.triangle(0, -42, -44, 0, 44, 0, 0, -24, 0x9b3510, 0).setStrokeStyle(1.5, 0x6a1500, 0.6));

    // 屋顶瓦片纹理
    for (let i = 0; i < 5; i++) {
      const ry = -42 + i * 4;
      const rw = 40 - i * 6;
      container.add(this.add.rectangle(0, ry, rw, 2, 0x6b1500, 0.3));
    }

    // 窗户（暖光）
    const windowColor = 0xffa726;
    container.add(this.add.rectangle(-20, -8, 10, 12, windowColor, 0.7));
    container.add(this.add.rectangle(20, -8, 10, 12, windowColor, 0.7));
    container.add(this.add.rectangle(-20, 16, 10, 12, windowColor, 0.7));
    container.add(this.add.rectangle(20, 16, 10, 12, windowColor, 0.7));
    // 窗框
    for (const [wx, wy] of [[-20, -8], [20, -8], [-20, 16], [20, 16]]) {
      container.add(this.add.rectangle(wx as number, wy as number, 10, 12, 0x5a5548, 0).setStrokeStyle(1.5, 0x3a3528, 0.7));
    }

    // 城门
    container.add(this.add.rectangle(0, 32, 16, 20, 0x4a3520));
    container.add(this.add.rectangle(0, 32, 16, 20, 0x4a3520, 0).setStrokeStyle(1.5, 0x3a2510, 0.7));
    // 门拱
    container.add(this.add.arc(0, 22, 8, Math.PI, 0, false, 0x4a3520));

    // 火炬（暖光点）
    const torchPositions = [[-36, -20], [36, -20], [-36, 20], [36, 20]];
    for (const [tx, ty] of torchPositions) {
      // 火炬底座
      container.add(this.add.rectangle(tx as number, ty as number, 3, 8, 0x5d4037));
      // 火焰
      const flame = this.add.circle(tx as number, (ty as number) - 6, 3, 0xff6f00, 0.9);
      container.add(flame);
      // 火光晕
      const glow = this.add.circle(tx as number, (ty as number) - 6, 8, 0xff8f00, 0.15);
      container.add(glow);
    }

    return container;
  }

  // ═══════════════════════════════════════════════════
  // CARAVAN HEALTH BAR
  // ═══════════════════════════════════════════════════

  private createCaravanHealthBar(center: Point): void {
    const barWidth = 80;
    const barY = center.y - 72;
    this.caravanHealthBarBg = this.add.rectangle(center.x, barY, barWidth + 4, 6, 0x1a1510);
    this.caravanHealthBarBg.setDepth(9);
    this.caravanHealthBarBg.setStrokeStyle(1, 0x3a3528, 0.6);
    this.caravanHealthBar = this.add.rectangle(center.x - barWidth / 2 + 2, barY, barWidth, 4, 0x4caf50);
    this.caravanHealthBar.setOrigin(0, 0.5);
    this.caravanHealthBar.setDepth(10);
    this.caravanHealthText = this.add.text(center.x, barY, `${Math.ceil(this.stats.caravanHealth)}`, {
      color: '#e0d8c8',
      fontFamily: 'monospace',
      fontSize: '9px',
    });
    this.caravanHealthText.setOrigin(0.5);
    this.caravanHealthText.setDepth(11);
  }

  private updateCaravanHealthBar(center: Point): void {
    const barWidth = 80;
    const ratio = this.stats.caravanHealth / this.stats.caravanMaxHealth;
    const fillWidth = barWidth * Math.max(0, ratio);
    this.caravanHealthBar.setSize(Math.max(0, fillWidth), 4);
    this.caravanHealthBar.setFillStyle(ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xfdd835 : 0xef4444);
    this.caravanHealthText.setText(`${Math.ceil(this.stats.caravanHealth)}/${this.stats.caravanMaxHealth}`);
    this.caravanHealthBarBg.setPosition(center.x, center.y - 72);
    this.caravanHealthBar.setPosition(center.x - 38, center.y - 72);
    this.caravanHealthText.setPosition(center.x, center.y - 72);
  }

  // ═══════════════════════════════════════════════════
  // RESOURCE NODES
  // ═══════════════════════════════════════════════════

  private createInitialWoodNodes(): void {
    const nodes = [
      { x: 200, y: 200, amount: 24 },
      { x: 400, y: 500, amount: 18 },
      { x: 600, y: 180, amount: 30 },
      { x: 800, y: 530, amount: 20 },
      { x: 1050, y: 250, amount: 26 },
    ];
    for (const node of nodes) this.createWoodNodeVisual(node.x, node.y, node.amount);
    this.resourceSpawner.lastSpawnX = 1050;
  }

  private createInitialStoneNodes(): void {
    const nodes = [
      { x: 300, y: 480, amount: 20 },
      { x: 550, y: 220, amount: 15 },
      { x: 900, y: 510, amount: 25 },
    ];
    for (const node of nodes) this.createStoneNodeVisual(node.x, node.y, node.amount);
  }

  private createWoodNodeVisual(x: number, y: number, amount: number): RenderedNode {
    const container = this.add.container(x, y);
    container.setDepth(3);

    // 枯树干（相对坐标）
    const trunk = this.add.rectangle(0, 8, 5, 28, 0x5a4030);
    trunk.setDepth(0);
    // 枯树冠（暗色剪影，融入环境但可见）
    const canopy1 = this.add.circle(0, -10, 14, 0x2a4a28, 0.7);
    canopy1.setDepth(1);
    const canopy2 = this.add.circle(-5, -16, 10, 0x3a5a30, 0.6);
    canopy2.setDepth(1);
    const canopy3 = this.add.circle(5, -16, 10, 0x3a5a30, 0.6);
    canopy3.setDepth(1);
    // 枯树枝
    container.add(this.add.rectangle(-10, -6, 12, 2, 0x4a3520, 0.5));
    container.add(this.add.rectangle(8, -2, 10, 2, 0x4a3520, 0.5));

    container.add([trunk, canopy1, canopy2, canopy3]);

    const label = this.add.text(0, -30, `${amount}`, {
      color: '#a08060',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    label.setDepth(6);

    const node: ResourceNode = { id: `wood-${this.resourceSpawner.nextId++}`, position: { x, y }, remaining: amount, maxAmount: amount, type: 'wood', radius: 18, color: 0x4caf50 };
    this.resourceSpawner.woodNodes.push(node);
    const rendered: RenderedNode = { node, container, canopy: canopy1, label, gatherTimer: 0 };
    this.woodRenderedNodes.push(rendered);
    return rendered;
  }

  private createStoneNodeVisual(x: number, y: number, amount: number): StoneRenderedNode {
    const container = this.add.container(x, y);
    container.setDepth(3);

    // 暗色岩石（相对坐标）
    const s1 = this.add.rectangle(-4, 3, 18, 14, 0x6a6a6a);
    const s2 = this.add.rectangle(6, -2, 16, 16, 0x7a7a7a);
    const s3 = this.add.rectangle(1, -10, 12, 12, 0x8a8a8a);
    s1.setStrokeStyle(1.5, 0x5a5a5a, 0.7);
    s2.setStrokeStyle(1.5, 0x6a6a6a, 0.7);
    s3.setStrokeStyle(1.5, 0x7a7a7a, 0.7);
    container.add([s1, s2, s3]);

    const label = this.add.text(0, -28, `${amount}`, {
      color: '#b0a898',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    label.setDepth(6);

    const node: ResourceNode = { id: `stone-${this.resourceSpawner.nextId++}`, position: { x, y }, remaining: amount, maxAmount: amount, type: 'stone', radius: 14, color: 0x78909c };
    this.resourceSpawner.stoneNodes.push(node);
    const rendered: StoneRenderedNode = { node, shape: container, label, gatherTimer: 0 };
    this.stoneRenderedNodes.push(rendered);
    return rendered;
  }

  private updateResourceSpawning(deltaSeconds: number): void {
    const camera = this.cameras.main;
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    const { spawned } = updateResourceSpawner(this.resourceSpawner, caravanCenter.x, camera.worldView.right, camera.worldView.left, 720, Math.random);

    for (const node of spawned) {
      if (node.type === 'wood') this.createWoodNodeVisual(node.position.x, node.position.y, node.remaining);
      else this.createStoneNodeVisual(node.position.x, node.position.y, node.remaining);
    }

    this.removeDepletedWoodNodes();
    this.removeDepletedStoneNodes();
  }

  private removeDepletedWoodNodes(): void {
    for (const d of collectDepletedNodes(this.resourceSpawner.woodNodes)) {
      const idx = this.woodRenderedNodes.findIndex((r) => r.node.id === d.id);
      if (idx >= 0) {
        const r = this.woodRenderedNodes[idx];
        r.container.destroy();
        this.woodRenderedNodes.splice(idx, 1);
      }
    }
  }

  private removeDepletedStoneNodes(): void {
    for (const d of collectDepletedNodes(this.resourceSpawner.stoneNodes)) {
      const idx = this.stoneRenderedNodes.findIndex((r) => r.node.id === d.id);
      if (idx >= 0) {
        const r = this.stoneRenderedNodes[idx];
        r.shape.destroy(); r.label.destroy();
        this.stoneRenderedNodes.splice(idx, 1);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // GATHERING
  // ═══════════════════════════════════════════════════

  private updateGathering(deltaSeconds: number): void {
    let gatheredThisFrame = false;

    for (const rendered of [...this.woodRenderedNodes]) {
      const { node } = rendered;
      if (node.remaining <= 0) continue;
      if (distanceSquared(this.playerPosition, node.position) > GATHER_RANGE * GATHER_RANGE) {
        rendered.gatherTimer = 0;
        rendered.container.setScale(1);
        rendered.container.setAlpha(1);
        continue;
      }
      rendered.gatherTimer += deltaSeconds;
      if (rendered.gatherTimer >= 0.5) {
        const result = harvestNode(node, this.stats.gatherRate * deltaSeconds, 1);
        node.remaining = result.node.remaining;
        this.carried = addCarriedResource(this.carried, result.gathered.type, result.gathered.amount);
        this.totalWoodGathered += result.gathered.amount;
        if (result.gathered.amount > 0) {
          gatheredThisFrame = true;
          const label = result.gathered.type === 'wood' ? '木' : result.gathered.type === 'stone' ? '石' : '金';
          this.showFloatingResource(node.position.x, node.position.y - 20, `+${Math.floor(result.gathered.amount)}${label}`, '#c0d8a0');
        }
        rendered.gatherTimer = 0;
      }
      rendered.label.setText(`${Math.ceil(Math.max(0, node.remaining))}`);
      // 采集时脉动效果
      const pulse = 1 + Math.sin(rendered.gatherTimer * 10) * 0.12;
      rendered.container.setScale(pulse);
      rendered.container.setAlpha(0.85 + Math.sin(rendered.gatherTimer * 10) * 0.15);
    }

    for (const rendered of [...this.stoneRenderedNodes]) {
      const { node } = rendered;
      if (node.remaining <= 0) continue;
      if (distanceSquared(this.playerPosition, node.position) > GATHER_RANGE * GATHER_RANGE) {
        rendered.gatherTimer = 0;
        rendered.shape.setAlpha(1);
        continue;
      }
      rendered.gatherTimer += deltaSeconds;
      if (rendered.gatherTimer >= 0.5) {
        const result = harvestNode(node, this.stats.gatherRate * deltaSeconds, 1);
        node.remaining = result.node.remaining;
        this.carried = addCarriedResource(this.carried, result.gathered.type, result.gathered.amount);
        this.totalStoneGathered += result.gathered.amount;
        if (result.gathered.amount > 0) {
          gatheredThisFrame = true;
          this.showFloatingResource(node.position.x, node.position.y - 20, `+${Math.floor(result.gathered.amount)}石`, '#b0a898');
        }
        rendered.gatherTimer = 0;
      }
      rendered.label.setText(`${Math.ceil(Math.max(0, node.remaining))}`);
      rendered.shape.setAlpha(0.8 + Math.sin(rendered.gatherTimer * 10) * 0.2);
    }

    if (gatheredThisFrame && this.feedbackTimer <= 0) {
      this.showFeedback(`采集中 +${this.formatNumber(this.stats.gatherRate)}/秒`, '#c0d8a0');
    }
  }

  // ═══════════════════════════════════════════════════
  // SPAWNING & WAVE BANNER
  // ═══════════════════════════════════════════════════

  private updateSpawning(deltaSeconds: number): void {
    const result = updateWaveState(this.waveState, deltaSeconds);
    this.waveState = result.state;

    if (result.startedWave && this.waveState.currentWave !== this.lastWaveAnnounced) {
      this.lastWaveAnnounced = this.waveState.currentWave;
      this.showWaveBanner(this.waveState.currentWave);
    }

    const spawnBatchStart = this.enemySequence;
    result.spawnedEnemies.forEach((type, index) => this.spawnEnemy(type, index, spawnBatchStart));
  }

  private showWaveBanner(wave: number): void {
    if (this.waveBanner) this.waveBanner.destroy();
    const isBossWave = wave >= 8 && wave % 4 === 0;
    const text = isBossWave ? `⚠ 首领来袭 — 第 ${wave} 波` : `第 ${wave} 波`;
    const fontSize = isBossWave ? '40px' : '48px';
    const color = isBossWave ? '#ff1744' : '#c62828';
    this.waveBanner = this.add.text(640, 280, text, {
      color,
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize,
      fontStyle: 'bold',
    });
    this.waveBanner.setOrigin(0.5);
    this.waveBanner.setScrollFactor(0);
    this.waveBanner.setDepth(OVERLAY_DEPTH + 10);
    this.waveBanner.setAlpha(0);
    this.waveBanner.setScale(isBossWave ? 1.8 : 2);
    this.tweens.add({
      targets: this.waveBanner,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Boss wave: add red screen flash
    if (isBossWave) {
      const flash = this.add.graphics();
      flash.setScrollFactor(0);
      flash.setDepth(OVERLAY_DEPTH + 8);
      flash.fillStyle(0xff0000, 0.15);
      flash.fillRect(0, 0, 1280, 720);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 800,
        onComplete: () => flash.destroy(),
      });
    }

    this.waveBannerTimer = isBossWave ? 3 : 2;
  }

  private updateWaveBanner(deltaSeconds: number): void {
    if (!this.waveBanner) return;
    this.waveBannerTimer -= deltaSeconds;
    if (this.waveBannerTimer <= 0) {
      this.tweens.add({
        targets: this.waveBanner,
        alpha: 0,
        y: 200,
        duration: 400,
        onComplete: () => {
          this.waveBanner?.destroy();
          this.waveBanner = undefined;
        },
      });
      this.waveBannerTimer = -999;
    }
  }

  // ═══════════════════════════════════════════════════
  // ENEMIES
  // ═══════════════════════════════════════════════════

  private createEnemyVisual(type: EnemyTypeId, x: number, y: number, def: any): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(12);

    // Shadow
    container.add(this.add.ellipse(0, def.radius + 2, def.radius * 2, 5, 0x000000, 0.3));

    switch (type) {
      case 'grunt': {
        // 小型暗黑生物
        const body = this.add.circle(0, 0, def.radius, 0x4e2a2a);
        body.setStrokeStyle(1.5, 0x3a0a0a, 0.8);
        container.add(body);
        // 红色发光眼睛
        container.add(this.add.circle(-3, -2, 2, 0xff1744, 0.9));
        container.add(this.add.circle(3, -2, 2, 0xff1744, 0.9));
        container.add(this.add.circle(-3, -2, 1, 0xff8a80, 0.6));
        container.add(this.add.circle(3, -2, 1, 0xff8a80, 0.6));
        break;
      }
      case 'runner': {
        // 瘦长快速生物
        const body = this.add.ellipse(0, 0, def.radius * 1.2, def.radius * 2, 0x3a2530);
        body.setStrokeStyle(1.5, 0x2a0510, 0.8);
        container.add(body);
        container.add(this.add.circle(-2, -4, 1.8, 0xff1744, 0.9));
        container.add(this.add.circle(2, -4, 1.8, 0xff1744, 0.9));
        break;
      }
      case 'brute': {
        // 大型重装怪物
        const body = this.add.circle(0, 0, def.radius, 0x4a1a1a);
        body.setStrokeStyle(2.5, 0x2a0000, 0.8);
        container.add(body);
        container.add(this.add.circle(0, 0, def.radius - 3, 0x4e2a2a));
        // 重甲纹路
        container.add(this.add.circle(0, -4, 4, 0x4a2a2a, 0.4));
        // 大红色眼睛
        container.add(this.add.circle(-5, -4, 3, 0xff1744, 0.9));
        container.add(this.add.circle(5, -4, 3, 0xff1744, 0.9));
        container.add(this.add.circle(-5, -4, 1.5, 0xff8a80, 0.5));
        container.add(this.add.circle(5, -4, 1.5, 0xff8a80, 0.5));
        // 獠牙
        container.add(this.add.triangle(-4, def.radius - 1, -2, 0, 2, 0, 0, 5, 0x4a3a3a));
        container.add(this.add.triangle(4, def.radius - 1, -2, 0, 2, 0, 0, 5, 0x4a3a3a));
        break;
      }
      case 'thrower': {
        // 远程投掷怪
        const body = this.add.circle(0, 0, def.radius, 0x3a2a20);
        body.setStrokeStyle(1.5, 0x2a0a05, 0.8);
        container.add(body);
        // 举起的投掷物
        container.add(this.add.circle(def.radius + 3, -def.radius + 2, 4, 0x8d6e63));
        container.add(this.add.circle(-3, -3, 1.8, 0xff1744, 0.9));
        container.add(this.add.circle(3, -3, 1.8, 0xff1744, 0.9));
        break;
      }
      case 'burst': {
        // 自爆小怪
        const body = this.add.circle(0, 0, def.radius, 0x4a3a20);
        body.setStrokeStyle(1.5, 0x3a2a05, 0.8);
        container.add(body);
        // 发光脉冲
        container.add(this.add.circle(0, 0, def.radius + 3, 0xffd600, 0).setStrokeStyle(1.5, 0xffd600, 0.4));
        container.add(this.add.circle(-1.5, -1.5, 1.5, 0xff1744, 0.9));
        container.add(this.add.circle(1.5, -1.5, 1.5, 0xff1744, 0.9));
        break;
      }
      case 'boss': {
        // Boss - 巨型怪物
        const body = this.add.circle(0, 0, def.radius, 0x2a1a30);
        body.setStrokeStyle(3, 0x1a0010, 0.8);
        container.add(body);
        container.add(this.add.circle(0, 0, def.radius - 5, 0x3a2540));
        // 王冠/头饰
        const crown = this.add.triangle(0, -def.radius + 2, -12, 4, 12, 4, 0, -14, 0xffd600, 0.7);
        container.add(crown);
        // 大红色眼睛
        container.add(this.add.circle(-8, -5, 5, 0xff1744, 0.9));
        container.add(this.add.circle(8, -5, 5, 0xff1744, 0.9));
        container.add(this.add.circle(-8, -5, 2.5, 0xff8a80, 0.5));
        container.add(this.add.circle(8, -5, 2.5, 0xff8a80, 0.5));
        // 獠牙
        container.add(this.add.triangle(-6, def.radius - 2, -2.5, 0, 2.5, 0, 0, 8, 0x4a3a3a));
        container.add(this.add.triangle(6, def.radius - 2, -2.5, 0, 2.5, 0, 0, 8, 0x4a3a3a));
        break;
      }
    }

    return container;
  }

  private spawnEnemy(type: EnemyTypeId = 'grunt', waveIndex = 0, spawnBatchStart = this.enemySequence): void {
    const definition = getEnemyDefinition(type);
    if (!definition) return;

    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    const placementIndex = spawnBatchStart + waveIndex;
    const sideOffset = (placementIndex % 3) - 1;
    const depthOffset = Math.floor(waveIndex / 3) * 72;
    const forwardSpawnX = Math.min(
      this.cameras.main.worldView.right + SPAWN_MARGIN + (placementIndex % 2) * 160 + depthOffset,
      WORLD_WIDTH - SPAWN_MARGIN,
    );
    const position = {
      x: forwardSpawnX,
      y: Phaser.Math.Clamp(caravanCenter.y + sideOffset * 210, 60, 660),
    };

    const body = this.createEnemyVisual(type, position.x, position.y, definition);
    const label = this.add.text(position.x, position.y - definition.radius - 18, definition.label, {
      color: '#c0b090',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '10px',
    });
    label.setOrigin(0.5);
    label.setDepth(14);

    const barWidth = definition.radius * 2 + 4;
    const healthBarY = position.y - definition.radius - 8;
    const healthBarBg = this.add.rectangle(position.x, healthBarY, barWidth, 4, 0x1f2937);
    healthBarBg.setDepth(13);
    const healthBar = this.add.rectangle(position.x - barWidth / 2 + 2, healthBarY, barWidth - 4, 3, 0x4caf50);
    healthBar.setOrigin(0, 0.5);
    healthBar.setDepth(14);

    this.enemies.push({
      id: `enemy-${this.enemySequence++}`,
      type, position, radius: definition.radius,
      health: definition.health, maxHealth: definition.health,
      speed: definition.speed, contactDamage: definition.contactDamage,
      experienceReward: definition.experienceReward, damageTimer: 0,
      body, label, healthBar, healthBarBg,
      hitFlashTimer: 0,
      minionSpawnTimer: definition.minionSpawnInterval ? 0 : undefined,
      rangedAttackTimer: definition.rangedAttackCooldown ? 0 : undefined,
      wallAttackTimer: 0,
    });
  }

  private spawnEnemyNear(type: EnemyTypeId, nearPosition: Point, offset: number): void {
    const definition = getEnemyDefinition(type);
    if (!definition) return;

    const position = {
      x: Phaser.Math.Clamp(nearPosition.x + offset, 50, WORLD_WIDTH - 50),
      y: Phaser.Math.Clamp(nearPosition.y + (offset % 2 === 0 ? 30 : -30), 60, 660),
    };

    const body = this.createEnemyVisual(type, position.x, position.y, definition);
    const label = this.add.text(position.x, position.y - definition.radius - 18, definition.label, {
      color: '#c0b090', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '10px',
    });
    label.setOrigin(0.5); label.setDepth(14);

    const barWidth = definition.radius * 2 + 4;
    const healthBarY = position.y - definition.radius - 8;
    const healthBarBg = this.add.rectangle(position.x, healthBarY, barWidth, 4, 0x1f2937);
    healthBarBg.setDepth(13);
    const healthBar = this.add.rectangle(position.x - barWidth / 2 + 2, healthBarY, barWidth - 4, 3, 0x4caf50);
    healthBar.setOrigin(0, 0.5); healthBar.setDepth(14);

    this.enemies.push({
      id: `enemy-${this.enemySequence++}`, type, position, radius: definition.radius,
      health: definition.health, maxHealth: definition.health,
      speed: definition.speed, contactDamage: definition.contactDamage,
      experienceReward: definition.experienceReward, damageTimer: 0,
      body, label, healthBar, healthBarBg, hitFlashTimer: 0,
      minionSpawnTimer: definition.minionSpawnInterval ? 0 : undefined,
      rangedAttackTimer: definition.rangedAttackCooldown ? 0 : undefined,
      wallAttackTimer: 0,
    });
  }

  private updateEnemyHealthBar(enemy: Enemy): void {
    const ratio = enemy.health / enemy.maxHealth;
    const barWidth = (enemy.radius * 2) * Math.max(0, ratio);
    enemy.healthBar.setSize(Math.max(0, barWidth), 3);
    enemy.healthBar.setFillStyle(ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xfdd835 : 0xef4444);
  }

  private updateWallVisual(wall: Wall): void {
    const ratio = getWallHealthRatio(wall);
    wall.healthBar.setSize(24 * ratio, 4);
    wall.healthBar.setFillStyle(ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xfdd835 : 0xef4444);
    wall.healthText.setText(`${Math.ceil(wall.health)}`);
  }

  private updateEnemies(deltaSeconds: number): void {
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);

    for (const enemy of this.enemies) {
      enemy.damageTimer = Math.max(0, enemy.damageTimer - deltaSeconds);
      enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - deltaSeconds);

      // Hit flash
      enemy.body.setAlpha(enemy.hitFlashTimer > 0 ? 0.5 + Math.sin(enemy.hitFlashTimer * 60) * 0.5 : 1);

      enemy.body.setPosition(enemy.position.x, enemy.position.y);
      enemy.label.setPosition(enemy.position.x, enemy.position.y - enemy.radius - 18);

      // Health bar follow
      const healthBarY = enemy.position.y - enemy.radius - 8;
      const barWidth = enemy.radius * 2 + 4;
      enemy.healthBarBg.setPosition(enemy.position.x, healthBarY);
      enemy.healthBar.setPosition(enemy.position.x - barWidth / 2 + 2, healthBarY);
      this.updateEnemyHealthBar(enemy);

      // Boss minions
      if (enemy.type === 'boss' && enemy.minionSpawnTimer !== undefined) {
        const def = getEnemyDefinition('boss');
        enemy.minionSpawnTimer += deltaSeconds;
        if (def && enemy.minionSpawnTimer >= def.minionSpawnInterval!) {
          enemy.minionSpawnTimer = 0;
          for (let i = 0; i < (def.minionCount ?? 2); i++) {
            this.spawnEnemyNear(def.minionType ?? 'grunt', enemy.position, i * 40);
          }
        }
      }

      // Thrower ranged
      if (enemy.type === 'thrower') {
        const def = getEnemyDefinition('thrower');
        if (def && def.preferredDistance) {
          const distToCaravan = Math.sqrt(distanceSquared(enemy.position, caravanCenter));
          if (distToCaravan <= def.preferredDistance + 20) {
            enemy.rangedAttackTimer = (enemy.rangedAttackTimer ?? 0) + deltaSeconds;
            if (enemy.rangedAttackTimer >= (def.rangedAttackCooldown ?? 1.5)) {
              enemy.rangedAttackTimer = 0;
              const dmg = def.rangedAttackDamage ?? 5;
              this.stats.caravanHealth = Math.max(0, this.stats.caravanHealth - dmg);
              this.caravanDamageFlashTimer = DAMAGE_FLASH_DURATION;
              this.drawProjectileToTarget(enemy.position, caravanCenter, 0xff6f00, 150);
            }
            continue;
          }
        }
      }

      // Wall block
      let blockedByWall: Wall | undefined;
      let minWallDist = Number.POSITIVE_INFINITY;
      for (const wall of this.walls) {
        const wallDist = distanceSquared(enemy.position, wall.position);
        const blockThreshold = (enemy.radius + WALL_BLOCK_RANGE) * (enemy.radius + WALL_BLOCK_RANGE);
        if (wallDist <= blockThreshold && wallDist < minWallDist) {
          blockedByWall = wall; minWallDist = wallDist;
        }
      }

      if (blockedByWall) {
        enemy.blockedByWallId = blockedByWall.id;
        enemy.wallAttackTimer = (enemy.wallAttackTimer ?? 0) + deltaSeconds;
        if (enemy.wallAttackTimer >= WALL_ATTACK_COOLDOWN) {
          enemy.wallAttackTimer = 0;
          blockedByWall.health = Math.max(0, blockedByWall.health - WALL_DAMAGE_PER_HIT);
          this.updateWallVisual(blockedByWall);
          if (isWallDestroyed(blockedByWall)) {
            blockedByWall.shape.destroy();
            blockedByWall.healthBar.destroy();
            blockedByWall.healthText.destroy();
            blockedByWall.label.destroy();
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

      // Attack caravan
      if (distanceSquared(enemy.position, caravanCenter) <= ENEMY_CONTACT_RANGE * ENEMY_CONTACT_RANGE && enemy.damageTimer <= 0) {
        this.stats.caravanHealth = Math.max(0, this.stats.caravanHealth - enemy.contactDamage);
        enemy.damageTimer = ENEMY_DAMAGE_COOLDOWN;
        this.caravanDamageFlashTimer = DAMAGE_FLASH_DURATION;
        this.screenShake();
        this.showDamageNumber(caravanCenter.x, caravanCenter.y - 50, enemy.contactDamage);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // TOWERS
  // ═══════════════════════════════════════════════════


  private buildArrowTower(slot: BuildSlot, center: Point): void {
    const rangeShape = this.add.circle(center.x, center.y, this.stats.towerRange, 0x000000, 0);
    rangeShape.setStrokeStyle(1, 0x6a5a48, 0.25);
    rangeShape.setDepth(5);

    const base = this.add.container(center.x, center.y);
    base.setDepth(7);
    base.add(this.add.rectangle(0, 0, 26, 26, 0x9d7e73));
    base.add(this.add.triangle(0, -6, -10, 6, 10, 6, 0, -12, 0x708d9b));
    base.add(this.add.triangle(0, -14, -5, 0, 5, 0, 0, -7, 0xfacc15));

    const label = this.add.text(center.x, center.y - 26, '箭塔', {
      color: '#c0b090', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '10px',
    });
    label.setOrigin(0.5); label.setDepth(9);

    // 鼠标悬停显示射程
    base.setInteractive();
    base.on('pointerover', () => rangeShape.setFillStyle(0xffa726, 0.05));
    base.on('pointerout', () => rangeShape.setFillStyle(0x000000, 0));

    this.towers.push({ id: `tower-${this.towerSequence++}`, slotId: slot.id, position: { x: center.x, y: center.y }, fireTimer: 0, base, type: 'arrow', label, rangeShape });
    this.totalTowersBuilt++;
  }

  private buildCatapult(slot: BuildSlot, center: Point): void {
    this.buildTower(slot, center, 'catapult');
  }

  private buildTower(slot: BuildSlot, center: Point, buildingType: Exclude<BuildingType, 'wall'>): void {
    const definition = BUILDING_DEFINITIONS[buildingType];
    const rangeShape = this.add.circle(center.x, center.y, Math.max(1, definition.range), 0x000000, 0);
    rangeShape.setStrokeStyle(1, 0x6a5a48, definition.range > 0 ? 0.25 : 0);
    rangeShape.setDepth(5);

    const base = this.add.container(center.x, center.y);
    base.setDepth(7);
    base.add(this.add.rectangle(0, 0, 28, 28, this.getBuildingColor(buildingType)));
    base.add(this.add.text(0, 0, definition.shortLabel, {
      color: '#0a0805', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px', fontStyle: 'bold',
    }).setOrigin(0.5));

    const label = this.add.text(center.x, center.y - 26, definition.name, {
      color: '#c0b090', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '10px',
    });
    label.setOrigin(0.5); label.setDepth(9);

    base.setInteractive();
    base.on('pointerover', () => rangeShape.setFillStyle(0xffa726, 0.05));
    base.on('pointerout', () => rangeShape.setFillStyle(0x000000, 0));

    this.towers.push({ id: `tower-${this.towerSequence++}`, slotId: slot.id, position: { x: center.x, y: center.y }, fireTimer: 0, base, type: buildingType, label, rangeShape });
    this.totalTowersBuilt++;
  }

  private getBuildingColor(type: Exclude<BuildingType, 'wall'>): number {
    const colors: Record<Exclude<BuildingType, 'wall'>, number> = {
      arrow: 0x9d7e73, catapult: 0x818181, fire: 0xd4a843, ice: 0x90caf9,
      minion: 0x9dd6a3, 'blast-minion': 0xffa726, 'attack-banner': 0xc62828, 'speed-banner': 0x7cb342,
    };
    return colors[type];
  }

  private buildWall(slot: BuildSlot, center: Point): void {
    const maxHp = this.stats.wallMaxHealth;
    const container = this.add.container(center.x, center.y);
    container.setDepth(7);

    // 砖墙
    container.add(this.add.rectangle(0, 0, 14, 38, 0x896558));
    container.add(this.add.rectangle(-4, -8, 10, 4, 0x6d5047, 0.4));
    container.add(this.add.rectangle(4, 8, 10, 4, 0x6d5047, 0.4));
    container.add(this.add.rectangle(0, 0, 16, 40, 0x000000, 0).setStrokeStyle(1, 0x6d5047, 0.6));

    const healthBar = this.add.rectangle(center.x, center.y - 26, 22, 4, 0x4caf50);
    healthBar.setDepth(9);
    const healthText = this.add.text(center.x - 10, center.y - 26, `${maxHp}`, {
      color: '#e0d8c8', fontFamily: 'monospace', fontSize: '9px',
    });
    healthText.setDepth(10);
    const label = this.add.text(center.x, center.y - 38, '城墙', {
      color: '#c0b090', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '10px',
    });
    label.setOrigin(0.5); label.setDepth(9);

    this.walls.push({ id: `wall-${this.wallSequence++}`, slotId: slot.id, position: { x: center.x, y: center.y }, health: maxHp, maxHealth: maxHp, shape: container, healthBar, healthText, label });
    this.totalWallsBuilt++;
  }

  private updateTowers(deltaSeconds: number): void {
    const placed: PlacedBuilding[] = this.towers.map((candidate) => ({ slotId: candidate.slotId, type: candidate.type }));

    for (const tower of this.towers) {
      const definition = BUILDING_DEFINITIONS[tower.type];
      if (!definition) continue;

      // Summon buildings
      if (definition.category === 'summon' && definition.summonType) {
        tower.fireTimer = Math.max(0, tower.fireTimer - deltaSeconds);
        if (tower.fireTimer <= 0) {
          this.summons = spawnMinion(this.summons, definition.summonType, tower.position);
          this.createMissingMinionVisuals();
          tower.fireTimer = definition.fireInterval;
        }
        continue;
      }

      // Support buildings don't attack directly
      if (definition.category === 'support') continue;

      tower.fireTimer = Math.max(0, tower.fireTimer - deltaSeconds);
      if (tower.fireTimer > 0) continue;

      const adjacency = computeAdjacencyBonus(tower.slotId, GRID_BUILD_SLOTS, placed);
      const isArrowType = tower.type === 'arrow';
      const baseDamage = definition.damage;
      const towerDmgBonus = isArrowType ? this.stats.towerDamage : 0;
      const damage = (baseDamage + towerDmgBonus) * adjacency.damageMultiplier;
      const towerReloadMult = isArrowType ? this.stats.towerFireInterval / 0.55 : this.stats.catapultFireInterval / 1.8;
      const interval = Math.max(0.15, definition.fireInterval * adjacency.fireIntervalMultiplier * towerReloadMult);

      if (tower.type === 'arrow' || tower.type === 'fire' || tower.type === 'ice') {
        const range = definition.range + (isArrowType ? this.stats.towerRange - 190 : 0);
        const target = selectNearestTarget(tower.position, this.enemies, range);
        if (!target) continue;
        const result = applyDamage(target.health, damage);
        (target as any).health = result.health;
        this.results = addBuildingDamage(this.results, tower.id, definition.name, damage);
        if (result.dead) {
          this.results = addBuildingKill(this.results, tower.id);
          this.removeEnemy(target as any);
        }
        if (tower.type === 'fire' && definition.splashRadius > 0) {
          for (const enemy of this.enemies) {
            if (enemy.id === (target as any).id) continue;
            if (distanceSquared(enemy.position, target.position) <= definition.splashRadius ** 2) {
              const splashResult = applyDamage(enemy.health, damage * 0.5);
              enemy.health = splashResult.health;
              if (splashResult.dead) {
                this.results = addBuildingKill(this.results, tower.id);
                this.removeEnemy(enemy);
              }
            }
          }
          this.drawSplashCircle(target.position, definition.splashRadius);
        }
        if (tower.type === 'ice') {
          this.drawProjectileToTarget(tower.position, target.position, 0x90caf9, 200);
        } else {
          this.drawArrowProjectile(tower.position, target.position);
        }
        tower.fireTimer = interval;
      } else if (tower.type === 'catapult' || tower.type === 'blast-minion') {
        const target = selectHighestHealthTarget(tower.position, this.enemies, definition.range);
        if (!target) continue;
        const result = applyDamage(target.health, damage);
        (target as any).health = result.health;
        this.results = addBuildingDamage(this.results, tower.id, definition.name, damage);
        const killedIds = new Set<string>();
        if (result.dead) {
          this.results = addBuildingKill(this.results, tower.id);
          killedIds.add(target.id);
        }
        for (const enemy of this.enemies) {
          if (enemy.id === target.id) continue;
          if (distanceSquared(enemy.position, target.position) <= definition.splashRadius ** 2) {
            const splashResult = applyDamage(enemy.health, damage);
            enemy.health = splashResult.health;
            if (splashResult.dead) {
              this.results = addBuildingKill(this.results, tower.id);
              killedIds.add(enemy.id);
            }
          }
        }
        this.drawSplashCircle(target.position, definition.splashRadius);
        for (const id of killedIds) {
          const killed = this.enemies.find((e) => e.id === id);
          if (killed) this.removeEnemy(killed);
        }
        tower.fireTimer = interval;
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // PROJECTILES
  // ═══════════════════════════════════════════════════

  private drawArrowProjectile(from: Point, to: Point): void {
    const arrow = this.add.circle(from.x, from.y, 3, 0xfacc15);
    arrow.setDepth(16);
    this.tweens.add({
      targets: arrow, x: to.x, y: to.y, duration: 100, ease: 'Linear',
      onComplete: () => {
        const flash = this.add.circle(to.x, to.y, 5, 0xffffff, 0.8);
        flash.setDepth(16);
        this.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 80, onComplete: () => flash.destroy() });
        arrow.destroy();
      },
    });
  }

  private drawCatapultProjectile(from: Point, to: Point): void {
    const rock = this.add.circle(from.x, from.y, 5, 0xff9800);
    rock.setDepth(16);
    this.tweens.add({
      targets: rock, x: to.x, y: to.y, duration: 350, ease: 'Sine.easeInOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const p = tween.progress;
        rock.setY(from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 60);
      },
      onComplete: () => {
        const boom = this.add.circle(to.x, to.y, 12, 0xff9800, 0.6);
        boom.setDepth(16);
        this.tweens.add({ targets: boom, alpha: 0, scale: 2.5, duration: 180, onComplete: () => boom.destroy() });
        rock.destroy();
      },
    });
  }

  private drawProjectileToTarget(from: Point, to: Point, color: number, speed: number): void {
    const proj = this.add.circle(from.x, from.y, 4, color);
    proj.setDepth(16);
    this.tweens.add({
      targets: proj, x: to.x, y: to.y, duration: (Math.sqrt(distanceSquared(from, to)) / speed) * 1000, ease: 'Linear',
      onComplete: () => {
        const flash = this.add.circle(to.x, to.y, 8, color, 0.5);
        flash.setDepth(16);
        this.tweens.add({ targets: flash, alpha: 0, scale: 2, duration: 120, onComplete: () => flash.destroy() });
        proj.destroy();
      },
    });
  }

  private drawSplashCircle(center: Point, radius: number): void {
    const circle = this.add.circle(center.x, center.y, radius, 0xff9800, 0);
    circle.setStrokeStyle(2, 0xff9800, 0.4);
    circle.setDepth(15);
    this.tweens.add({ targets: circle, alpha: 0, scale: 1.5, duration: 200, onComplete: () => circle.destroy() });
  }

  // ═══════════════════════════════════════════════════
  // ENEMY DEATH
  // ═══════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════
  // P1 INTEGRATION: RESOURCES, SHOP, WEAPONS, SUMMONS, EVENTS, BOSS
  // ═══════════════════════════════════════════════════

  private updateResourceDeposit(): void {
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    if (distanceSquared(this.playerPosition, caravanCenter) > DEPOSIT_RANGE * DEPOSIT_RANGE) return;
    const hadResources = this.carried.wood > 0 || this.carried.stone > 0 || this.carried.gold > 0 || this.carried.xp > 0;
    if (!hadResources) return;
    const result = depositCarriedResources(this.wallet, this.carried);
    this.wallet = result.wallet;
    this.carried = result.carried;
    if (result.deposited.xp > 0) {
      this.experience = addExperience(this.experience, result.deposited.xp);
      this.tryOpenUpgradeChoices();
    }
    const repair = repairCaravanWithStone(this.wallet, this.stats.caravanHealth, this.stats.caravanMaxHealth, STONE_REPAIR_RATE);
    this.wallet = repair.wallet;
    this.stats.caravanHealth = repair.caravanHealth;
    if (result.deposited.wood > 0 || result.deposited.stone > 0 || result.deposited.gold > 0) {
      this.showFeedback(`存入 木${Math.floor(result.deposited.wood)} 石${Math.floor(result.deposited.stone)} 金${Math.floor(result.deposited.gold)}`, '#c0d8a0');
      this.showFloatingResource(caravanCenter.x, caravanCenter.y - 80, `+${Math.floor(result.deposited.wood)}木 +${Math.floor(result.deposited.stone)}石`, '#c0d8a0');
    }
  }

  private maybeOpenShop(): void {
    if (this.shopOpen || this.upgradeSelecting || this.gameOver) return;
    if (this.elapsedSeconds < this.nextShopAtSeconds) return;
    this.nextShopAtSeconds += 180;
    this.shop = createShopState();
    this.shopOpen = true;
    this.showShopOverlay();
  }

  private showShopOverlay(): void {
    this.hideShopOverlay();
    if (!this.shop) return;
    const overlay = this.add.container(640, 360);
    overlay.setScrollFactor(0);
    overlay.setDepth(OVERLAY_DEPTH + 22);
    overlay.add(this.add.rectangle(0, 0, 1280, 720, 0x0a0805, 0.72));
    overlay.add(this.add.rectangle(0, 0, 680, 420, 0x2a2018, 0.96).setStrokeStyle(2, 0x8a7a58, 0.7));
    overlay.add(this.add.text(0, -170, '商店', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '30px', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.shop.stock.forEach((item, index) => {
      const y = -90 + index * 58;
      const button = this.add.rectangle(0, y, 560, 44, 0x3a3020, 1).setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.buyShopItem(item.id));
      overlay.add(button);
      overlay.add(this.add.text(-250, y, item.name, { color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '15px' }).setOrigin(0, 0.5));
      overlay.add(this.add.text(250, y, this.formatCost(item.cost), { color: '#c8a860', fontFamily: 'monospace', fontSize: '13px' }).setOrigin(1, 0.5));
    });
    const reroll = this.add.rectangle(-120, 165, 160, 38, 0x3a3020, 1).setInteractive({ useHandCursor: true });
    reroll.on('pointerdown', () => this.rerollCurrentShop());
    const close = this.add.rectangle(120, 165, 160, 38, 0x3a3020, 1).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.closeShop());
    overlay.add([reroll, close]);
    overlay.add(this.add.text(-120, 165, `重随 ${this.shop.rerollCost} 金`, { color: '#e0d8c8', fontFamily: 'Arial', fontSize: '14px' }).setOrigin(0.5));
    overlay.add(this.add.text(120, 165, '离开', { color: '#e0d8c8', fontFamily: 'Arial', fontSize: '14px' }).setOrigin(0.5));
    this.shopOverlay = overlay;
  }

  private hideShopOverlay(): void {
    if (this.shopOverlay) { this.shopOverlay.destroy(true); this.shopOverlay = undefined; }
  }

  private buyShopItem(itemId: string): void {
    if (!this.shop) return;
    const result = purchaseShopItem(this.shop, this.wallet, itemId);
    if (!result.ok || !result.item) {
      this.showFeedback('资源不足', '#c8a860');
      return;
    }
    this.shop = result.shop;
    this.wallet = result.wallet;
    this.applyShopItem(result.item);
    this.showShopOverlay();
    this.updateHudPanels();
  }

  private rerollCurrentShop(): void {
    if (!this.shop) return;
    const result = rerollShop(this.shop, this.wallet);
    if (!result.ok) {
      this.showFeedback('金币不足，无法重随', '#c8a860');
      return;
    }
    this.shop = result.shop;
    this.wallet = result.wallet;
    this.showShopOverlay();
  }

  private closeShop(): void {
    this.shopOpen = false;
    this.hideShopOverlay();
  }

  private applyShopItem(item: ShopItem): void {
    if (item.kind === 'resource' && item.grant) {
      this.wallet = {
        ...this.wallet,
        gold: this.wallet.gold + (item.grant.gold ?? 0),
        wood: this.wallet.wood + (item.grant.wood ?? 0),
        stone: this.wallet.stone + (item.grant.stone ?? 0),
        xp: this.wallet.xp + (item.grant.xp ?? 0),
      };
    }
    if (item.kind === 'repair' && item.repairAmount) {
      this.stats.caravanHealth = Math.min(this.stats.caravanMaxHealth, this.stats.caravanHealth + item.repairAmount);
    }
    if (item.kind === 'building' && item.buildingType) {
      this.showFeedback(`获得建筑：${getBuildingDefinition(item.buildingType)?.name ?? item.buildingType}`, '#d4a843');
    }
    if (item.kind === 'weapon' && item.weaponType) {
      this.weapons = addWeapon(this.weapons, item.weaponType);
      this.showFeedback(`获得武器：${getWeaponDefinition(item.weaponType)?.name ?? item.weaponType}`, '#d4a843');
    }
  }

  private formatCost(cost: ResourceAmounts): string {
    const parts: string[] = [];
    if (cost.wood) parts.push(`${cost.wood} 木`);
    if (cost.stone) parts.push(`${cost.stone} 石`);
    if (cost.gold) parts.push(`${cost.gold} 金`);
    if (cost.xp) parts.push(`${cost.xp} XP`);
    return parts.length > 0 ? parts.join(' ') : '免费';
  }

  private updateWeapons(deltaSeconds: number): void {
    this.weapons = updateWeaponTimers(this.weapons, deltaSeconds);
    this.weapons.owned = this.weapons.owned.map((weapon) => {
      if (weapon.cooldownTimer > 0) return weapon;
      const definition = getWeaponDefinition(weapon.type);
      if (!definition) return weapon;
      const effectiveRange = definition.range + weapon.rangeBonus + this.stats.weaponRangeBonus;
      const target = selectNearestTarget(this.playerPosition, this.enemies, effectiveRange);
      if (!target) return weapon;
      const damage = Math.round(definition.damage * weapon.damageMultiplier * this.stats.weaponDamageMultiplier);
      const result = applyDamage(target.health, damage);
      (target as any).health = result.health;
      this.showDamageNumber(target.position.x, target.position.y - (target as any).radius - 10, damage);
      this.results = addHeroDamage(this.results, damage);
      if (result.dead) {
        if (definition.createsMinionOnKill) {
          this.summons = spawnMinion(this.summons, 'decaying', (target as any).position);
          this.createMissingMinionVisuals();
        }
        this.removeEnemy(target as any);
      }
      this.drawProjectileToTarget(this.playerPosition, target.position, 0xd4a843, 380);
      const cooldown = definition.cooldown * weapon.cooldownMultiplier * this.stats.weaponCooldownMultiplier;
      return { ...weapon, cooldownTimer: cooldown };
    });
  }

  private createMissingMinionVisuals(): void {
    for (const minion of this.summons.minions) {
      if (this.minionVisuals.has(minion.id)) continue;
      const definition = getMinionDefinition(minion.type);
      if (!definition) continue;
      const visual = this.add.container(minion.position.x, minion.position.y);
      visual.setDepth(11);
      visual.add(this.add.circle(0, 0, minion.type === 'bomber' ? 7 : 6, minion.type === 'bomber' ? 0xffa726 : 0x9dd6a3));
      visual.add(this.add.text(0, -12, definition.name[0], { color: '#102010', fontFamily: 'Arial', fontSize: '9px' }).setOrigin(0.5));
      this.minionVisuals.set(minion.id, visual);
    }
  }

  private updateMinions(deltaSeconds: number): void {
    this.summons = updateMinionLifetime(this.summons, deltaSeconds);
    for (const minion of this.summons.minions) {
      const definition = getMinionDefinition(minion.type);
      if (!definition) continue;
      const target = selectNearestTarget(minion.position, this.enemies, 240);
      if (target) {
        const dx = target.position.x - minion.position.x;
        const dy = target.position.y - minion.position.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        minion.position.x += (dx / length) * definition.speed * deltaSeconds;
        minion.position.y += (dy / length) * definition.speed * deltaSeconds;
        if (distanceSquared(minion.position, target.position) <= definition.attackRange ** 2) {
          const result = applyDamage(target.health, definition.damage * this.summons.damageMultiplier * this.stats.summonDamageMultiplier);
          (target as any).health = result.health;
          if (result.dead) this.removeEnemy(target as any);
          if (minion.type === 'bomber') this.detonateMinion(minion.id);
        }
      }
      this.minionVisuals.get(minion.id)?.setPosition(minion.position.x, minion.position.y);
    }
    this.cleanupMissingMinionVisuals();
  }

  private cleanupMissingMinionVisuals(): void {
    const activeIds = new Set(this.summons.minions.map((m) => m.id));
    for (const [id, visual] of this.minionVisuals) {
      if (!activeIds.has(id)) { visual.destroy(true); this.minionVisuals.delete(id); }
    }
  }

  private detonateMinion(minionId: string): void {
    const result = killMinion(this.summons, minionId);
    this.summons = result.state;
    for (const effect of result.effects) {
      this.drawSplashCircle(effect.position, effect.radius);
      for (const enemy of [...this.enemies]) {
        if (distanceSquared(enemy.position, effect.position) <= effect.radius ** 2) {
          const damage = applyDamage(enemy.health, effect.damage);
          enemy.health = damage.health;
          if (damage.dead) this.removeEnemy(enemy);
        }
      }
    }
    this.cleanupMissingMinionVisuals();
  }

  private updateRouteEvents(deltaSeconds: number): void {
    const progress = this.caravanTopLeft.x;
    if (this.routeEvents.active.length === 0 && progress > 900) {
      const event = createRewardCircle(`event-${this.routeEvents.nextId}`, { x: this.caravanTopLeft.x + 260, y: this.caravanTopLeft.y - 120 }, { gold: 12 }, 6);
      this.routeEvents = { active: [event], nextId: this.routeEvents.nextId + 1 };
      this.createEventVisual(event);
    }
    this.routeEvents = {
      ...this.routeEvents,
      active: this.routeEvents.active.map((event) => {
        const occupied = distanceSquared(this.playerPosition, event.position) <= 95 ** 2;
        const updated = updateRewardCircle(event, deltaSeconds, occupied);
        const claimed = completeRewardCircle(updated);
        if (Object.keys(claimed.reward).length > 0) {
          this.wallet = {
            ...this.wallet,
            gold: this.wallet.gold + (claimed.reward.gold ?? 0),
            wood: this.wallet.wood + (claimed.reward.wood ?? 0),
            stone: this.wallet.stone + (claimed.reward.stone ?? 0),
            xp: this.wallet.xp + (claimed.reward.xp ?? 0),
          };
          this.showFeedback('奖励完成', '#d4a843');
        }
        return claimed.event;
      }),
    };
    this.cleanupCompletedEvents();
  }

  private createEventVisual(event: RouteEvent): void {
    const visual = this.add.container(event.position.x, event.position.y);
    visual.setDepth(6);
    const circle = this.add.circle(0, 0, 30, 0xd4a843, 0.15);
    circle.setStrokeStyle(2, 0xd4a843, 0.5);
    visual.add(circle);
    visual.add(this.add.text(0, 0, '?', {
      color: '#d4a843', fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.eventVisuals.set(event.id, visual);
  }

  private cleanupCompletedEvents(): void {
    for (const event of this.routeEvents.active) {
      if (event.completed && event.claimed) {
        this.eventVisuals.get(event.id)?.destroy(true);
        this.eventVisuals.delete(event.id);
      }
    }
    this.routeEvents = {
      ...this.routeEvents,
      active: this.routeEvents.active.filter((e) => !(e.completed && e.claimed)),
    };
  }

  private updateBoss(deltaSeconds: number): void {
    if (!this.boss.active && this.elapsedSeconds >= 600) {
      this.boss = startBoss(500);
      this.bossStarted = true;
      this.spawnEnemy('boss');
      this.showWaveBanner(this.waveState.currentWave + 1);
    }
    const result = updateBossState(this.boss, deltaSeconds);
    this.boss = result.state;
    for (let i = 0; i < result.spawnEggs; i += 1) {
      this.spawnEnemyNear('burst', getCaravanCenter(this.caravanTopLeft), i);
    }
  }

  private isP1VictoryConditionMet(): boolean {
    const bossAlive = this.enemies.some((enemy) => enemy.type === 'boss');
    return this.elapsedSeconds >= 720 && this.bossStarted && !this.boss.active && !bossAlive;
  }

  private removeEnemy(enemy: Enemy): void {
    // 死亡爆炸粒子（使用敌人类型颜色）
    const deathColors: Record<EnemyTypeId, number> = {
      grunt: 0xef4444, runner: 0xf97316, brute: 0x991b1b,
      thrower: 0xff6b35, burst: 0xffd600, boss: 0x9c27b0,
    };
    const color = deathColors[enemy.type] || 0xef4444;
    const particleCount = enemy.type === 'boss' ? 16 : enemy.type === 'brute' ? 10 : 8;
    for (let i = 0; i < particleCount; i++) {
      const p = this.add.circle(enemy.position.x, enemy.position.y, 2 + Math.random() * 5, color, 0.9);
      p.setDepth(16);
      this.tweens.add({
        targets: p,
        x: enemy.position.x + (Math.random() - 0.5) * 60,
        y: enemy.position.y + (Math.random() - 0.5) * 60,
        alpha: 0, scale: 0,
        duration: 250 + Math.random() * 300,
        onComplete: () => p.destroy(),
      });
    }

    // XP 球：飞向玩家，吸入后消失
    const xpOrb = this.add.circle(enemy.position.x, enemy.position.y, 5, 0x88ff23, 0.9);
    xpOrb.setStrokeStyle(1.5, 0x76dd27, 0.6);
    xpOrb.setDepth(17);
    this.tweens.add({
      targets: xpOrb,
      x: this.playerPosition.x,
      y: this.playerPosition.y,
      alpha: 0.3,
      scale: 0.5,
      duration: 400,
      ease: 'Power2',
      onComplete: () => xpOrb.destroy(),
    });

    enemy.body.destroy();
    enemy.label.destroy();
    enemy.healthBar.destroy();
    enemy.healthBarBg.destroy();
    this.enemies = this.enemies.filter((e) => e.id !== enemy.id);
    this.totalEnemiesKilled++;
    if (enemy.type === 'boss') {
      this.boss = { ...this.boss, active: false, health: 0 };
    }
    this.awardEnemyExperience(enemy.experienceReward);
  }

  // ═══════════════════════════════════════════════════
  // EXPERIENCE & UPGRADES
  // ═══════════════════════════════════════════════════

  private awardEnemyExperience(amount: number): void {
    if (this.gameOver || this.stats.caravanHealth <= 0) return;
    this.experience = addExperience(this.experience, amount);
    this.tryOpenUpgradeChoices();
  }

  private tryOpenUpgradeChoices(): void {
    if (this.upgradeSelecting || this.gameOver || this.stats.caravanHealth <= 0 || !hasPendingLevelUp(this.experience)) return;
    const choices = pickUpgradeChoices(UPGRADE_POOL, 3, Math.random);
    if (choices.length === 0) return;
    this.upgradeChoices = choices;
    this.upgradeSelecting = true;
    this.showUpgradeOverlay();
  }

  private updateUpgradeInput(): void {
    if (this.upgradeInputCooldown > 0) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) { this.selectUpgrade(0); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) { this.selectUpgrade(1); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) { this.selectUpgrade(2); }
  }

  private showUpgradeOverlay(): void {
    this.hideUpgradeOverlay();
    const overlay = this.add.container(640, 360);
    overlay.setScrollFactor(0);
    overlay.setDepth(OVERLAY_DEPTH + 20);

    overlay.add(this.add.rectangle(0, 0, 1280, 720, 0x0a0805, 0.75));

    // Level-up flash effect
    const flash = this.add.rectangle(0, 0, 1280, 720, 0xd4a843, 0.25);
    flash.setDepth(0);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy(),
    });

    const panel = this.add.rectangle(0, 0, 720, 400, 0x2a2018, 0.96);
    panel.setStrokeStyle(2, 0x8a7a58, 0.7);
    overlay.add(panel);

    const title = this.add.text(0, -165, '⚡ 升级', {
      align: 'center', color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '30px', fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    overlay.add(title);

    this.upgradeChoices.forEach((choice, index) => {
      const y = -50 + index * 100;
      const card = this.add.rectangle(0, y, 600, 76, 0x3a3020, 1);
      card.setStrokeStyle(1, 0x5a4a38, 0.6);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => { card.setStrokeStyle(2, 0x8a7a58, 1); card.setFillStyle(0x4a4030, 1); });
      card.on('pointerout', () => { card.setStrokeStyle(1, 0x5a4a38, 0.6); card.setFillStyle(0x3a3020, 1); });
      card.on('pointerdown', () => { if (this.upgradeInputCooldown <= 0) this.selectUpgrade(index); });

      const icon = this.add.text(-270, y, `${index + 1}`, {
        color: '#d4a843', fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold',
      });
      icon.setOrigin(0, 0.5);
      overlay.add([card, icon]);

      const name = this.add.text(-240, y - 14, choice.name, {
        color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '20px',
      });
      name.setOrigin(0, 0.5);

      const desc = this.add.text(-240, y + 14, choice.description, {
        color: '#a09880', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '15px',
        wordWrap: { width: 520 },
      });
      desc.setOrigin(0, 0.5);

      overlay.add([card, name, desc]);
    });

    this.upgradeOverlay = overlay;
  }

  private hideUpgradeOverlay(): void {
    if (this.upgradeOverlay) { this.upgradeOverlay.destroy(true); this.upgradeOverlay = undefined; }
  }

  private selectUpgrade(index: number): void {
    if (!this.upgradeSelecting) return;
    const choice = this.upgradeChoices[index];
    if (!choice) return;
    this.stats = applyUpgrade(this.stats, choice.id);

    // Building card upgrades: add card to hand
    const cardMap: Partial<Record<UpgradeId, Exclude<BuildingType, 'wall'>>> = {
      'building-card-arrow': 'arrow',
      'building-card-fire': 'fire',
      'building-card-ice': 'ice',
      'building-card-catapult': 'catapult',
    };
    const cardType = cardMap[choice.id as UpgradeId];
    if (cardType) this.addCardToHand(cardType);
    this.experience = consumePendingLevelUp(this.experience);
    this.upgradeSelecting = false;
    this.upgradeChoices = [];
    this.hideUpgradeOverlay();
    this.upgradeInputCooldown = UPGRADE_INPUT_COOLDOWN;
    this.updateTowerRangeVisuals();
    this.updateHudPanels();
    this.tryOpenUpgradeChoices();
  }

  // ═══════════════════════════════════════════════════
  // PAUSE
  // ═══════════════════════════════════════════════════

  private togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) {
      this.showPauseOverlay();
    } else {
      this.hidePauseOverlay();
    }
  }

  private showPauseOverlay(): void {
    this.hidePauseOverlay();
    const overlay = this.add.container(640, 360);
    overlay.setScrollFactor(0);
    overlay.setDepth(OVERLAY_DEPTH + 25);

    overlay.add(this.add.rectangle(0, 0, 1280, 720, 0x0a0805, 0.5));

    const panel = this.add.rectangle(0, 0, 400, 300, 0x2a2018, 0.96);
    panel.setStrokeStyle(2, 0x8a7a58, 0.7);
    overlay.add(panel);

    const title = this.add.text(0, -80, '暂停', {
      align: 'center', color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '36px', fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    overlay.add(title);

    const hint = this.add.text(0, -20, '按 P 或 ESC 继续', {
      align: 'center', color: '#9a8a78', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '18px',
    });
    hint.setOrigin(0.5);
    overlay.add(hint);

    const stats = this.add.text(0, 40,
      `波次：${this.waveState.currentWave}/${MAX_WAVE}\n时间：${Math.floor(this.elapsedSeconds)}s\n击杀：${this.totalEnemiesKilled}\n等级：${this.experience.level}`,
      { align: 'center', color: '#b0a090', fontFamily: 'monospace', fontSize: '16px', lineSpacing: 6 },
    );
    stats.setOrigin(0.5);
    overlay.add(stats);

    this.pauseOverlay = overlay;
  }

  private hidePauseOverlay(): void {
    if (this.pauseOverlay) { this.pauseOverlay.destroy(true); this.pauseOverlay = undefined; }
  }

  // ═══════════════════════════════════════════════════
  // SCREEN SHAKE
  // ═══════════════════════════════════════════════════

  private screenShake(): void {
    this.cameras.main.shake(SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY);
  }

  // ═══════════════════════════════════════════════════
  // PLAYER MOVEMENT
  // ═══════════════════════════════════════════════════

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

    // Face direction
    if (xInput !== 0 || yInput !== 0) {
      this.player.setScale(xInput < 0 ? -1 : 1, 1);
    }
  }

  // ═══════════════════════════════════════════════════
  // CARAVAN UPDATE
  // ═══════════════════════════════════════════════════

  private updateCaravan(deltaSeconds: number): void {
    this.caravanTopLeft.x += CARAVAN_SPEED * deltaSeconds;
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    this.caravanBody.setPosition(caravanCenter.x, caravanCenter.y);

    // Caravan flash
    this.caravanBody.setAlpha(this.caravanDamageFlashTimer > 0 ? 0.6 : 1);
    if (this.stats.caravanHealth / this.stats.caravanMaxHealth < 0.3) {
      // Low HP pulsing red border effect
      const pulse = 0.7 + Math.sin(this.elapsedSeconds * 6) * 0.3;
      this.caravanBody.list.forEach((child: any) => {
        if (child.setFillStyle && child !== this.caravanBody.list[0]) {
          // Only affect main body rectangles
        }
      });
    }

    this.updateCaravanHealthBar(caravanCenter);

    for (const tower of this.towers) {
      const slot = GRID_BUILD_SLOTS.find((c) => c.id === tower.slotId);
      if (!slot) continue;
      const center = this.getSlotCenter(slot);
      tower.position = { x: center.x, y: center.y };
      tower.base.setPosition(center.x, center.y);
      tower.rangeShape.setPosition(center.x, center.y);
      tower.label.setPosition(center.x, center.y - 26);
    }

    for (const wall of this.walls) {
      const slot = GRID_BUILD_SLOTS.find((c) => c.id === wall.slotId);
      if (!slot) continue;
      const center = this.getSlotCenter(slot);
      wall.position = { x: center.x, y: center.y };
      wall.shape.setPosition(center.x, center.y);
      wall.healthBar.setPosition(center.x, center.y - 26);
      wall.healthText.setPosition(center.x - 10, center.y - 26);
      wall.label.setPosition(center.x, center.y - 38);
    }

    if (this.buildMode) this.updateBuildSlotHighlights();
  }

  // ═══════════════════════════════════════════════════
  // BUILD MODE
  // ═══════════════════════════════════════════════════

  private getSlotCenter(slot: BuildSlot): Point {
    const pos = getSlotWorldPosition(this.caravanTopLeft, slot);
    return { x: pos.x + CELL_SIZE / 2, y: pos.y + CELL_SIZE / 2 };
  }

  private getOccupiedSlotIds(): Set<string> {
    const ids = new Set<string>();
    for (const t of this.towers) ids.add(t.slotId);
    for (const w of this.walls) ids.add(w.slotId);
    return ids;
  }

  private handleBuildModeToggle(): void {
    // ESC or B: deselect card, close menus
    if (this.selectedCardIndex >= 0) {
      this.deselectCard();
      return;
    }
    // B key: close build menu overlay if open
    if (this.buildMode && Phaser.Input.Keyboard.JustDown(this.keys.B)) {
      this.buildMode = false;
      this.destroyBuildSlotHighlights();
      this.hideBuildMenu();
    }
  }

  private createBuildSlotHighlights(): void {
    const occupiedSlotIds = this.getOccupiedSlotIds();
    for (const slot of GRID_BUILD_SLOTS) {
      // When a tower card is selected, don't highlight wall-only slots
      if (this.selectedCardIndex >= 0 && slot.buildingType === 'wall') continue;
      const center = this.getSlotCenter(slot);
      const isOccupied = occupiedSlotIds.has(slot.id);

      if (isOccupied) {
        // Occupied slot: subtle red overlay to show it's blocked
        const blocked = this.add.rectangle(center.x, center.y, 40, 40, 0xef4444, 0.15);
        blocked.setStrokeStyle(1, 0xef4444, 0.3);
        blocked.setDepth(OVERLAY_DEPTH + 4);
        this.buildSlotHighlights.set(slot.id, blocked);
      } else {
        // Free slot: green highlight for building
        const highlight = this.add.rectangle(center.x, center.y, 44, 44, 0x4caf50, 0.15);
        highlight.setStrokeStyle(2, 0x4caf50, 0.6);
        highlight.setDepth(OVERLAY_DEPTH + 8);
        highlight.setInteractive({ useHandCursor: true });
        highlight.on('pointerover', () => highlight.setFillStyle(0x4caf50, 0.3));
        highlight.on('pointerout', () => highlight.setFillStyle(0x4caf50, 0.15));
        highlight.on('pointerdown', () => {
          if (this.selectedCardIndex >= 0) {
            this.placeCard(slot);
          } else {
            this.showBuildMenu(slot);
          }
        });
        this.buildSlotHighlights.set(slot.id, highlight);
      }
    }
  }

  private destroyBuildSlotHighlights(): void {
    for (const h of this.buildSlotHighlights.values()) h.destroy();
    this.buildSlotHighlights.clear();
  }

  private updateBuildSlotHighlights(): void {
    for (const [slotId, highlight] of this.buildSlotHighlights) {
      const slot = GRID_BUILD_SLOTS.find((s) => s.id === slotId);
      if (!slot) continue;
      highlight.setPosition(this.getSlotCenter(slot).x, this.getSlotCenter(slot).y);
    }
  }

  private removeBuildSlotHighlight(slotId: string): void {
    const h = this.buildSlotHighlights.get(slotId);
    if (h) { h.destroy(); this.buildSlotHighlights.delete(slotId); }
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
    overlay.add(this.add.rectangle(0, 0, 200, slot.buildingType === 'wall' ? 60 : 90, 0x2a2018, 0.95).setStrokeStyle(2, 0x8a7a58, 0.7));

    const title = this.add.text(0, slot.buildingType === 'wall' ? 0 : -26, '选择建筑', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '14px',
    });
    title.setOrigin(0.5);
    overlay.add(title);

    type BuildOption = { type: BuildingType; label: string; cost: string };
    const options: BuildOption[] = slot.buildingType === 'wall'
      ? [{ type: 'wall' as BuildingType, label: getBuildingName('wall'), cost: getBuildingCostText('wall') }]
      : (['arrow', 'catapult', 'fire', 'ice', 'minion', 'blast-minion', 'attack-banner', 'speed-banner'] as BuildingType[]).map((type) => ({
          type,
          label: `${BUILDING_DEFINITIONS[type].shortLabel} ${BUILDING_DEFINITIONS[type].name}`,
          cost: getCatalogCostText(type),
        }));

    options.forEach((option, index) => {
      const y = (slot.buildingType === 'wall' ? 18 : 4) + index * 30;
      const btn = this.add.rectangle(0, y, 180, 24, 0x3a3020, 1);
      btn.setStrokeStyle(1, 0x5a4a38, 0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.buildFromMenu(option.type, slot));
      overlay.add([btn,
        this.add.text(-80, y, option.label, { color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '13px' }).setOrigin(0, 0.5),
        this.add.text(80, y, option.cost, { color: '#8a7a68', fontFamily: 'monospace', fontSize: '11px' }).setOrigin(1, 0.5),
      ]);
    });

    this.buildingOverlay = overlay;
    this.selectedBuildSlot = slot;
  }

  private hideBuildMenu(): void {
    if (this.buildingOverlay) { this.buildingOverlay.destroy(true); this.buildingOverlay = undefined; this.selectedBuildSlot = undefined; }
  }

  private buildFromMenu(buildingType: BuildingType, slot: BuildSlot): void {
    const center = this.getSlotCenter(slot);
    if (buildingType === 'wall') {
      const result = spendResources(this.wallet, { wood: WALL_COST });
      if (!result.ok) { this.showFeedback(`木材不足，需要 ${WALL_COST}`, '#c8a860'); return; }
      this.wallet = result.wallet;
      this.buildWall(slot, center);
    } else {
      const result = spendBuildingCost(this.wallet, buildingType);
      if (!result.ok) { this.showFeedback(`资源不足：${getCatalogCostText(buildingType)}`, '#c8a860'); return; }
      this.wallet = result.wallet;
      this.buildTower(slot, center, buildingType);
    }
    this.hideBuildMenu();
    this.removeBuildSlotHighlight(slot.id);
    this.updateHudPanels();
  }

  // ═══════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════

  private applyPendingWallRepair(): void {
    if (this.stats.pendingWallRepair > 0) {
      const amt = this.stats.pendingWallRepair;
      this.stats.pendingWallRepair = 0;
      for (const wall of this.walls) {
        wall.health = Math.min(wall.maxHealth, wall.health + amt);
        this.updateWallVisual(wall);
      }
    }
  }

  private updateCamera(): void {
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    this.cameras.main.centerOn((this.playerPosition.x + caravanCenter.x) / 2, (this.playerPosition.y + caravanCenter.y) / 2);
  }

  private hasOpenTowerSlot(): boolean {
    const occupied = this.getOccupiedSlotIds();
    return GRID_BUILD_SLOTS.some((s) => s.buildingType !== 'wall' && !occupied.has(s.id));
  }

  private isCaravanThreatened(): boolean {
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    const rangeSq = THREAT_RANGE * THREAT_RANGE;
    return this.enemies.some((e) => e.health > 0 && distanceSquared(e.position, caravanCenter) <= rangeSq);
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
    for (const tower of this.towers) tower.rangeShape.setRadius(this.stats.towerRange);
  }

  private updateFeedback(deltaSeconds: number): void {
    this.feedbackTimer = Math.max(0, this.feedbackTimer - deltaSeconds);
    if (this.feedbackTimer <= 0) this.feedbackText.setText('');
    this.caravanDamageFlashTimer = Math.max(0, this.caravanDamageFlashTimer - deltaSeconds);
  }

  private updateFloatingTexts(deltaSeconds: number): void {
    for (const ft of this.floatingTexts) {
      ft.timer -= deltaSeconds;
      ft.text.setY(ft.text.y - 50 * deltaSeconds);
      ft.text.setAlpha(Math.max(0, ft.timer * 2.5));
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => {
      if (ft.timer <= 0) { ft.text.destroy(); return false; }
      return true;
    });
  }

  // ═══════════════════════════════════════════════════
  // HUD PANELS
  // ═══════════════════════════════════════════════════

  private createHudPanels(): void {
    // Health panel (top-left)
    this.healthPanel = this.add.container(16, 16);
    this.healthPanel.setScrollFactor(0);
    this.healthPanel.setDepth(OVERLAY_DEPTH + 5);
    this.healthPanel.add(this.add.rectangle(100, 30, 200, 60, 0x2a2018, 0.95).setStrokeStyle(1, 0x5a4a38, 0.6));
    this.healthLabel = this.add.text(16, 6, '行城', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '13px', fontStyle: 'bold',
    });
    this.healthPanel.add(this.healthLabel);
    this.healthBarBg = this.add.rectangle(100, 28, 176, 10, 0x1a1510);
    this.healthPanel.add(this.healthBarBg);
    this.healthBar = this.add.rectangle(12, 28, 172, 6, 0x4caf50);
    this.healthBar.setOrigin(0, 0.5);
    this.healthPanel.add(this.healthBar);
    this.healthText = this.add.text(100, 46, '', {
      color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '12px',
    });
    this.healthText.setOrigin(0.5);
    this.healthPanel.add(this.healthText);

    // Wave & Level panel (top-center)
    this.wavePanel = this.add.container(640, 16);
    this.wavePanel.setScrollFactor(0);
    this.wavePanel.setDepth(OVERLAY_DEPTH + 5);
    this.wavePanel.add(this.add.rectangle(0, 22, 260, 56, 0x2a2018, 0.95).setStrokeStyle(1, 0x5a4a38, 0.6));
    this.waveText = this.add.text(0, 2, '', {
      color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '14px',
    });
    this.waveText.setOrigin(0.5);
    this.wavePanel.add(this.waveText);
    this.xpBarBg = this.add.rectangle(0, 38, 230, 8, 0x1a1510);
    this.wavePanel.add(this.xpBarBg);
    this.xpBarFill = this.add.rectangle(-113, 38, 226, 6, 0x9c27b0);
    this.xpBarFill.setOrigin(0, 0.5);
    this.wavePanel.add(this.xpBarFill);
    this.xpText = this.add.text(0, 50, '', {
      color: '#a09880', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '10px',
    });
    this.xpText.setOrigin(0.5);
    this.wavePanel.add(this.xpText);

    // Resource panel (top-right)
    this.resourcePanel = this.add.container(1190, 16);
    this.resourcePanel.setScrollFactor(0);
    this.resourcePanel.setDepth(OVERLAY_DEPTH + 5);
    this.resourcePanel.add(this.add.rectangle(0, 18, 170, 44, 0x2a2018, 0.95).setStrokeStyle(1, 0x5a4a38, 0.6));
    this.walletText = this.add.text(0, 8, '', {
      color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '12px',
    });
    this.walletText.setOrigin(0.5);
    this.resourcePanel.add(this.walletText);
    this.carriedText = this.add.text(0, 26, '', {
      color: '#8a7a68', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '10px',
    });
    this.carriedText.setOrigin(0.5);
    this.resourcePanel.add(this.carriedText);
  }

  private updateHudPanels(): void {
    // Health panel
    if (this.healthBar && this.healthText) {
      const hpRatio = this.stats.caravanHealth / this.stats.caravanMaxHealth;
      const hpColor = hpRatio > 0.5 ? 0x4caf50 : hpRatio > 0.25 ? 0xfdd835 : 0xef4444;
      this.healthBar.setFillStyle(hpColor);
      this.healthBar.setSize(Math.max(0, 172 * hpRatio), 6);
      this.healthText.setText(`${Math.ceil(this.stats.caravanHealth)}/${this.stats.caravanMaxHealth}`);
    }

    // Wave & Level panel
    if (this.waveText && this.xpBarFill && this.xpText) {
      const wallSlotCount = GRID_BUILD_SLOTS.filter((s) => s.buildingType === 'wall').length;
      this.waveText.setText(`波次 ${this.waveState.currentWave}/${MAX_WAVE}  |  ${Math.ceil(this.waveState.nextWaveTimer)}s  |  箭塔:${this.towers.length}  城墙:${this.walls.length}/${wallSlotCount}`);
      const req = requiredExperienceForLevel(this.experience.level);
      const xpRatio = req > 0 ? this.experience.experience / req : 0;
      this.xpBarFill.setSize(Math.max(0, 226 * Math.min(1, xpRatio)), 6);
      this.xpText.setText(`Lv.${this.experience.level}`);
    }

    // Resource panel
    if (this.walletText && this.carriedText) {
      this.walletText.setText(`木 ${Math.floor(this.wallet.wood)}  石 ${Math.floor(this.wallet.stone)}  金 ${Math.floor(this.wallet.gold)}`);
      this.carriedText.setText(`携带：木${Math.floor(this.carried.wood)} 石${Math.floor(this.carried.stone)} 金${Math.floor(this.carried.gold)}`);
    }

    // Lightweight card affordability refresh (no destruction)
    this.refreshCardAffordability();
  }

  private destroyHudPanels(): void {
    this.healthPanel?.destroy(true);
    this.wavePanel?.destroy(true);
    this.resourcePanel?.destroy(true);
    this.cardHandContainer?.destroy(true);
  }

  // ═══════════════════════════════════════════════════
  // CARD HAND
  // ═══════════════════════════════════════════════════

  private createCardHand(): void {
    this.cardHandContainer = this.add.container(640, 648);
    this.cardHandContainer.setScrollFactor(0);
    this.cardHandContainer.setDepth(OVERLAY_DEPTH + 5);

    this.rebuildCardHand();
  }

  /** Rebuild all card visuals from scratch — call when hand contents change */
  private rebuildCardHand(): void {
    // Destroy old card visuals
    for (const p of this.cardPanels) p.destroy();
    for (const l of this.cardLabels) l.destroy();
    for (const c of this.cardCosts) c.destroy();
    this.cardPanels = [];
    this.cardLabels = [];
    this.cardCosts = [];

    if (this.cardHand.length === 0) {
      const hint = this.add.text(0, 0, '获得建筑卡以开始建造', {
        color: '#8a7a68', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '12px',
      });
      hint.setOrigin(0.5);
      this.cardHandContainer?.add(hint);
      return;
    }

    const cardWidth = 90;
    const cardHeight = 56;
    const gap = 10;
    const totalWidth = this.cardHand.length * (cardWidth + gap) - gap;
    let startX = -totalWidth / 2 + cardWidth / 2;

    this.cardHand.forEach((type, index) => {
      const x = startX + index * (cardWidth + gap);
      this.createCardAt(index, x, type, cardWidth, cardHeight);
    });
  }

  private createCardAt(index: number, x: number, type: Exclude<BuildingType, 'wall'>, cardWidth: number, cardHeight: number): void {
    const isSelected = index === this.selectedCardIndex;
    const canAffordThis = canBuild(this.wallet, type);

    let bgColor: number;
    let strokeColor: number;
    let strokeWidth: number;
    let strokeAlpha: number;
    let bgAlpha: number;
    let labelColor: string;
    let costColor: string;

    if (isSelected) {
      bgColor = 0x3a3020;
      strokeColor = 0xd4a843;
      strokeWidth = 2;
      strokeAlpha = 1;
      bgAlpha = 0.95;
      labelColor = '#facc15';
      costColor = '#e0d8c8';
    } else if (canAffordThis) {
      bgColor = 0x3a3020;
      strokeColor = 0x5a4a38;
      strokeWidth = 1;
      strokeAlpha = 0.6;
      bgAlpha = 0.95;
      labelColor = '#e0d8c8';
      costColor = '#8a7a68';
    } else {
      bgColor = 0x1a1510;
      strokeColor = 0x3a3528;
      strokeWidth = 1;
      strokeAlpha = 0.3;
      bgAlpha = 0.6;
      labelColor = '#5a5048';
      costColor = '#4a4038';
    }

    const panelBg = this.add.rectangle(x, 0, cardWidth, cardHeight, bgColor, bgAlpha);
    panelBg.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);

    if (canAffordThis) {
      panelBg.setInteractive({ useHandCursor: true });
      panelBg.on('pointerover', () => {
        if (index !== this.selectedCardIndex) panelBg.setFillStyle(0x4a4030, 1);
      });
      panelBg.on('pointerout', () => {
        if (index !== this.selectedCardIndex) panelBg.setFillStyle(bgColor, bgAlpha);
      });
      panelBg.on('pointerdown', () => this.onCardClicked(index));
    } else {
      panelBg.disableInteractive();
    }

    const def = BUILDING_DEFINITIONS[type];
    const label = this.add.text(x, -12, `${def.shortLabel} ${def.name}`, {
      color: labelColor, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px',
    });
    label.setOrigin(0.5);
    label.setAlpha(isSelected ? 1 : canAffordThis ? 1 : 0.5);

    const cost = this.add.text(x, 6, getCatalogCostText(type), {
      color: costColor, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '10px',
    });
    cost.setOrigin(0.5);
    cost.setAlpha(isSelected ? 1 : canAffordThis ? 1 : 0.5);

    this.cardPanels.push(panelBg);
    this.cardLabels.push(label);
    this.cardCosts.push(cost);
    this.cardHandContainer?.add([panelBg, label, cost]);
  }

  /** Update affordability colors on existing cards without recreating them */
  private refreshCardAffordability(): void {
    if (this.cardHand.length === 0 || this.cardPanels.length === 0) return;

    const cardWidth = 90;
    const gap = 10;
    const totalWidth = this.cardHand.length * (cardWidth + gap) - gap;
    let startX = -totalWidth / 2 + cardWidth / 2;

    this.cardHand.forEach((type, index) => {
      if (index >= this.cardPanels.length) return;
      const canAffordThis = canBuild(this.wallet, type);
      const isSelected = index === this.selectedCardIndex;
      const panelBg = this.cardPanels[index];
      const label = this.cardLabels[index];
      const cost = this.cardCosts[index];

      if (canAffordThis && !isSelected) {
        panelBg.setFillStyle(0x3a3020, 0.95);
        panelBg.setStrokeStyle(1, 0x5a4a38, 0.6);
        label.setAlpha(1);
        cost.setAlpha(1);
        label.setColor('#e0d8c8');
        cost.setColor('#8a7a68');
        panelBg.setInteractive({ useHandCursor: true });
      } else if (isSelected) {
        panelBg.setFillStyle(0x3a3020, 0.95);
        panelBg.setStrokeStyle(2, 0xd4a843, 1);
        label.setAlpha(1);
        cost.setAlpha(1);
        label.setColor('#facc15');
        cost.setColor('#e0d8c8');
        panelBg.disableInteractive();
      } else {
        panelBg.setFillStyle(0x1a1510, 0.6);
        panelBg.setStrokeStyle(1, 0x3a3528, 0.3);
        label.setAlpha(0.5);
        cost.setAlpha(0.5);
        label.setColor('#5a5048');
        cost.setColor('#4a4038');
        panelBg.disableInteractive();
      }
    });
  }

  private addCardToHand(type: Exclude<BuildingType, 'wall'>): void {
    this.cardHand.push(type);
    if (this.cardHandContainer) this.rebuildCardHand();
  }

  private onCardClicked(index: number): void {
    if (index === this.selectedCardIndex) {
      this.deselectCard();
    } else {
      this.selectCard(index);
    }
  }

  private selectCard(index: number): void {
    // Close any open build menu first
    this.hideBuildMenu();
    this.destroyBuildSlotHighlights();

    this.selectedCardIndex = index;
    this.buildMode = true;
    const type = this.cardHand[index];
    const def = BUILDING_DEFINITIONS[type];
    this.showFeedback(`点击空地放置 ${def.name}`, '#d4a843');
    this.createBuildSlotHighlights();
    this.rebuildCardHand();
  }

  private deselectCard(): void {
    this.selectedCardIndex = -1;
    this.buildMode = false;
    this.destroyBuildSlotHighlights();
    this.hideBuildMenu();
    this.rebuildCardHand();
  }

  private placeCard(slot: BuildSlot): void {
    if (this.selectedCardIndex < 0 || this.selectedCardIndex >= this.cardHand.length) return;
    const type = this.cardHand[this.selectedCardIndex];
    const center = this.getSlotCenter(slot);

    const result = spendBuildingCost(this.wallet, type);
    if (!result.ok) {
      this.showFeedback(`资源不足：${getCatalogCostText(type)}`, '#c8a860');
      return;
    }
    this.wallet = result.wallet;
    this.buildTower(slot, center, type);

    // Remove the used card
    this.cardHand.splice(this.selectedCardIndex, 1);
    this.deselectCard();
  }

  private showGameOver(): void {
    this.gameOver = true;
    this.screenShake();
    const stats: GameStats = {
      wavesSurvived: this.waveState.currentWave, timeElapsed: this.elapsedSeconds,
      enemiesKilled: this.totalEnemiesKilled, towersBuilt: this.totalTowersBuilt,
      woodGathered: this.totalWoodGathered, stoneGathered: this.totalStoneGathered,
      wallsBuilt: this.totalWallsBuilt,
    };
    const dpsRows = formatBuildingDpsRows(this.results, this.elapsedSeconds).slice(0, 6).join('\n');
    const resultText = `英雄伤害：${Math.floor(this.results.heroDamage)}\n行城建筑伤害：${Math.floor(this.results.cityDamage)}\n${dpsRows}`;
    const text = `行城陷落\n\n${formatVictoryStats(stats, false)}\n\n${resultText}\n\n按 R 重新开始`;
    this.gameOverText = this.add.text(640, 320, text, {
      align: 'center', color: '#fee2e2', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '24px', lineSpacing: 6,
    });
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setScrollFactor(0);
    this.gameOverText.setDepth(OVERLAY_DEPTH);
  }

  private showVictory(): void {
    this.victoryAchieved = true;
    this.gameOver = true;
    const stats: GameStats = {
      wavesSurvived: this.waveState.currentWave, timeElapsed: this.elapsedSeconds,
      enemiesKilled: this.totalEnemiesKilled, towersBuilt: this.totalTowersBuilt,
      woodGathered: this.totalWoodGathered, stoneGathered: this.totalStoneGathered,
      wallsBuilt: this.totalWallsBuilt,
    };
    const dpsRows = formatBuildingDpsRows(this.results, this.elapsedSeconds).slice(0, 6).join('\n');
    const resultText = `英雄伤害：${Math.floor(this.results.heroDamage)}\n行城建筑伤害：${Math.floor(this.results.cityDamage)}\n${dpsRows}`;
    const text = `胜利！\n\n${formatVictoryStats(stats, true)}\n\n${resultText}\n\n按 R 再来一局`;
    this.victoryText = this.add.text(640, 300, text, {
      align: 'center', color: '#bbf7d0', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '24px', lineSpacing: 6,
    });
    this.victoryText.setOrigin(0.5);
    this.victoryText.setScrollFactor(0);
    this.victoryText.setDepth(OVERLAY_DEPTH);
  }
}
