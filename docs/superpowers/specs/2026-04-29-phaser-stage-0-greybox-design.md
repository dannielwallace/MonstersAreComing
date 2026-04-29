# Phaser Stage 0 Greybox Prototype Design

## Purpose

Build a 5-minute greybox prototype inspired by the high-level loop of `Monsters are Coming!`: a moving base, player gathering, quick construction, automatic tower fire, enemy pressure, and base failure. The goal is not a polished demo; it is to answer whether "leave the moving base to gather, then rush back to defend" feels readable and tense.

## Scope

This spec covers Stage 0 only.

Included:

- Phaser 3 browser game using TypeScript and Vite.
- One playable scene at 1280x720.
- Greybox visuals using simple shapes and text.
- Player movement with WASD.
- A moving caravan core that travels steadily to the right.
- Wood resource nodes placed ahead and around the route.
- Automatic wood gathering when the player stands near a resource node.
- One build action that places an arrow tower near the caravan core and costs wood.
- Towers automatically target and damage the nearest enemy in range.
- Enemies spawn over time and pursue the caravan core.
- Enemies damage the caravan core on contact.
- Game over when the caravan core reaches 0 health.
- Minimal HUD for wood, caravan health, elapsed time, tower cost, and game-over state.
- Unit tests for core rules that do not require Phaser rendering.

Excluded:

- Art assets, sprites, animations, sound, music, menus, save data, meta progression, upgrades, boss fights, multiple buildings, multiple enemy types, controller support, mobile UI, procedural map generation, and Steam integration.

## Recommended Approach

Use a small hybrid architecture:

- Phaser owns rendering, input, scene lifecycle, camera, and shape objects.
- Plain TypeScript modules own deterministic game rules such as inventory spending, distance checks, target selection, damage application, and spawn timing.

This keeps the first playable build fast while leaving enough testable logic to avoid a brittle one-file prototype.

## Player Experience

The player starts near the caravan core. The core slowly moves right across a flat open field. Wood nodes are scattered ahead and slightly away from the safe center. The player gathers wood by standing near nodes, then returns to the core and presses a build key to place a tower. Enemy waves spawn from the right and side edges. Towers shoot automatically, but one tower cannot cover every direction, so the player needs to choose when to gather and when to stay close.

The prototype succeeds if a playtester can understand the objective within 30 seconds and naturally experiences at least one moment where gathering a nearby resource competes with defending the caravan.

## Controls

- `W`, `A`, `S`, `D`: move player.
- `Space`: build one arrow tower at the closest valid slot around the caravan core.
- `R`: restart after game over.

No mouse interaction is required for Stage 0.

## World Layout

The world is wider than the screen. The caravan core starts near x = 200 and moves right at a fixed speed. The camera follows a midpoint between the player and caravan core, clamped loosely so both remain visible most of the time.

Stage 0 uses hand-authored or deterministic resource positions rather than procedural generation. This is enough to test the loop and makes early tuning easier.

## Entities

### Player

- Shape: small blue circle.
- Movement: top-down acceleration-free movement with normalized diagonal speed.
- Role: gather wood and trigger tower construction.
- The player cannot die in Stage 0. This keeps the failure condition focused on the caravan core.

### Caravan Core

- Shape: large green rectangle.
- Health: starts at 100.
- Movement: moves right at a constant speed.
- Build radius: towers can only be placed within a fixed distance of the core.
- Failure: game ends when health reaches 0.

### Wood Node

- Shape: brown circle.
- Contains a finite amount of wood.
- When the player is within gather range, wood is transferred over time into inventory.
- A depleted node disappears.

### Arrow Tower

- Shape: grey square with a thin range circle in debug styling.
- Cost: 20 wood.
- Placement: pressing `Space` places the next tower in a ring around the caravan core, if the player has enough wood.
- Attack: fires automatically at the nearest enemy inside range.
- Projectile visuals may be simple lines or small circles.

### Enemy

- Shape: red circle.
- Movement: pursues the current caravan core position.
- Damage: deals contact damage to the caravan core on a short cooldown.
- Death: removed when health reaches 0.

## Core Rules

### Gathering

- Gather range: 34 pixels.
- Gather rate: 8 wood per second.
- Nodes contain 15 to 30 wood.
- Inventory wood is an integer shown in the HUD.

### Building

- Tower cost: 20 wood.
- The build action fails with no side effects if wood is below 20.
- Towers are placed in predefined offsets around the caravan core:
  - front, back, upper, lower, upper-front, lower-front, upper-back, lower-back.
- A slot can hold only one tower.
- Stage 0 does not support selling, moving, repairing, or upgrading towers.

### Combat

- Tower range: 190 pixels.
- Tower fire interval: 0.55 seconds.
- Tower damage: 10.
- Enemy health: 30.
- Tower target priority: nearest enemy in range.
- If no enemy is in range, the tower waits.

### Spawning

- The spawn director emits enemies on a simple elapsed-time schedule:
  - 0-30 seconds: one enemy every 4.0 seconds.
  - 30-90 seconds: one enemy every 2.8 seconds.
  - 90-180 seconds: one enemy every 2.0 seconds.
  - 180+ seconds: one enemy every 1.4 seconds.
- Spawn points are outside the current camera view, biased toward the caravan's forward direction.
- Stage 0 has no victory condition; the run continues until caravan health reaches 0. The elapsed-time HUD acts as the score.

### Caravan Damage

- Enemy contact range: 34 pixels from the caravan core center.
- Enemy contact damage: 5.
- Enemy damage cooldown: 1 second per enemy.
- Enemies are not destroyed by damaging the caravan.

## UI

HUD text appears in the top-left corner:

- Caravan HP: `100/100`
- Wood: current amount
- Time: elapsed run time
- Towers: placed count and max slot count
- Build hint: `Space: Tower (20 wood)`

On game over, center text shows:

- `Caravan Destroyed`
- Survived time
- `Press R to restart`

## Architecture

Suggested file responsibilities for the later implementation plan:

- `src/main.ts`: Phaser bootstrapping.
- `src/scenes/GameScene.ts`: scene lifecycle, input, entity shape creation, update loop, HUD.
- `src/game/math.ts`: distance, clamping, vector helpers.
- `src/game/inventory.ts`: wood inventory and spending rules.
- `src/game/combat.ts`: target selection and damage helpers.
- `src/game/spawnDirector.ts`: elapsed-time spawn intervals.
- `src/game/buildSlots.ts`: tower slot offsets and placement selection.
- `tests/*.test.ts`: unit tests for pure TypeScript rules.

The implementation may adjust filenames if the Vite/Phaser template has established conventions, but the same boundaries should remain.

## Testing

Automated tests should cover:

- Inventory refuses to spend wood when the player cannot afford a tower.
- Inventory subtracts exactly the tower cost when building succeeds.
- Target selection chooses the nearest enemy inside range.
- Target selection ignores enemies outside range.
- Damage application removes enemies at 0 health.
- Spawn director returns shorter intervals as elapsed time increases.
- Build slots refuse occupied slots and return the next open slot.

Manual playtest checklist:

- The game starts in the browser without console errors.
- WASD movement works, including normalized diagonal movement.
- Wood increases while standing near a node.
- `Space` builds a tower only when wood is at least 20.
- Towers shoot nearby enemies automatically.
- Enemies pursue and damage the caravan.
- Game over appears when caravan health reaches 0.
- `R` restarts the run.

## Acceptance Criteria

The Stage 0 prototype is complete when:

- `npm test` passes.
- `npm run build` passes.
- Running the dev server opens a playable Phaser scene.
- A user can survive at least 60 seconds with basic gathering and tower placement.
- A careless user can lose through caravan damage.
- No copyrighted assets, names, UI layouts, screenshots, or audio from the reference game are used.

## Open Decisions Locked For Stage 0

- Use Phaser 3, not Phaser 2, because current Phaser documentation and package ecosystem target Phaser 3.
- Use TypeScript and Vite.
- Use greybox shapes only.
- Make the caravan the only fail state.
- Do not add upgrades, bosses, or multiple tower types until after Stage 0 is playable.
