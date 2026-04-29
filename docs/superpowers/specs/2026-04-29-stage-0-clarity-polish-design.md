# Stage 0 Clarity Polish Design

## Purpose

Improve the Stage 0 greybox prototype's readability without expanding scope. The player should understand the loop faster: gather wood, build towers, defend the caravan. This pass focuses on Chinese HUD and feedback text, not new gameplay systems.

## Scope

Included:

- Convert player-facing HUD and temporary feedback text to Simplified Chinese.
- Add a dynamic objective line that tells the player what to focus on.
- Add short feedback messages for failed build attempts.
- Add gathering feedback while the player is collecting wood.
- Add caravan damage feedback when enemies hit the caravan.
- Keep the existing Stage 0 controls, entities, win/loss rules, and greybox visuals.
- Preserve `npm test` and `npm run build`.

Excluded:

- New enemies, new buildings, upgrades, tutorials, menus, audio, art assets, localization framework, save data, and large balance changes.

## Text Policy

All visible in-game HUD and feedback text in this pass should be Simplified Chinese. Code identifiers, filenames, tests, and comments can stay English.

Required visible text:

- Caravan health: `行城生命：当前/最大`
- Wood: `木材：数量`
- Time: `时间：秒`
- Towers: `箭塔：已建/上限`
- Build hint: `空格：建造箭塔（20 木材）`
- Objective labels:
  - `目标：采集木材`
  - `目标：建造箭塔`
  - `目标：防守行城`
- Failed build messages:
  - `木材不足，需要 20`
  - `箭塔槽位已满`
- Gathering message:
  - `采集中 +8/秒`
- Damage warning:
  - `行城遭到攻击！`
- Game over:
  - `行城被摧毁`
  - `坚持时间：X.X 秒`
  - `按 R 重新开始`

## Objective Logic

The objective line should be derived from current state:

1. If at least one living enemy is close enough to threaten the caravan, show `目标：防守行城`.
2. Else if current wood is at least the tower cost and at least one build slot is open, show `目标：建造箭塔`.
3. Else show `目标：采集木材`.

Threat range can be a simple distance threshold around the caravan, for example 260 pixels. This does not need a new pure logic module unless implementation naturally benefits from one.

## Feedback Messages

Temporary feedback messages should be shown near the HUD or center-top area and fade or disappear after a short duration.

Rules:

- Build failure due to low wood shows `木材不足，需要 20`.
- Build failure due to no open slots shows `箭塔槽位已满`.
- While the player is actively gathering, show `采集中 +8/秒`.
- When any enemy damages the caravan, show `行城遭到攻击！` and briefly tint the caravan red.
- Feedback messages should not permanently overlap the HUD.

## Visual Treatment

Keep greybox style:

- Text can remain monospace if Chinese renders correctly in the browser; otherwise use a generic sans-serif fallback.
- Temporary warnings should use warm colors such as yellow or red.
- Caravan damage tint should be brief enough to read as feedback, not a new state.
- No images, icons, audio, or animation systems are required.

## Architecture

The implementation can stay inside `GameScene.ts` because this is a small feedback pass. If helper functions are added, they should be simple and local unless they become useful for tests.

Recommended additions:

- A small `feedbackText` object for temporary messages.
- A short `feedbackTimer`.
- A short `caravanDamageFlashTimer`.
- A helper to compute objective text.
- A helper to set temporary feedback text.

Avoid adding a full localization system for Stage 0.

## Testing

Automated tests should remain focused on pure rules. If a new pure helper is extracted for objective selection, add tests for it. If the objective logic remains Phaser-scene-local, manual verification plus build is acceptable for this pass.

Manual checklist:

- HUD uses Chinese labels.
- Objective starts as `目标：采集木材`.
- When wood reaches 20 and a tower slot is open, objective changes to `目标：建造箭塔`.
- When enemies threaten the caravan, objective changes to `目标：防守行城`.
- Pressing `Space` without enough wood shows `木材不足，需要 20`.
- Filling all tower slots then pressing `Space` shows `箭塔槽位已满`.
- Standing near wood shows `采集中 +8/秒`.
- Caravan damage shows `行城遭到攻击！` and briefly tints the caravan red.
- Game over text is Chinese.
- `npm test` passes.
- `npm run build` passes.

## Acceptance Criteria

This pass is complete when:

- All Stage 0 player-facing HUD and feedback text listed in this spec is Chinese.
- Failed build actions explain why they failed.
- Gathering and caravan damage have visible feedback.
- The dynamic objective line reflects gather/build/defend state.
- No new gameplay systems are introduced.
- Tests and build pass.
