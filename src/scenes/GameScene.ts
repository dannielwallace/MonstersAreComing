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
  WEAPON_DEFINITIONS,
  markWeaponFired,
  updateWeaponTimers,
  type WeaponState,
  type WeaponType,
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
  createRouteEventState,
  createRouteForkState,
  createRewardCircle,
  updateRewardCircle,
  type RouteEvent,
  type RouteEventState,
  type RouteFork,
  type RouteModifier,
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
  CARAVAN_GRID_SIZE,
  GRID_BUILD_SLOTS,
  getBuildingName,
  getBuildingCostText,
  type BuildingType,
  type BuildSlot,
} from '../game/buildSlots';
import { applyDamage, selectHighestHealthTarget, selectNearestTarget } from '../game/combat';
import { buildForwardCells, computeForwardEdge, isObstacleBlocking, type ForwardCell } from '../game/caravanMovement';
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
const GATHER_RANGE = 45;
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
/** Enemies stop at this distance from caravan center (caravan half-size 48 + margin) */
const CARAVAN_BLOCK_RANGE = 56;
/** Distance threshold for enemy separation */
const ENEMY_SEPARATION_DIST = 18;
const TOWER_BLOCK_RANGE = 20;
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

interface GoldRenderedNode {
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

interface PooledProjectile {
  circle: Phaser.GameObjects.Arc;
  flash?: Phaser.GameObjects.Arc;
  active: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  duration: number;
  color: number;
  radius: number;
  hasSplash: boolean;
  splashRadius: number;
  useArc: boolean;
  rotationSpeed: number;
}

interface PooledSplash {
  circle: Phaser.GameObjects.Arc;
  active: boolean;
  timer: number;
  duration: number;
  maxRadius: number;
}

const PROJECTILE_POOL_SIZE = 80;
const SPLASH_POOL_SIZE = 30;
const CARAVAN_UPDATE_INTERVAL = 0.15;

type GameKey = 'W' | 'A' | 'S' | 'D' | 'B' | 'R' | 'ONE' | 'TWO' | 'THREE' | 'SPACE' | 'ESCAPE' | 'P' | 'NINE';

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
  private upgradeCards: Phaser.GameObjects.Rectangle[] = [];
  private upgradeTexts: Phaser.GameObjects.Text[] = [];
  private forkSelecting = false;
  private forkOverlay?: Phaser.GameObjects.Container;
  private forkButtons: Phaser.GameObjects.Rectangle[] = [];
  private forkTexts: Phaser.GameObjects.Text[] = [];
  private forkTitle?: Phaser.GameObjects.Text;
  private forkChoices: { label: string; description: string; modifier: RouteModifier }[] = [];
  private currentFork?: RouteFork;
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
  private totalGoldGathered = 0;
  private totalWallsBuilt = 0;
  private totalTowersBuilt = 0;
  private resourceSpawner: ResourceSpawnerState = createResourceSpawnerState();
  private woodRenderedNodes: RenderedNode[] = [];
  private stoneRenderedNodes: StoneRenderedNode[] = [];
  private goldRenderedNodes: GoldRenderedNode[] = [];
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
  private cardHand: BuildingType[] = [];
  private cardPanels: Phaser.GameObjects.Rectangle[] = [];  // interactive backgrounds
  private cardLabels: Phaser.GameObjects.Text[] = [];
  private cardCosts: Phaser.GameObjects.Text[] = [];
  private selectedCardIndex = -1;

  // HUD panels
  private healthPanel?: Phaser.GameObjects.Container;
  private healthBgRect?: Phaser.GameObjects.Rectangle;
  private healthBar?: Phaser.GameObjects.Rectangle;
  private healthBarBg?: Phaser.GameObjects.Rectangle;
  private healthText?: Phaser.GameObjects.Text;
  private healthLabel?: Phaser.GameObjects.Text;
  private divider1?: Phaser.GameObjects.Rectangle;
  private buildingLabel?: Phaser.GameObjects.Text;
  private heroLabel?: Phaser.GameObjects.Text;
  private weaponPrefix?: Phaser.GameObjects.Text;
  private weaponLineText?: Phaser.GameObjects.Text;
  private statsPrefix?: Phaser.GameObjects.Text;
  private statsLineText?: Phaser.GameObjects.Text;
  private towerCountText?: Phaser.GameObjects.Text;
  private wallCountText?: Phaser.GameObjects.Text;
  private fpsText?: Phaser.GameObjects.Text;
  private obstacleText?: Phaser.GameObjects.Text;
  private blockedWarning?: Phaser.GameObjects.Container;
  private blockedWarningBg?: Phaser.GameObjects.Rectangle;
  private blockedWarningText?: Phaser.GameObjects.Text;
  private blockedWarningGlow?: Phaser.GameObjects.Rectangle;
  private frameCount = 0;
  private lastFpsTime = 0;
  private currentFps = 0;
  private _lastBlockerInfo = '无障碍';
  private _lastForwardEdge = 0;
  private hudThrottle = 0;
  private wavePanel?: Phaser.GameObjects.Container;
  private waveText?: Phaser.GameObjects.Text;
  private xpBarBg?: Phaser.GameObjects.Rectangle;
  private xpBarFill?: Phaser.GameObjects.Rectangle;
  private xpText?: Phaser.GameObjects.Text;
  private resourcePanel?: Phaser.GameObjects.Container;
  private shopButton?: Phaser.GameObjects.Rectangle;
  private shopLabel?: Phaser.GameObjects.Text;
  private walletText?: Phaser.GameObjects.Text;
  private carriedText?: Phaser.GameObjects.Text;
  private routeIndicatorText?: Phaser.GameObjects.Text;

  // P1 systems
  private shop?: ShopState;
  private shopOverlay?: Phaser.GameObjects.Container;
  private shopOverlayBg?: Phaser.GameObjects.Rectangle;
  private shopOverlayButtons: Phaser.GameObjects.Rectangle[] = [];
  private shopOverlayTexts: Phaser.GameObjects.Text[] = [];
  private shopOpen = false;
  private nextShopAtSeconds = 180;
  private weapons: WeaponState = createWeaponState();
  private summons: SummonState = createSummonState();
  private minionVisuals: Map<string, Phaser.GameObjects.Container> = new Map();
  private minionPositions: Map<string, Phaser.Types.Math.Vector2Like> = new Map();
  private routeEvents: RouteEventState = createRouteEventState();
  private routeForks: RouteFork[] = createRouteForkState();
  private routeModifier: RouteModifier = 'balanced';
  private boss: BossState = createBossState();
  private bossStarted = false;
  private results: RunResults = createRunResults();
  private eventVisuals: Map<string, Phaser.GameObjects.Container> = new Map();
  private eventCountdownRings: Map<string, Phaser.GameObjects.Graphics> = new Map();

  // Projectile pooling
  private projectilePool: PooledProjectile[] = [];
  private splashPool: PooledSplash[] = [];
  private caravanUpdateTimer = 0;
  private _caravanBlocked = false;
  private _caravanMoveAmount = 0;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.resetState();
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, 720);

    this.createTerrain();
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
      NINE: Phaser.Input.Keyboard.KeyCodes.NINE,
    }) as Record<GameKey, Phaser.Input.Keyboard.Key>;

    this.createInitialWoodNodes();
    this.createInitialStoneNodes();
    this.createInitialGoldNodes();
    this.createInitialRewardCircles();
    this.addCardToHand('arrow');

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

    // Dev shortcut: press 9 to open shop
    if (!this.shopOpen && !this.upgradeSelecting && !this.gameOver && Phaser.Input.Keyboard.JustDown(this.keys.NINE)) {
      this.nextShopAtSeconds = this.elapsedSeconds;
      this.maybeOpenShop();
    }

    // Pause toggle (ESC only if no card selected, P always works)
    if (!this.gameOver && Phaser.Input.Keyboard.JustDown(this.keys.P)) {
      if (!this.upgradeSelecting) {
        this.togglePause();
      }
    }
    if (!this.gameOver && this.selectedCardIndex < 0 && Phaser.Input.Keyboard.JustDown(this.keys.ESCAPE)) {
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

    if (this.forkSelecting) {
      this.updateForkInput();
      return;
    }

    this.checkRouteForks();
    this.handleBuildModeToggle();

    this.elapsedSeconds += deltaSeconds;
    this.updatePlayer(deltaSeconds);
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
    this.updateTowers(deltaSeconds);
    this.updateEnemies(deltaSeconds);
    // Caravan movement check runs AFTER combat so killed enemies don't block
    this.updateCaravan(deltaSeconds);
    this.updateDebugHud();
    this.updateCamera();
    this.updateFloatingTexts(deltaSeconds);
    this.updateFeedback(deltaSeconds);
    this.updateWaveBanner(deltaSeconds);
    this.applyPendingWallRepair();
    this.updatePooledProjectiles(deltaMs);
    this.updatePooledSplashes(deltaMs);
    this.hudThrottle += deltaSeconds;
    if (this.hudThrottle >= 0.25) {
      this.updateHudPanels();
      this.hudThrottle = 0;
    }

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
    this.totalGoldGathered = 0;
    this.totalWallsBuilt = 0;
    this.totalTowersBuilt = 0;
    this.resourceSpawner = createResourceSpawnerState();
    this.woodRenderedNodes = [];
    this.stoneRenderedNodes = [];
    this.goldRenderedNodes = [];
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
    this.routeForks = createRouteForkState();
    this.routeModifier = 'balanced';
    this.forkSelecting = false;
    this.hideForkOverlay();
    this.boss = createBossState();
    this.bossStarted = false;
    this.results = createRunResults();
    for (const visual of this.eventVisuals.values()) visual.destroy(true);
    this.eventVisuals.clear();
    for (const ring of this.eventCountdownRings.values()) ring.destroy();
    this.eventCountdownRings.clear();

    // Initialize projectile pools (only on first call)
    if (this.projectilePool.length === 0) {
      for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
        const circle = this.add.circle(0, 0, 4, 0xffffff, 0);
        circle.setDepth(16);
        circle.setActive(false);
        this.projectilePool.push({
          circle, flash: undefined, active: false,
          fromX: 0, fromY: 0, toX: 0, toY: 0,
          progress: 0, duration: 0, color: 0xffffff, radius: 4,
          hasSplash: false, splashRadius: 0, useArc: false, rotationSpeed: 0,
        });
      }
      for (let i = 0; i < SPLASH_POOL_SIZE; i++) {
        const circle = this.add.circle(0, 0, 10, 0xff9800, 0);
        circle.setStrokeStyle(2, 0xff9800, 0);
        circle.setDepth(15);
        circle.setActive(false);
        this.splashPool.push({ circle, active: false, timer: 0, duration: 0, maxRadius: 0 });
      }
    } else {
      // Reset all pool entries
      for (const proj of this.projectilePool) {
        proj.active = false;
        proj.circle.setVisible(false);
        proj.circle.setActive(false);
        if (proj.flash) {
          proj.flash.setVisible(false);
          proj.flash.setActive(false);
        }
      }
      for (const splash of this.splashPool) {
        splash.active = false;
        splash.circle.setVisible(false);
        splash.circle.setActive(false);
      }
    }
    this.caravanUpdateTimer = 0;
    this._caravanBlocked = false;
    this._caravanMoveAmount = 0;
  }

  // ═══════════════════════════════════════════════════
  // TERRAIN & ROAD (暗黑森林风格)
  // ═══════════════════════════════════════════════════

  private createTerrain(): void {
    // Bake static scenery into tiled canvas textures to stay within WebGL
    // max texture size (~4096px). Each tile covers a strip of the world.
    const TILE_W = 4096;
    const numTiles = Math.ceil(WORLD_WIDTH / TILE_W);

    // Seed RNG deterministically so each tile matches across calls
    // (We just need a consistent random source per-tile, so we create
    // one RNG per tile using a simple linear congruential generator)
    function seededRandom(seed: number) {
      let s = seed;
      return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    }

    for (let t = 0; t < numTiles; t++) {
      const offsetX = t * TILE_W;
      const g = this.make.graphics();
      const rng = seededRandom(t * 7919 + 1);

      // 暗色森林地面
      g.fillStyle(0x2a3a28, 0.95);
      g.fillRect(0, 0, TILE_W, 720);

      // 地面纹理变化
      for (let x = 0; x < TILE_W; x += 60) {
        for (let i = 0; i < 4; i++) {
          const gx = x + rng() * 60;
          const gy = 30 + rng() * 660;
          g.fillStyle(0x2a3a28, 0.3 + rng() * 0.2);
          g.fillCircle(gx, gy, 15 + rng() * 25);
        }
      }

      // 远处枯树
      for (let x = 0; x < TILE_W; x += 200) {
        const treeSide = rng() > 0.5 ? 1 : -1;
        const treeY = treeSide > 0 ? 80 + rng() * 200 : 480 + rng() * 160;
        const treeX = offsetX + x + rng() * 100;
        // Draw relative to tile origin
        const rx = treeX - offsetX;
        const s = 0.6 + rng() * 0.4;
        g.fillStyle(0x1a2a18, 0.6);
        g.fillRect(rx - 2 * s, treeY - 30 * s, 4 * s, 30 * s);
        g.fillRect(rx - 16 * s, treeY - 28 * s, 16 * s, 2 * s);
        g.fillRect(rx, treeY - 20 * s, 14 * s, 2 * s);
        g.fillRect(rx - 10 * s, treeY - 36 * s, 2 * s, 12 * s);
        g.fillStyle(0x2a3a28, 0.3);
        g.fillCircle(rx - 14 * s, treeY - 30 * s, 6 * s);
        g.fillCircle(rx + 8 * s, treeY - 22 * s, 5 * s);
      }

      // 土路
      g.fillStyle(0x3a3020, 0.9);
      g.fillRect(0, 310, TILE_W, 100);
      g.fillStyle(0x4a4030, 0.5);
      g.fillRect(0, 306, TILE_W, 4);
      g.fillRect(0, 410, TILE_W, 4);
      for (let x = 0; x < TILE_W; x += 80) {
        g.fillStyle(0x2a2018, 0.4);
        g.fillCircle(x + rng() * 40, 340 + rng() * 40, 3 + rng() * 5);
      }
      for (let x = 0; x < TILE_W; x += 40) {
        if (rng() > 0.4) {
          g.fillStyle(0x2a1a10, 0.3);
          g.fillRect(x + rng() * 20, 350 + rng() * 20, 12 + rng() * 8, 1.5);
        }
      }
      for (let x = 0; x < TILE_W; x += 40) {
        for (let side = -1; side <= 1; side += 2) {
          if (rng() > 0.5) continue;
          const gx = x + rng() * 30;
          const gy = side > 0 ? 295 + rng() * 10 : 415 + rng() * 10;
          g.lineStyle(1, 0x3a4a2a, 0.4);
          g.lineBetween(gx, gy, gx + (rng() - 0.5) * 6, gy - 8 - rng() * 6);
        }
      }

      // Medieval ruins
      for (let x = 300; x < TILE_W; x += 600 + rng() * 400) {
        const side = rng() > 0.5 ? 1 : -1;
        const ruinY = side > 0 ? 260 + rng() * 30 : 440 + rng() * 30;
        const rx = x + rng() * 100;
        const ruinType = Math.floor(rng() * 3);
        const s = 0.8 + rng() * 0.4;
        g.fillStyle(0x5a5048, 0.4);
        if (ruinType === 0) {
          const w = 20 + rng() * 30;
          const h = 30 + rng() * 40;
          g.fillRect(rx, ruinY - h * s, w * s, h * s);
        } else if (ruinType === 1) {
          const archW = 30 + rng() * 20;
          const archH = 40 + rng() * 15;
          g.fillRect(rx, ruinY - archH * s, 6 * s, archH * s);
          g.fillRect(rx + archW * s, ruinY - archH * s, 6 * s, archH * s);
          g.fillRect(rx, ruinY - archH * s, archW * s + 6 * s, 6 * s);
        } else {
          const tw = 15 + rng() * 10;
          const th = 40 + rng() * 25;
          g.fillRect(rx, ruinY - th * s, tw * s, th * s);
          g.fillRect(rx - 8 * s, ruinY - th * s - 4 * s, tw * s + 16 * s, 6 * s);
          g.fillStyle(0x2a1a18, 0.5);
          g.fillRect(rx + 4 * s, ruinY - th * s + 10 * s, 5 * s, 6 * s);
        }
      }

      // Resource clusters
      for (let x = 500; x < TILE_W; x += 800 + rng() * 600) {
        const clusterX = x + rng() * 200;
        const count = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < count; i++) {
          const cx = clusterX + i * 50 + rng() * 30;
          const cy = 180 + rng() * 60 + (rng() > 0.5 ? 300 : 0);
          if (rng() > 0.5) {
            g.fillStyle(0x3a2a18, 0.35);
            g.fillCircle(cx, cy, 6 + rng() * 4);
          } else {
            g.fillStyle(0x5a5a5a, 0.25);
            g.fillCircle(cx, cy, 4 + rng() * 5);
          }
        }
      }

      // Terrain variety
      for (let x = 0; x < TILE_W; x += 300) {
        const variant = rng();
        if (variant < 0.3) {
          const px = x + rng() * 150;
          const py = 100 + rng() * 520;
          g.fillStyle(0x1a2a18, 0.2);
          g.fillCircle(px, py, 40 + rng() * 30);
        } else if (variant < 0.5) {
          const px = x + rng() * 150;
          const py = 100 + rng() * 520;
          for (let r = 0; r < 3; r++) {
            g.fillStyle(0x5a5a5a, 0.3);
            g.fillCircle(px + rng() * 40 - 20, py + rng() * 20 - 10, 3 + rng() * 6);
          }
        } else if (variant < 0.6) {
          const px = x + rng() * 150;
          g.fillStyle(0x3a4a30, 0.15);
          g.fillCircle(px, 360 + (rng() - 0.5) * 300, 80 + rng() * 40);
        }
      }

      // Roadside debris
      for (let x = 0; x < TILE_W; x += 150) {
        if (rng() > 0.6) continue;
        const dx = x + rng() * 80;
        const side = rng() > 0.5 ? 1 : -1;
        const dy = side > 0 ? 300 + rng() * 8 : 420 + rng() * 8;
        const debrisType = rng();
        if (debrisType < 0.3) {
          g.fillStyle(0xc8c0b0, 0.25);
          g.fillRect(dx, dy, 8 + rng() * 6, 2);
        } else if (debrisType < 0.6) {
          g.fillStyle(0x6a4a3a, 0.2);
          g.fillTriangle(dx - 5, dy + 5, dx + 5, dy + 5, dx, dy - 7);
        } else {
          g.fillStyle(0x7a7568, 0.2);
          g.fillCircle(dx, dy, 4 + rng() * 4);
        }
      }

      g.generateTexture(`terrain-${t}`, TILE_W, 720);
      g.destroy();

      const actualTileW = Math.min(TILE_W, WORLD_WIDTH - offsetX);
      const img = this.add.image(offsetX + actualTileW / 2, 360, `terrain-${t}`).setDepth(0);
      img.setScrollFactor(0);
      img.setDisplaySize(actualTileW, 720);
      img.setOrigin(0.5, 0.5);
    }
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

  private createInitialGoldNodes(): void {
    const nodes = [
      { x: 500, y: 350, amount: 8 },
      { x: 1000, y: 300, amount: 10 },
    ];
    for (const node of nodes) this.createGoldNodeVisual(node.x, node.y, node.amount);
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

    // Reuse spawner's node if it exists (dynamic spawn), otherwise create new (initial node)
    const existing = this.resourceSpawner.woodNodes.find(n => n.position.x === x && n.position.y === y && n.remaining === amount);
    const node = existing ?? { id: `wood-${this.resourceSpawner.nextId++}`, position: { x, y }, remaining: amount, maxAmount: amount, type: 'wood', radius: 18, color: 0x4caf50 };
    if (!existing) this.resourceSpawner.woodNodes.push(node);
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

    // Reuse spawner's node if it exists (dynamic spawn), otherwise create new (initial node)
    const existing = this.resourceSpawner.stoneNodes.find(n => n.position.x === x && n.position.y === y && n.remaining === amount);
    const node = existing ?? { id: `stone-${this.resourceSpawner.nextId++}`, position: { x, y }, remaining: amount, maxAmount: amount, type: 'stone', radius: 14, color: 0x78909c };
    if (!existing) this.resourceSpawner.stoneNodes.push(node);
    const rendered: StoneRenderedNode = { node, shape: container, label, gatherTimer: 0 };
    this.stoneRenderedNodes.push(rendered);
    return rendered;
  }

  private createGoldNodeVisual(x: number, y: number, amount: number): GoldRenderedNode {
    const container = this.add.container(x, y);
    container.setDepth(3);

    // 金黄色矿块（相对坐标）
    const g1 = this.add.rectangle(-3, 4, 16, 12, 0xb8960f);
    const g2 = this.add.rectangle(5, -1, 14, 14, 0xd4a820);
    const g3 = this.add.rectangle(1, -9, 10, 10, 0xf0c840);
    g1.setStrokeStyle(1.5, 0x8a7a10, 0.7);
    g2.setStrokeStyle(1.5, 0x8a7a10, 0.7);
    g3.setStrokeStyle(1.5, 0x8a7a10, 0.7);
    container.add([g1, g2, g3]);

    const label = this.add.text(0, -26, `${amount}`, {
      color: '#d4a843',
      fontFamily: 'monospace',
      fontSize: '11px',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    label.setDepth(6);

    // Reuse spawner's node if it exists (dynamic spawn), otherwise create new (initial node)
    const existing = this.resourceSpawner.goldNodes.find(n => n.position.x === x && n.position.y === y && n.remaining === amount);
    const node = existing ?? { id: `gold-${this.resourceSpawner.nextId++}`, position: { x, y }, remaining: amount, maxAmount: amount, type: 'gold', radius: 12, color: 0xd4a820 };
    if (!existing) this.resourceSpawner.goldNodes.push(node);
    const rendered: GoldRenderedNode = { node, shape: container, label, gatherTimer: 0 };
    this.goldRenderedNodes.push(rendered);
    return rendered;
  }

  private updateResourceSpawning(deltaSeconds: number): void {
    const camera = this.cameras.main;
    const caravanCenter = getCaravanCenter(this.caravanTopLeft);
    const { spawned } = updateResourceSpawner(this.resourceSpawner, caravanCenter.x, camera.worldView.right, camera.worldView.left, 720, Math.random);

    for (const node of spawned) {
      if (node.type === 'wood') this.createWoodNodeVisual(node.position.x, node.position.y, node.remaining);
      else if (node.type === 'stone') this.createStoneNodeVisual(node.position.x, node.position.y, node.remaining);
      else this.createGoldNodeVisual(node.position.x, node.position.y, node.remaining);
    }

    this.removeDepletedWoodNodes();
    this.removeDepletedStoneNodes();
    this.removeDepletedGoldNodes();
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

  private removeDepletedGoldNodes(): void {
    for (const d of collectDepletedNodes(this.resourceSpawner.goldNodes)) {
      const idx = this.goldRenderedNodes.findIndex((r) => r.node.id === d.id);
      if (idx >= 0) {
        const r = this.goldRenderedNodes[idx];
        r.shape.destroy(); r.label.destroy();
        this.goldRenderedNodes.splice(idx, 1);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // GATHERING
  // ═══════════════════════════════════════════════════

  private updateGathering(deltaSeconds: number): void {
    let gatheredThisFrame = false;

    for (const rendered of this.woodRenderedNodes) {
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
          const gathered = Math.floor(result.gathered.amount);
          if (gathered > 0) {
            const label = result.gathered.type === 'wood' ? '木' : result.gathered.type === 'stone' ? '石' : '金';
            this.showFloatingResource(node.position.x, node.position.y - 20, `+${gathered}${label}`, '#c0d8a0');
          }
        }
        rendered.gatherTimer = 0;
      }
      rendered.label.setText(`${Math.ceil(Math.max(0, node.remaining))}`);
      // 采集时脉动效果
      const pulse = 1 + Math.sin(rendered.gatherTimer * 10) * 0.12;
      rendered.container.setScale(pulse);
      rendered.container.setAlpha(0.85 + Math.sin(rendered.gatherTimer * 10) * 0.15);
    }

    for (const rendered of this.stoneRenderedNodes) {
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
          const gathered = Math.floor(result.gathered.amount);
          if (gathered > 0) {
            this.showFloatingResource(node.position.x, node.position.y - 20, `+${gathered}石`, '#b0a898');
          }
        }
        rendered.gatherTimer = 0;
      }
      rendered.label.setText(`${Math.ceil(Math.max(0, node.remaining))}`);
      rendered.shape.setAlpha(0.8 + Math.sin(rendered.gatherTimer * 10) * 0.2);
    }

    for (const rendered of this.goldRenderedNodes) {
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
        this.totalGoldGathered += result.gathered.amount;
        if (result.gathered.amount > 0) {
          gatheredThisFrame = true;
          const gathered = Math.floor(result.gathered.amount);
          if (gathered > 0) {
            this.showFloatingResource(node.position.x, node.position.y - 20, `+${gathered}金`, '#d4a843');
          }
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
    // Route modifier affects wave pace: combat-heavy = faster waves, resource-rich = slower
    const paceMult = this.routeModifier === 'combat-heavy' ? 1.3 : this.routeModifier === 'resource-rich' ? 0.75 : 1;
    const adjustedDelta = deltaSeconds * paceMult;
    const result = updateWaveState(this.waveState, adjustedDelta);
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

      // 1) Wall block
      let blockedByWall: Wall | undefined;
      let minWallDist = Number.POSITIVE_INFINITY;
      const wallBlockThreshold = (enemy.radius + WALL_BLOCK_RANGE) * (enemy.radius + WALL_BLOCK_RANGE);
      for (const wall of this.walls) {
        const dx = enemy.position.x - wall.position.x;
        const dy = enemy.position.y - wall.position.y;
        const wallDist = dx * dx + dy * dy;
        if (wallDist <= wallBlockThreshold && wallDist < minWallDist) {
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

      // 2) Tower / building block — enemies attack buildings in their path
      let blockedByTower: Tower | undefined;
      let minTowerDist = Number.POSITIVE_INFINITY;
      const towerBlockThreshold = (enemy.radius + TOWER_BLOCK_RANGE) * (enemy.radius + TOWER_BLOCK_RANGE);
      for (const tower of this.towers) {
        if (tower.type === 'attack-banner' || tower.type === 'speed-banner') continue;
        const dx = enemy.position.x - tower.position.x;
        const dy = enemy.position.y - tower.position.y;
        const towerDist = dx * dx + dy * dy;
        if (towerDist <= towerBlockThreshold && towerDist < minTowerDist) {
          blockedByTower = tower; minTowerDist = towerDist;
        }
      }

      if (blockedByTower) {
        // Move toward tower, then stop and attack it
        const dist = Math.sqrt(distanceSquared(enemy.position, blockedByTower.position));
        const stopDist = enemy.radius + TOWER_BLOCK_RANGE;
        if (dist > stopDist) {
          enemy.position = moveToward(enemy.position, blockedByTower.position, enemy.speed * deltaSeconds);
        }
        // Damage the tower
        const towerDef = BUILDING_DEFINITIONS[blockedByTower.type];
        const towerDmg = Math.max(1, Math.round(towerDef.damage * 0.3));
        blockedByTower.base.setData('health', (blockedByTower.base.getData('health') ?? towerDef.damage * 5) - towerDmg);
        if ((blockedByTower.base.getData('health') ?? 0) <= 0) {
          blockedByTower.base.destroy(true);
          blockedByTower.label.destroy();
          blockedByTower.rangeShape.destroy();
          this.towers = this.towers.filter((t) => t.id !== blockedByTower!.id);
        }
        continue;
      }

      // 3) Caravan block — stop at caravan edge, not the center
      const distToCaravan = Math.sqrt(distanceSquared(enemy.position, caravanCenter));
      if (distToCaravan <= CARAVAN_BLOCK_RANGE) {
        // Attack caravan
        if (enemy.damageTimer <= 0) {
          this.stats.caravanHealth = Math.max(0, this.stats.caravanHealth - enemy.contactDamage);
          enemy.damageTimer = ENEMY_DAMAGE_COOLDOWN;
          this.caravanDamageFlashTimer = DAMAGE_FLASH_DURATION;
          this.screenShake();
          this.showDamageNumber(caravanCenter.x, caravanCenter.y - 50, enemy.contactDamage);
        }
        continue;
      }

      // 4) Enemy separation — push apart when too close
      // Use squared distance early-exit to skip Math.hypot for far-away pairs
      const sepDistSq = ENEMY_SEPARATION_DIST * ENEMY_SEPARATION_DIST;
      let sepX = 0;
      let sepY = 0;
      for (const other of this.enemies) {
        if (other.id === enemy.id) continue;
        const dx = enemy.position.x - other.position.x;
        const dy = enemy.position.y - other.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= sepDistSq || distSq === 0) continue;
        const dist = Math.sqrt(distSq);
        const push = (ENEMY_SEPARATION_DIST - dist) / ENEMY_SEPARATION_DIST * 1.5;
        sepX += (dx / dist) * push;
        sepY += (dy / dist) * push;
      }

      // Move toward caravan, with separation
      const moveTarget = {
        x: caravanCenter.x + sepX,
        y: caravanCenter.y + sepY,
      };
      enemy.position = moveToward(enemy.position, moveTarget, enemy.speed * deltaSeconds);
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
    const placed: PlacedBuilding[] = [];
    for (const t of this.towers) placed.push({ slotId: t.slotId, type: t.type });

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

      // Compute adjacency bonus only when tower is about to fire
      const adjacency = computeAdjacencyBonus(tower.slotId, GRID_BUILD_SLOTS, placed);
      const isArrowType = tower.type === 'arrow';
      const baseDamage = definition.damage;
      const towerDmgBonus = isArrowType ? this.stats.towerDamage : 0;
      const aliveMinionBonus = this.summons.minions.length * this.stats.summonAliveTowerDamage;
      const damage = (baseDamage + towerDmgBonus + aliveMinionBonus) * adjacency.damageMultiplier;
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
          const splashSq = definition.splashRadius * definition.splashRadius;
          const tPos = target.position;
          for (const enemy of this.enemies) {
            if (enemy.id === (target as any).id) continue;
            const dx = enemy.position.x - tPos.x;
            const dy = enemy.position.y - tPos.y;
            if (dx * dx + dy * dy <= splashSq) {
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
        const splashSq = definition.splashRadius * definition.splashRadius;
        const tPos = target.position;
        for (const enemy of this.enemies) {
          if (enemy.id === target.id) continue;
          const dx = enemy.position.x - tPos.x;
          const dy = enemy.position.y - tPos.y;
          if (dx * dx + dy * dy <= splashSq) {
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
  // PROJECTILES (pooled, no tweens)
  // ═══════════════════════════════════════════════════

  private spawnPooledProjectile(
    from: Point, to: Point, color: number, radius: number,
    duration: number, useArc = false, rotationSpeed = 0,
  ): void {
    const proj = this.projectilePool.find((p) => !p.active);
    if (!proj) return; // pool exhausted, skip visual
    proj.active = true;
    proj.fromX = from.x; proj.fromY = from.y;
    proj.toX = to.x; proj.toY = to.y;
    proj.progress = 0;
    proj.duration = duration;
    proj.color = color;
    proj.radius = radius;
    proj.useArc = useArc;
    proj.rotationSpeed = rotationSpeed;
    proj.circle.setPosition(from.x, from.y);
    this.setCircleRadius(proj.circle, radius);
    proj.circle.setFillStyle(color, 1);
    proj.circle.setVisible(true);
    proj.circle.setActive(true);
  }

  private spawnPooledSplash(center: Point, radius: number): void {
    const splash = this.splashPool.find((s) => !s.active);
    if (!splash) return;
    splash.active = true;
    splash.timer = 0;
    splash.duration = 200;
    splash.maxRadius = radius;
    splash.circle.setPosition(center.x, center.y);
    this.setCircleRadius(splash.circle, radius);
    splash.circle.setFillStyle(0xff9800, 0);
    splash.circle.setStrokeStyle(2, 0xff9800, 0.4);
    splash.circle.setVisible(true);
    splash.circle.setActive(true);
  }

  private updatePooledProjectiles(deltaMs: number): void {
    for (const proj of this.projectilePool) {
      if (!proj.active) continue;
      proj.progress += deltaMs / proj.duration;
      if (proj.progress >= 1) {
        // Show brief flash at destination
        proj.circle.setPosition(proj.toX, proj.toY);
        proj.circle.setFillStyle(proj.color, 0.7);
        this.setCircleRadius(proj.circle, proj.radius * 2);
        proj.active = false;
        // Schedule fade: mark for cleanup next frame
        proj.circle.setVisible(false);
        proj.circle.setActive(false);
        continue;
      }
      const t = proj.progress;
      let x = proj.fromX + (proj.toX - proj.fromX) * t;
      let y = proj.fromY + (proj.toY - proj.fromY) * t;
      if (proj.useArc) {
        y += -Math.sin(t * Math.PI) * 60;
      }
      proj.circle.setPosition(x, y);
      if (proj.rotationSpeed !== 0) {
        proj.circle.setRotation(proj.circle.rotation + proj.rotationSpeed * (deltaMs / 1000));
      }
    }
  }

  private updatePooledSplashes(deltaMs: number): void {
    for (const splash of this.splashPool) {
      if (!splash.active) continue;
      splash.timer += deltaMs;
      const t = splash.timer / splash.duration;
      if (t >= 1) {
        splash.active = false;
        splash.circle.setVisible(false);
        splash.circle.setActive(false);
        continue;
      }
      const currentRadius = splash.maxRadius * (1 + t * 0.5);
      this.setCircleRadius(splash.circle, currentRadius);
      splash.circle.setStrokeStyle(2, 0xff9800, 0.4 * (1 - t));
    }
  }

  private drawArrowProjectile(from: Point, to: Point): void {
    this.spawnPooledProjectile(from, to, 0xfacc15, 3, 100);
  }

  private drawCatapultProjectile(from: Point, to: Point): void {
    this.spawnPooledProjectile(from, to, 0xff9800, 5, 350, true);
  }

  private drawProjectileToTarget(from: Point, to: Point, color: number, speed: number): void {
    const dist = Math.sqrt(distanceSquared(from, to));
    const duration = (dist / speed) * 1000;
    this.spawnPooledProjectile(from, to, color, 4, duration);
  }

  private drawWeaponProjectile(type: WeaponType, from: Point, to: Point): void {
    const dist = Math.sqrt(distanceSquared(from, to));
    switch (type) {
      case 'axe':
        this.spawnPooledProjectile(from, to, 0xff8c42, 6, (dist / 300) * 1000, false, Math.PI * 2);
        break;
      case 'saw':
        this.spawnPooledProjectile(from, to, 0xffd700, 5, (dist / 420) * 1000, false, Math.PI * 4);
        break;
      case 'drill':
        this.spawnPooledProjectile(from, to, 0x42a5f5, 5, (dist / 500) * 1000);
        break;
      case 'ritual-dagger':
        this.spawnPooledProjectile(from, to, 0xb388ff, 4, (dist / 380) * 1000);
        break;
    }
  }

  private drawSplashCircle(center: Point, radius: number): void {
    this.spawnPooledSplash(center, radius);
  }

  // Helper: set circle radius without recreating geometry
  private setCircleRadius(circle: Phaser.GameObjects.Arc, radius: number): void {
    circle.setScale(radius / 4);
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
    overlay.add(this.add.rectangle(0, 0, 680, 420, 0x2a2018, 0.96).setStrokeStyle(2, 0x8a7a58, 0.7));
    overlay.add(this.add.text(0, -170, '商店', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '30px', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Full-screen backdrop placed in scene (not container) so buttons below can receive clicks
    const backdrop = this.add.rectangle(640, 360, 1280, 720, 0x0a0805, 0.72)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 21)
      .setInteractive();
    backdrop.on('pointerover', () => {}); // absorb clicks, preventing them from reaching game objects
    this.shopOverlayBg = backdrop;

    // Shop buttons placed directly in scene (Container children can't receive pointer events)
    const shopButtons: Phaser.GameObjects.Rectangle[] = [];
    const shopTexts: Phaser.GameObjects.Text[] = [];
    this.shop.stock.forEach((item, index) => {
      const y = 270 + index * 58;
      const button = this.add.rectangle(640, y, 560, 44, 0x3a3020, 1)
        .setScrollFactor(0)
        .setDepth(OVERLAY_DEPTH + 23)
        .setInteractive({ useHandCursor: true });
      button.on('pointerover', () => button.setFillStyle(0x4a4030, 1));
      button.on('pointerout', () => button.setFillStyle(0x3a3020, 1));
      button.on('pointerdown', () => this.buyShopItem(item.id));
      shopButtons.push(button);
      shopTexts.push(this.add.text(390, y - 7, item.name, { color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '15px' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 23));
      shopTexts.push(this.add.text(390, y + 10, item.description, { color: '#8a7a68', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 23));
      shopTexts.push(this.add.text(890, y, this.formatCost(item.cost), { color: '#c8a860', fontFamily: 'monospace', fontSize: '13px' }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 23));
    });

    const rerollBtn = this.add.rectangle(520, 525, 160, 38, 0x3a3020, 1)
      .setScrollFactor(0).setDepth(OVERLAY_DEPTH + 23).setInteractive({ useHandCursor: true });
    rerollBtn.on('pointerdown', () => this.rerollCurrentShop());
    shopButtons.push(rerollBtn);

    const closeBtn = this.add.rectangle(760, 525, 160, 38, 0x3a3020, 1)
      .setScrollFactor(0).setDepth(OVERLAY_DEPTH + 23).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeShop());
    shopButtons.push(closeBtn);

    shopTexts.push(this.add.text(520, 525, `重随 ${this.shop.rerollCost} 金`, { color: '#e0d8c8', fontFamily: 'Arial', fontSize: '14px' }).setOrigin(0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 23));
    shopTexts.push(this.add.text(760, 525, '离开', { color: '#e0d8c8', fontFamily: 'Arial', fontSize: '14px' }).setOrigin(0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 23));

    this.shopOverlay = overlay;
    this.shopOverlayButtons = shopButtons;
    this.shopOverlayTexts = shopTexts;
  }

  private hideShopOverlay(): void {
    if (this.shopOverlay) { this.shopOverlay.destroy(true); this.shopOverlay = undefined; }
    if (this.shopOverlayBg) { this.shopOverlayBg.destroy(); this.shopOverlayBg = undefined; }
    for (const b of this.shopOverlayButtons) b.destroy();
    this.shopOverlayButtons = [];
    for (const t of this.shopOverlayTexts) t.destroy();
    this.shopOverlayTexts = [];
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
      this.addCardToHand(item.buildingType as Exclude<BuildingType, 'wall'>);
      this.showFeedback(`获得建筑：${getBuildingDefinition(item.buildingType)?.name ?? item.buildingType}`, '#d4a843');
    }
    if (item.kind === 'weapon' && item.weaponType) {
      this.weapons = addWeapon(this.weapons, item.weaponType);
      this.showFeedback(`获得武器：${getWeaponDefinition(item.weaponType)?.name ?? item.weaponType}`, '#d4a843');
      this.updateHudPanels();
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
      const damage = Math.round(definition.damage * weapon.damageMultiplier * this.stats.weaponDamageMultiplier);
      const cooldown = definition.cooldown * weapon.cooldownMultiplier * this.stats.weaponCooldownMultiplier;

      // AOE weapon (saw): hit all enemies in range
      if (definition.aoe) {
        let hitAny = false;
        for (const enemy of [...this.enemies]) {
          if (distanceSquared(this.playerPosition, enemy.position) <= effectiveRange ** 2) {
            const result = applyDamage(enemy.health, damage);
            enemy.health = result.health;
            this.showDamageNumber(enemy.position.x, enemy.position.y - (enemy as any).radius - 10, damage);
            this.results = addHeroDamage(this.results, damage);
            if (result.dead) this.removeEnemy(enemy);
            hitAny = true;
          }
        }
        if (hitAny) {
          this.drawWeaponProjectile(weapon.type, this.playerPosition, this.playerPosition);
          return { ...weapon, cooldownTimer: cooldown };
        }
        return weapon;
      }

      // Piercing weapon (drill): hit multiple enemies in a line
      if (definition.pierceCount && definition.pierceCount > 1) {
        const target = selectNearestTarget(this.playerPosition, this.enemies, effectiveRange);
        if (!target) return weapon;
        // Hit enemies along the line from player to target, up to pierceCount
        const hitIds = new Set<string>();
        let hits = 0;
        const sorted = [...this.enemies].sort(
          (a, b) => distanceSquared(this.playerPosition, a.position) - distanceSquared(this.playerPosition, b.position),
        );
        for (const enemy of sorted) {
          if (hits >= definition.pierceCount) break;
          if (distanceSquared(this.playerPosition, enemy.position) <= effectiveRange ** 2) {
            const result = applyDamage(enemy.health, damage);
            enemy.health = result.health;
            this.showDamageNumber(enemy.position.x, enemy.position.y - (enemy as any).radius - 10, damage);
            this.results = addHeroDamage(this.results, damage);
            if (result.dead) this.removeEnemy(enemy);
            hitIds.add(enemy.id);
            hits++;
          }
        }
        this.drawWeaponProjectile(weapon.type, this.playerPosition, target.position);
        return { ...weapon, cooldownTimer: cooldown };
      }

      // Default: single target (axe, ritual-dagger)
      const target = selectNearestTarget(this.playerPosition, this.enemies, effectiveRange);
      if (!target) return weapon;
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
      this.drawWeaponProjectile(weapon.type, this.playerPosition, target.position);
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
      this.minionPositions.set(minion.id, { ...minion.position });
    }
  }

  private updateMinions(deltaSeconds: number): void {
    this.summons = updateMinionLifetime(this.summons, deltaSeconds);
    const synergy = {
      deathExplosionBonus: this.stats.summonDeathExplosionBonus,
      deathResourceChance: this.stats.summonDeathResourceChance,
      deathResourceType: 'gold' as const,
      explosionRadiusMult: 1.5,
    };
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
          const dmg = definition.damage * this.summons.damageMultiplier * this.stats.summonDamageMultiplier * this.stats.summonGlobalDamageMultiplier;
          const result = applyDamage(target.health, dmg);
          (target as any).health = result.health;
          if (result.dead) this.removeEnemy(target as any);
          if (minion.type === 'bomber') this.detonateMinion(minion.id, synergy);
        }
      }
      this.minionVisuals.get(minion.id)?.setPosition(minion.position.x, minion.position.y);
      this.minionPositions.set(minion.id, { ...minion.position });
    }
    this.cleanupMissingMinionVisuals(synergy);
  }

  private cleanupMissingMinionVisuals(synergy?: {
    deathExplosionBonus: number;
    deathResourceChance: number;
    deathResourceType: 'gold';
    explosionRadiusMult: number;
  }): void {
    const activeIds = new Set(this.summons.minions.map((m) => m.id));
    for (const [id, visual] of this.minionVisuals) {
      if (!activeIds.has(id)) {
        // Apply synergy death effects for non-bomber minions that expired
        if (synergy && synergy.deathExplosionBonus > 0) {
          const pos = this.minionPositions.get(id);
          const radius = Math.round(36 * synergy.explosionRadiusMult);
          if (pos) {
            this.drawSplashCircle(pos, radius);
            for (const enemy of [...this.enemies]) {
              if (distanceSquared(enemy.position, pos) <= radius ** 2) {
                const dmg = applyDamage(enemy.health, synergy.deathExplosionBonus);
                enemy.health = dmg.health;
                if (dmg.dead) this.removeEnemy(enemy);
              }
            }
          }
        }
        if (synergy && synergy.deathResourceChance > 0 && Math.random() < synergy.deathResourceChance) {
          this.wallet = { ...this.wallet, gold: this.wallet.gold + 1 };
          const pos = this.minionPositions.get(id);
          if (pos) this.showFloatingResource(pos.x, pos.y, '+1 金', '#d4a843');
        }
        this.minionVisuals.delete(id);
        this.minionPositions.delete(id);
        visual.destroy(true);
      }
    }
  }

  private detonateMinion(
    minionId: string,
    synergy?: {
      deathExplosionBonus: number;
      deathResourceChance: number;
      deathResourceType: 'gold';
      explosionRadiusMult: number;
    },
  ): void {
    const result = killMinion(this.summons, minionId, synergy);
    this.summons = result.state;
    for (const effect of result.effects) {
      if (effect.type === 'explosion') {
        this.drawSplashCircle(effect.position, effect.radius);
        for (const enemy of [...this.enemies]) {
          if (distanceSquared(enemy.position, effect.position) <= effect.radius ** 2) {
            const damage = applyDamage(enemy.health, effect.damage);
            enemy.health = damage.health;
            if (damage.dead) this.removeEnemy(enemy);
          }
        }
      } else if (effect.type === 'resource-drop') {
        this.wallet = { ...this.wallet, [effect.resource]: this.wallet[effect.resource] + effect.amount };
        const label = effect.resource === 'gold' ? `+${effect.amount} 金` : `+${effect.amount}`;
        this.showFloatingResource(effect.position.x, effect.position.y, label, '#d4a843');
      }
    }
    this.cleanupMissingMinionVisuals(synergy);
  }

  private createInitialRewardCircles(): void {
    const event = createRewardCircle(`reward-${this.routeEvents.nextId++}`, { x: 600, y: 400 }, {}, 1.5);
    this.routeEvents = { ...this.routeEvents, active: [...this.routeEvents.active, event] };
    this.createEventVisual(event);
  }

  private updateRouteEvents(deltaSeconds: number): void {
    this.routeEvents = {
      ...this.routeEvents,
      active: this.routeEvents.active.map((event) => {
        if (event.completed || event.claimed) return event;
        const occupied = distanceSquared(this.playerPosition, event.position) <= 95 ** 2;
        const updated = updateRewardCircle(event, deltaSeconds, occupied);
        const justCompleted = !event.completed && updated.completed;

        // Blind box: random upgrade on completion
        if (justCompleted) {
          const [upgrade] = pickUpgradeChoices(UPGRADE_POOL, 1, Math.random);
          this.stats = applyUpgrade(this.stats, upgrade.id);
          const cardMap: Partial<Record<UpgradeId, BuildingType>> = {
            'building-card-arrow': 'arrow',
            'building-card-fire': 'fire',
            'building-card-ice': 'ice',
            'building-card-catapult': 'catapult',
            'building-card-wall': 'wall',
          };
          const cardType = cardMap[upgrade.id as UpgradeId];
          if (cardType) this.addCardToHand(cardType);
          this.updateTowerRangeVisuals();
          this.updateHudPanels();
          this.showFeedback(`盲盒开启：${upgrade.name}`, '#d4a843');
        }

        // Resource reward (legacy, currently reward is empty)
        const claimed = completeRewardCircle(updated);
        if (Object.keys(claimed.reward).length > 0) {
          this.wallet = {
            ...this.wallet,
            gold: this.wallet.gold + (claimed.reward.gold ?? 0),
            wood: this.wallet.wood + (claimed.reward.wood ?? 0),
            stone: this.wallet.stone + (claimed.reward.stone ?? 0),
            xp: this.wallet.xp + (claimed.reward.xp ?? 0),
          };
        }
        return claimed.event;
      }),
    };
    this.cleanupCompletedEvents();
    this.updateEventVisuals();
  }

  private updateEventVisuals(): void {
    for (const event of this.routeEvents.active) {
      const g = this.eventCountdownRings.get(event.id);
      if (!g) continue;
      g.clear();
      const progress = 1 - event.remaining / 1.5;
      const clamped = Math.max(0, Math.min(1, progress));
      if (clamped <= 0) continue;

      const startAngle = Phaser.Math.DegToRad(-90);
      const endAngle = startAngle + clamped * Math.PI * 2;
      const steps = Math.max(3, Math.round(clamped * 32));

      g.fillStyle(0xd4a843, 0.7);
      g.beginPath();
      g.moveTo(0, 0);
      for (let i = 0; i <= steps; i++) {
        const angle = startAngle + (endAngle - startAngle) * (i / steps);
        g.lineTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
      }
      g.closePath();
      g.fillPath();
    }
  }

  private createEventVisual(event: RouteEvent): void {
    const visual = this.add.container(event.position.x, event.position.y);
    visual.setDepth(6);
    // Base circle — low alpha background
    visual.add(this.add.circle(0, 0, 30, 0xd4a843, 0.15).setStrokeStyle(2, 0xd4a843, 0.5).setDepth(1));

    // Progress sector — Graphics object, redrawn each frame
    const sector = this.add.graphics().setDepth(2);
    visual.add(sector);
    this.eventCountdownRings.set(event.id, sector);

    // "?" label
    visual.add(this.add.text(0, 0, '?', {
      color: '#d4a843', fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3));

    this.eventVisuals.set(event.id, visual);
  }

  private cleanupCompletedEvents(): void {
    for (const event of this.routeEvents.active) {
      if (event.completed && event.claimed) {
        this.eventVisuals.get(event.id)?.destroy(true);
        this.eventVisuals.delete(event.id);
        this.eventCountdownRings.get(event.id)?.destroy();
        this.eventCountdownRings.delete(event.id);
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

    // Upgrade cards placed directly in scene (Container children can't receive pointer events)
    this.upgradeChoices.forEach((choice, index) => {
      const y = 310 + index * 100;
      const rarityColors: Record<string, { border: number; text: string; bg: number }> = {
        common: { border: 0x5a4a38, text: '#8a7a68', bg: 0x3a3020 },
        rare: { border: 0x4a90d9, text: '#6ab4f7', bg: 0x1a2a40 },
        epic: { border: 0x9b59b6, text: '#c39bd3', bg: 0x2a1a30 },
      };
      const rc = rarityColors[choice.rarity] ?? rarityColors.common;
      const card = this.add.rectangle(640, y, 600, 76, rc.bg, 1)
        .setScrollFactor(0).setDepth(OVERLAY_DEPTH + 21)
        .setInteractive({ useHandCursor: true });
      card.setStrokeStyle(2, rc.border, 1);
      card.on('pointerover', () => { card.setStrokeStyle(2, 0xd4a843, 1); });
      card.on('pointerout', () => { card.setStrokeStyle(2, rc.border, 1); card.setFillStyle(rc.bg, 1); });
      card.on('pointerdown', () => { if (this.upgradeInputCooldown <= 0) this.selectUpgrade(index); });
      this.upgradeCards.push(card);

      const icon = this.add.text(370, y - 7, `${index + 1}`, {
        color: '#d4a843', fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 21);

      const rarityLabel = this.add.text(900, y - 14, choice.rarity === 'epic' ? '史诗' : choice.rarity === 'rare' ? '稀有' : '', {
        color: rc.text, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '12px', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 21);

      const name = this.add.text(400, y - 14, choice.name, {
        color: choice.rarity === 'common' ? '#e0d8c8' : rc.text, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '20px',
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 21);

      const desc = this.add.text(400, y + 10, choice.description, {
        color: '#8a7a68', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '14px',
        wordWrap: { width: 520 },
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 21);

      this.upgradeTexts.push(icon, name, desc, rarityLabel);
    });

    this.upgradeOverlay = overlay;
  }

  private hideUpgradeOverlay(): void {
    if (this.upgradeOverlay) { this.upgradeOverlay.destroy(true); this.upgradeOverlay = undefined; }
    for (const c of this.upgradeCards) c.destroy();
    this.upgradeCards = [];
    for (const t of this.upgradeTexts) t.destroy();
    this.upgradeTexts = [];
  }

  private selectUpgrade(index: number): void {
    if (!this.upgradeSelecting) return;
    const choice = this.upgradeChoices[index];
    if (!choice) return;
    this.stats = applyUpgrade(this.stats, choice.id);

    // Building card upgrades: add card to hand
    const cardMap: Partial<Record<UpgradeId, BuildingType>> = {
      'building-card-arrow': 'arrow',
      'building-card-fire': 'fire',
      'building-card-ice': 'ice',
      'building-card-catapult': 'catapult',
      'building-card-wall': 'wall',
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
  // ROUTE FORKS
  // ═══════════════════════════════════════════════════

  private checkRouteForks(): void {
    const caravanX = getCaravanCenter(this.caravanTopLeft).x;
    for (const fork of this.routeForks) {
      if (!fork.triggered && caravanX >= fork.triggerDistance) {
        fork.triggered = true;
        this.currentFork = fork;
        this.forkChoices = [fork.choiceA, fork.choiceB];
        this.forkSelecting = true;
        this.showForkOverlay();
        return;
      }
    }
  }

  private updateForkInput(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) { this.selectFork(0); }
    else if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) { this.selectFork(1); }
  }

  private showForkOverlay(): void {
    this.hideForkOverlay();
    const fork = this.currentFork;
    if (!fork) return;

    // Backdrop in container for easy cleanup
    this.forkOverlay = this.add.container(0, 0);
    this.forkOverlay.setScrollFactor(0);
    this.forkOverlay.setDepth(OVERLAY_DEPTH + 23);

    this.forkOverlay.add(this.add.rectangle(640, 360, 1280, 720, 0x0a0805, 0.8)
      .setScrollFactor(0).setDepth(OVERLAY_DEPTH + 24));
    this.forkOverlay.add(this.add.rectangle(640, 260, 600, 200, 0x2a2018, 0.96)
      .setScrollFactor(0).setDepth(OVERLAY_DEPTH + 24)
      .setStrokeStyle(2, 0x8a7a58, 0.7));

    // Title & buttons directly in scene (Container children can't receive pointer events
    // and their depth is clamped to container depth)
    this.forkTitle = this.add.text(640, 195, '分岔路口', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '28px', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 26);

    const forkButtons: Phaser.GameObjects.Rectangle[] = [];
    const forkTexts: Phaser.GameObjects.Text[] = [];
    const buttonWidth = 260;
    const gap = 40;
    const leftX = 640 - buttonWidth / 2 - gap / 2;
    const rightX = 640 + buttonWidth / 2 + gap / 2;
    const buttonY = 260;

    [fork.choiceA, fork.choiceB].forEach((choice, i) => {
      const x = i === 0 ? leftX : rightX;
      const btn = this.add.rectangle(x, buttonY, buttonWidth, 120, 0x3a3020, 1)
        .setScrollFactor(0).setDepth(OVERLAY_DEPTH + 25)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setFillStyle(0x4a4030, 1));
      btn.on('pointerout', () => btn.setFillStyle(0x3a3020, 1));
      btn.on('pointerdown', () => this.selectFork(i));
      forkButtons.push(btn);

      forkTexts.push(this.add.text(x, buttonY - 35, `${i + 1}. ${choice.label}`, {
        color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '18px', fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 25));

      forkTexts.push(this.add.text(x, buttonY, choice.description, {
        color: '#8a7a68', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '14px',
        wordWrap: { width: buttonWidth - 20 }, align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 25));
    });

    this.forkButtons = forkButtons;
    this.forkTexts = forkTexts;
  }

  private hideForkOverlay(): void {
    if (this.forkOverlay) { this.forkOverlay.destroy(true); this.forkOverlay = undefined; }
    if (this.forkTitle) { this.forkTitle.destroy(); this.forkTitle = undefined; }
    for (const b of this.forkButtons) b.destroy();
    this.forkButtons = [];
    for (const t of this.forkTexts) t.destroy();
    this.forkTexts = [];
  }

  private selectFork(index: number): void {
    if (!this.forkSelecting || !this.currentFork) return;
    const choice = this.forkChoices[index];
    this.currentFork.chosen = choice;
    this.routeModifier = choice.modifier;
    this.showFeedback(`选择了${choice.label}`, '#d4a843');
    this.forkSelecting = false;
    this.currentFork = undefined;
    this.hideForkOverlay();
    this.updateHudPanels();
  }

  private applyRouteModifier(enemyBudget: number): number {
    if (this.routeModifier === 'combat-heavy') return Math.round(enemyBudget * 1.4);
    if (this.routeModifier === 'resource-rich') return Math.round(enemyBudget * 0.7);
    return enemyBudget;
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
    const moveAmount = CARAVAN_SPEED * deltaSeconds;

    // Only recompute forward-edge periodically (it changes slowly at 35px/s)
    this.caravanUpdateTimer += deltaSeconds;
    if (this.caravanUpdateTimer >= CARAVAN_UPDATE_INTERVAL) {
      this.caravanUpdateTimer = 0;

      const occupiedSlotIds = this.getOccupiedSlotIds();
      const occupiedGridOffsets: Array<{ col: number; row: number }> = [];
      for (const slot of GRID_BUILD_SLOTS) {
        if (!occupiedSlotIds.has(slot.id)) continue;
        occupiedGridOffsets.push(slot.gridOffset);
      }
      const forwardCells = buildForwardCells(this.caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, occupiedGridOffsets);
      const forwardEdge = computeForwardEdge(forwardCells);
      const sweptEdge = forwardEdge + CARAVAN_SPEED * CARAVAN_UPDATE_INTERVAL;

      let blocked = false;
      let blockerInfo = '无障碍';

      for (const enemy of this.enemies) {
        if (isObstacleBlocking(
          { position: enemy.position, radius: enemy.radius, active: true },
          forwardEdge, sweptEdge, forwardCells,
        )) {
          blocked = true;
          blockerInfo = `敌人(${enemy.id}) pos=${Math.round(enemy.position.x)},${Math.round(enemy.position.y)}`;
          break;
        }
      }

      if (!blocked) {
        const allNodes = [
          ...this.resourceSpawner.woodNodes,
          ...this.resourceSpawner.stoneNodes,
          ...this.resourceSpawner.goldNodes,
        ];
        for (const node of allNodes) {
          if (node.remaining <= 0) continue;
          if (node.position.x + node.radius < forwardEdge) continue;
          if (isObstacleBlocking(
            { position: node.position, radius: node.radius, active: node.remaining > 0 },
            forwardEdge, sweptEdge, forwardCells,
          )) {
            blocked = true;
            blockerInfo = `${node.type}(剩余${Math.ceil(node.remaining)}) pos=${Math.round(node.position.x)},${Math.round(node.position.y)}`;
            break;
          }
        }
      }

      this._caravanBlocked = blocked;
      this._lastBlockerInfo = blockerInfo;
      this._lastForwardEdge = forwardEdge;
    }

    if (this._caravanBlocked) {
      // Caravan is blocked — stay stopped
    } else {
      // Path is clear — move forward
      this.caravanTopLeft.x += moveAmount;
    }

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

  // ══════════════════════════════════════════════════
  // DEBUG HUD
  // ═══════════════════════════════════════════════════

  private updateDebugHud(): void {
    // FPS calculation (update every 0.5s)
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round(this.frameCount * 1000 / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
    if (this.fpsText) {
      const color = this.currentFps >= 50 ? '#00ff88' : this.currentFps >= 30 ? '#ffaa00' : '#ff4444';
      this.fpsText.setText(`FPS: ${this.currentFps}`).setColor(color);
    }

    // Obstacle info
    if (this.obstacleText) {
      if (this._lastBlockerInfo === '无障碍') {
        this.obstacleText.setText(`状态: 行进中 | 前沿 x=${Math.round(this._lastForwardEdge)}`)
          .setColor('#88ff88');
      } else {
        this.obstacleText.setText(`状态: 受阻 | ${this._lastBlockerInfo} | 前沿 x=${Math.round(this._lastForwardEdge)}`)
          .setColor('#ff6644');
      }
    }

    // Blocked warning banner
    if (this._caravanBlocked) {
      this.showBlockedWarning();
    } else {
      this.hideBlockedWarning();
    }
  }

  private showBlockedWarning(): void {
    if (this.blockedWarning) {
      // Update text content and pulse
      if (this.blockedWarningText) {
        this.blockedWarningText.setText(`⚠ 受阻！${this._lastBlockerInfo}`);
      }
      // Pulsing glow
      const pulse = 0.6 + Math.sin(this.elapsedSeconds * 8) * 0.4;
      if (this.blockedWarningGlow) {
        this.blockedWarningGlow.setFillStyle(0xff2200, pulse * 0.15);
      }
      if (this.blockedWarningBg) {
        this.blockedWarningBg.setFillStyle(0x3a0000, 0.85 + pulse * 0.15);
      }
      return;
    }

    const container = this.add.container(640, 48);
    container.setScrollFactor(0);
    container.setDepth(OVERLAY_DEPTH + 10);

    // Dark red background bar
    const bg = this.add.rectangle(0, 0, 420, 50, 0x3a0000, 0.92)
      .setStrokeStyle(2, 0xff4400, 0.8);
    bg.setScrollFactor(0);
    bg.setDepth(OVERLAY_DEPTH + 10);
    this.blockedWarningBg = bg;

    // Glow rectangle behind
    const glow = this.add.rectangle(0, 0, 460, 70, 0xff2200, 0.1);
    glow.setScrollFactor(0);
    glow.setDepth(OVERLAY_DEPTH + 9);
    this.blockedWarningGlow = glow;

    // Warning text
    const text = this.add.text(0, 0, `⚠ 受阻！${this._lastBlockerInfo}`, {
      color: '#ff4400',
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(OVERLAY_DEPTH + 11);

    container.add([bg, glow, text]);
    this.blockedWarning = container;
    this.blockedWarningText = text;
  }

  private hideBlockedWarning(): void {
    if (this.blockedWarning) {
      this.blockedWarning.destroy(true);
      this.blockedWarning = undefined;
      this.blockedWarningBg = undefined;
      this.blockedWarningText = undefined;
      this.blockedWarningGlow = undefined;
    }
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
    // ESC: deselect card
    if (this.selectedCardIndex >= 0 && Phaser.Input.Keyboard.JustDown(this.keys.ESCAPE)) {
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
        // Occupied slot: subtle red crosshatch to show it's blocked
        const blocked = this.add.rectangle(center.x, center.y, 40, 40, 0xef4444, 0.2);
        blocked.setStrokeStyle(2, 0xef4444, 0.7);
        blocked.setDepth(OVERLAY_DEPTH + 4);
        this.buildSlotHighlights.set(slot.id, blocked);
      } else {
        // Free slot: gold highlight for building (fits within one 48px cell)
        const highlight = this.add.rectangle(center.x, center.y, 40, 40, 0xfacc15, 0.3);
        highlight.setStrokeStyle(3, 0xfacc15, 1);
        highlight.setDepth(OVERLAY_DEPTH + 8);
        highlight.setInteractive({ useHandCursor: true });

        // Pulse animation
        this.tweens.add({
          targets: highlight,
          alpha: 0.5,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        highlight.on('pointerover', () => highlight.setFillStyle(0xfacc15, 0.45));
        highlight.on('pointerout', () => highlight.setFillStyle(0xfacc15, 0.3));
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
    // ── Left unified panel (caravan, towers, weapons, buffs) ──
    this.healthPanel = this.add.container(16, 16);
    this.healthPanel.setScrollFactor(0);
    this.healthPanel.setDepth(OVERLAY_DEPTH + 5);

    // Background FIRST so it renders behind everything
    this.healthBgRect = this.add.rectangle(130, 58, 260, 116, 0x2a2018, 0.95);
    this.healthBgRect.setStrokeStyle(2, 0x5a4a38, 0.6);
    this.healthPanel.add(this.healthBgRect);

    // ═══ 行城 (label + bar same row) ═══
    this.healthLabel = this.add.text(16, 16, '行城', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px', fontStyle: 'bold',
    });
    this.healthPanel.add(this.healthLabel);
    this.healthBarBg = this.add.rectangle(130, 16, 120, 10, 0x1a1510);
    this.healthPanel.add(this.healthBarBg);
    this.healthBar = this.add.rectangle(130, 16, 116, 6, 0x4caf50);
    this.healthBar.setOrigin(0.5, 0.5);
    this.healthPanel.add(this.healthBar);
    this.healthText = this.add.text(130, 16, '', {
      color: '#ffffff', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px',
    });
    this.healthText.setOrigin(0.5);
    this.healthPanel.add(this.healthText);

    // Divider line
    this.divider1 = this.add.rectangle(130, 34, 240, 1, 0x3a3020);
    this.healthPanel.add(this.divider1);

    // ═══ 建筑 ═══
    this.buildingLabel = this.add.text(16, 42, '建筑', {
      color: '#c8b898', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px', fontStyle: 'bold',
    });
    this.healthPanel.add(this.buildingLabel);
    this.towerCountText = this.add.text(68, 42, '', {
      color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px',
    });
    this.healthPanel.add(this.towerCountText);
    this.wallCountText = this.add.text(160, 42, '', {
      color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px',
    });
    this.healthPanel.add(this.wallCountText);

    // Divider line
    this.healthPanel.add(this.add.rectangle(130, 58, 240, 1, 0x3a3020));

    // ═══ 英雄 ═══
    this.heroLabel = this.add.text(16, 64, '英雄', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px', fontStyle: 'bold',
    });
    this.healthPanel.add(this.heroLabel);
    this.weaponPrefix = this.add.text(16, 78, '武器：', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px', fontStyle: 'bold',
    });
    this.healthPanel.add(this.weaponPrefix);
    this.weaponLineText = this.add.text(62, 78, '', {
      color: '#e0d8c8', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px',
    });
    this.healthPanel.add(this.weaponLineText);
    this.statsPrefix = this.add.text(16, 92, '属性：', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px', fontStyle: 'bold',
    });
    this.healthPanel.add(this.statsPrefix);
    this.statsLineText = this.add.text(62, 92, '', {
      color: '#8a7a68', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px',
    });
    this.healthPanel.add(this.statsLineText);

    // Adjust background to match new content height
    this.healthBgRect.setPosition(130, 54);
    this.healthBgRect.setSize(260, 108);

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

    // Route indicator (below resource panel)
    this.routeIndicatorText = this.add.text(1190, 62, '平衡路线', {
      color: '#8a7a68', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '10px',
    });
    this.routeIndicatorText.setOrigin(0.5, 0);
    this.routeIndicatorText.setScrollFactor(0);
    this.routeIndicatorText.setDepth(OVERLAY_DEPTH + 5);

    // FPS & Obstacle debug overlay (bottom-left)
    this.fpsText = this.add.text(10, 680, 'FPS: 0', {
      color: '#00ff88', fontFamily: 'monospace', fontSize: '12px',
    });
    this.fpsText.setScrollFactor(0);
    this.fpsText.setDepth(OVERLAY_DEPTH + 5);

    this.obstacleText = this.add.text(10, 700, '状态: 行进中', {
      color: '#ffaa44', fontFamily: 'monospace', fontSize: '11px',
    });
    this.obstacleText.setScrollFactor(0);
    this.obstacleText.setDepth(OVERLAY_DEPTH + 5);

    // Shop button (left of resource panel)
    const shopBtn = this.add.rectangle(1072, 18, 52, 28, 0x3a3020, 1)
      .setScrollFactor(0).setDepth(OVERLAY_DEPTH + 6).setInteractive({ useHandCursor: true });
    shopBtn.setStrokeStyle(1, 0x8a7a58, 0.7);
    shopBtn.on('pointerdown', () => {
      if (!this.shopOpen && !this.upgradeSelecting && !this.gameOver) {
        this.nextShopAtSeconds = this.elapsedSeconds;
        this.maybeOpenShop();
      } else if (this.shopOpen) {
        this.closeShop();
      }
    });
    shopBtn.on('pointerover', () => shopBtn.setFillStyle(0x4a4030, 1));
    shopBtn.on('pointerout', () => shopBtn.setFillStyle(0x3a3020, 1));
    const shopLabel = this.add.text(1072, 18, '商店', {
      color: '#d4a843', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '12px', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(OVERLAY_DEPTH + 6);
    this.shopButton = shopBtn;
    this.shopLabel = shopLabel;
  }

  private updateHudPanels(): void {
    // Health bar
    if (this.healthBar && this.healthText) {
      const hpRatio = this.stats.caravanHealth / this.stats.caravanMaxHealth;
      const hpColor = hpRatio > 0.5 ? 0x4caf50 : hpRatio > 0.25 ? 0xfdd835 : 0xef4444;
      this.healthBar.setFillStyle(hpColor);
      this.healthBar.setSize(Math.max(0, 116 * hpRatio), 6);
      this.healthText.setText(`${Math.ceil(this.stats.caravanHealth)}/${this.stats.caravanMaxHealth}`);
    }

    // Tower / Wall counts
    const totalSlotCount = GRID_BUILD_SLOTS.length;
    if (this.towerCountText) this.towerCountText.setText(`箭塔 ${this.towers.length}`);
    if (this.wallCountText) this.wallCountText.setText(`城墙 ${this.walls.length}/${totalSlotCount}`);

    // Weapon & stats
    this.updateWeaponHud();
    this.updatePlayerStatsHud();

    // Wave & Level panel
    if (this.waveText && this.xpBarFill && this.xpText) {
      this.waveText.setText(`波次 ${this.waveState.currentWave}/${MAX_WAVE}  |  ${Math.ceil(this.waveState.nextWaveTimer)}s`);
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

    // Route indicator
    if (this.routeIndicatorText) {
      const routeLabels: Record<RouteModifier, string> = {
        balanced: '平衡路线',
        'combat-heavy': '烈焰路线 — 敌人 +40%',
        'resource-rich': '幽谷路线 — 资源更丰富',
      };
      const routeColors: Record<RouteModifier, string> = {
        balanced: '#8a7a68',
        'combat-heavy': '#ff6b6b',
        'resource-rich': '#69db7c',
      };
      this.routeIndicatorText.setText(routeLabels[this.routeModifier]);
      this.routeIndicatorText.setColor(routeColors[this.routeModifier]);
    }

    // Lightweight card affordability refresh (no destruction)
    this.refreshCardAffordability();
  }

  private updateWeaponHud(): void {
    if (!this.weaponLineText) return;
    const owned = this.weapons.owned;
    if (owned.length === 0) {
      this.weaponLineText.setText('无');
      return;
    }
    const active = owned[owned.length - 1];
    const def = WEAPON_DEFINITIONS[active.type];
    if (!def) return;
    const effectiveDmg = Math.round(def.damage * active.damageMultiplier * this.stats.weaponDamageMultiplier);
    const effectiveRange = Math.round(def.range + active.rangeBonus + this.stats.weaponRangeBonus);
    this.weaponLineText.setText(`${def.name}  伤害${effectiveDmg}  射程${effectiveRange}`);

    // Color weapon prefix to match weapon type
    const prefixColors: Record<WeaponType, string> = {
      'axe': '#ff8c42', 'saw': '#ffd700', 'drill': '#42a5f5', 'ritual-dagger': '#b388ff',
    };
    if (this.weaponPrefix) this.weaponPrefix.setColor(prefixColors[active.type] ?? '#d4a843');
  }

  private updatePlayerStatsHud(): void {
    if (!this.statsLineText) return;
    const dmgBonus = ((this.stats.weaponDamageMultiplier - 1) * 100).toFixed(0);
    const speedBonus = ((1 - this.stats.weaponCooldownMultiplier) * 100).toFixed(0);
    const rangeBonus = this.stats.weaponRangeBonus.toFixed(0);
    const summonDmg = ((this.stats.summonDamageMultiplier - 1) * 100).toFixed(0);
    this.statsLineText.setText(`伤害+${dmgBonus}%  攻速+${speedBonus}%  射程+${rangeBonus}   召唤+${summonDmg}%`);
  }

  private destroyHudPanels(): void {
    this.healthPanel?.destroy(true);
    this.wavePanel?.destroy(true);
    this.resourcePanel?.destroy(true);
    this.shopButton?.destroy();
    this.shopLabel?.destroy();
    for (const p of this.cardPanels) p.destroy();
    for (const l of this.cardLabels) l.destroy();
    for (const c of this.cardCosts) c.destroy();
  }

  // ═══════════════════════════════════════════════════
  // CARD HAND
  // ═══════════════════════════════════════════════════

  private rebuildCardHand(): void {
    // Destroy old card visuals
    for (const p of this.cardPanels) p.destroy();
    for (const l of this.cardLabels) l.destroy();
    for (const c of this.cardCosts) c.destroy();
    this.cardPanels = [];
    this.cardLabels = [];
    this.cardCosts = [];

    if (this.cardHand.length === 0) {
      const hint = this.add.text(640, 648, '获得建筑卡以开始建造', {
        color: '#8a7a68', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '12px',
      });
      hint.setOrigin(0.5);
      hint.setScrollFactor(0);
      hint.setDepth(OVERLAY_DEPTH + 5);
      this.cardLabels.push(hint); // track for cleanup
      return;
    }

    const cardWidth = 90;
    const cardHeight = 56;
    const gap = 10;
    const totalWidth = this.cardHand.length * (cardWidth + gap) - gap;
    const startX = 640 - totalWidth / 2;

    this.cardHand.forEach((type, index) => {
      const x = startX + index * (cardWidth + gap);
      this.createCardAt(index, x, 648, type, cardWidth, cardHeight);
    });
  }

  private createCardAt(index: number, x: number, y: number, type: BuildingType, cardWidth: number, cardHeight: number): void {
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
      strokeColor = 0x8a7a58;
      strokeWidth = 2;
      strokeAlpha = 0.8;
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

    const panelBg = this.add.rectangle(x, y, cardWidth, cardHeight, bgColor, bgAlpha);
    panelBg.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
    panelBg.setData('cardIndex', index);
    panelBg.setData('cardType', type);
    panelBg.setScrollFactor(0);
    panelBg.setDepth(OVERLAY_DEPTH + 5);

    // Interactive — placed directly in scene, not in container
    panelBg.setInteractive({ useHandCursor: true });
    const pulseTween = canAffordThis && !isSelected
      ? this.tweens.add({
          targets: panelBg,
          strokeAlpha: 1,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      : null;

    panelBg.on('pointerover', () => {
      if (this.selectedCardIndex === index) return;
      panelBg.setData('isHovered', true);
      if (pulseTween) pulseTween.pause();
      if (canAffordThis) {
        panelBg.setFillStyle(0x4a4030, 1);
        panelBg.setStrokeStyle(2, 0xd4a843, 1);
      } else {
        panelBg.setFillStyle(0x2a2518, 0.7);
      }
    });
    panelBg.on('pointerout', () => {
      if (this.selectedCardIndex === index) return;
      panelBg.setData('isHovered', false);
      panelBg.setFillStyle(bgColor, bgAlpha);
      panelBg.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
      if (pulseTween) pulseTween.resume();
    });
    panelBg.on('pointerdown', () => {
      if (!canBuild(this.wallet, type)) return;
      if (index === this.selectedCardIndex) {
        this.deselectCard();
      } else {
        this.selectCard(index);
      }
    });

    const def = BUILDING_DEFINITIONS[type];
    const label = this.add.text(x, y - 12, `${def.shortLabel} ${def.name}`, {
      color: labelColor, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '11px',
    });
    label.setOrigin(0.5);
    label.setAlpha(isSelected ? 1 : canAffordThis ? 1 : 0.5);
    label.setScrollFactor(0);
    label.setDepth(OVERLAY_DEPTH + 5);

    const cost = this.add.text(x, y + 6, getCatalogCostText(type), {
      color: costColor, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: '10px',
    });
    cost.setOrigin(0.5);
    cost.setAlpha(isSelected ? 1 : canAffordThis ? 1 : 0.5);
    cost.setScrollFactor(0);
    cost.setDepth(OVERLAY_DEPTH + 5);

    this.cardPanels.push(panelBg);
    this.cardLabels.push(label);
    this.cardCosts.push(cost);
  }

  /** Update affordability colors on existing cards without recreating them */
  private refreshCardAffordability(): void {
    if (this.cardHand.length === 0 || this.cardPanels.length === 0) return;

    this.cardHand.forEach((type, index) => {
      if (index >= this.cardPanels.length) return;
      const panelBg = this.cardPanels[index];
      if (panelBg.getData('isHovered')) return; // skip hovered card
      const canAffordThis = canBuild(this.wallet, type);
      const isSelected = index === this.selectedCardIndex;
      const label = this.cardLabels[index];
      const cost = this.cardCosts[index];

      if (canAffordThis && !isSelected) {
        panelBg.setFillStyle(0x3a3020, 0.95);
        panelBg.setStrokeStyle(2, 0x8a7a58, 0.8);
        label.setAlpha(1);
        cost.setAlpha(1);
        label.setColor('#e0d8c8');
        cost.setColor('#8a7a68');
      } else if (isSelected) {
        panelBg.setFillStyle(0x3a3020, 0.95);
        panelBg.setStrokeStyle(2, 0xd4a843, 1);
        label.setAlpha(1);
        cost.setAlpha(1);
        label.setColor('#facc15');
        cost.setColor('#e0d8c8');
      } else {
        panelBg.setFillStyle(0x1a1510, 0.6);
        panelBg.setStrokeStyle(1, 0x3a3528, 0.3);
        label.setAlpha(0.5);
        cost.setAlpha(0.5);
        label.setColor('#5a5048');
        cost.setColor('#4a4038');
      }
    });
  }

  private addCardToHand(type: BuildingType): void {
    this.cardHand.push(type);
    this.rebuildCardHand();
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
    if (type === 'wall') {
      this.buildWall(slot, center);
    } else {
      this.buildTower(slot, center, type);
    }

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
      goldGathered: this.totalGoldGathered,
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
      goldGathered: this.totalGoldGathered,
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
