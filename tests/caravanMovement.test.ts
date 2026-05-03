import { expect, test } from 'vitest';
import {
  buildForwardCells,
  computeForwardEdge,
  isObstacleBlocking,
  type ForwardCell,
} from '../src/game/caravanMovement';

const CELL_SIZE = 48;
const CARAVAN_GRID_SIZE = 2;

/** Helper: create obstacle at given position */
function obstacle(x: number, y: number, radius = 10, active = true) {
  return { position: { x, y }, radius, active };
}

test('buildForwardCells creates caravan body right edge cell', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, []);
  expect(cells).toHaveLength(1);
  expect(cells[0]).toEqual({
    xRight: 172 + CARAVAN_GRID_SIZE * CELL_SIZE,
    yTop: 312,
    yBottom: 312 + CARAVAN_GRID_SIZE * CELL_SIZE,
  });
});

test('buildForwardCells includes building slots on right edge', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  // Right-side slot at col=2, row=0
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, [
    { col: 2, row: 0 },
  ]);
  expect(cells).toHaveLength(2);
  expect(cells[1]).toEqual({
    xRight: 172 + 3 * CELL_SIZE, // col=2 → right edge = col+1
    yTop: 312,
    yBottom: 312 + CELL_SIZE,
  });
});

test('computeForwardEdge returns max right edge', () => {
  const cells: ForwardCell[] = [
    { xRight: 268, yTop: 0, yBottom: 96 },
    { xRight: 316, yTop: 0, yBottom: 48 },
  ];
  expect(computeForwardEdge(cells)).toBe(316);
});

test('obstacle in front and Y-aligned blocks movement', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, []);
  const forwardEdge = computeForwardEdge(cells); // 268
  const sweptEdge = forwardEdge + 10; // 278

  // Wood node: left edge = 290-18 = 272, which is >= 268 and < 278
  // Y=350 is within caravan Y range 312..408
  const woodNode = obstacle(290, 350, 18);
  expect(isObstacleBlocking(woodNode, forwardEdge, sweptEdge, cells)).toBe(true);
});

test('obstacle behind forward edge does not block', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, []);
  const forwardEdge = computeForwardEdge(cells); // 268
  const sweptEdge = forwardEdge + 10;

  // Obstacle left edge = 270 - 18 = 252, which is < 268
  const behind = obstacle(270, 350, 18);
  expect(isObstacleBlocking(behind, forwardEdge, sweptEdge, cells)).toBe(false);
});

test('obstacle in front but Y-mismatch does not block', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, []);
  const forwardEdge = computeForwardEdge(cells); // 268
  const sweptEdge = forwardEdge + 10;

  // Obstacle left edge = 290-10 = 280 >= 268, but y=500 is far below caravan Y 312..408
  const offPath = obstacle(290, 500, 10);
  expect(isObstacleBlocking(offPath, forwardEdge, sweptEdge, cells)).toBe(false);
});

test('inactive obstacle does not block', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, []);
  const forwardEdge = computeForwardEdge(cells);
  const sweptEdge = forwardEdge + 10;

  const inactive = obstacle(290, 350, 18, false);
  expect(isObstacleBlocking(inactive, forwardEdge, sweptEdge, cells)).toBe(false);
});

test('building extends forward edge; obstacle blocks only at building Y', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  // Building on right side at col=2, row=0
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, [
    { col: 2, row: 0 },
  ]);
  const forwardEdge = computeForwardEdge(cells); // 316 (extended by building)

  // Obstacle left edge = 320-10 = 310 < 316 → does NOT block (behind building)
  // Need obstacle with left edge >= 316: x=330, radius=10 → left=320
  const atBuildingY = obstacle(330, 330, 10);
  expect(isObstacleBlocking(atBuildingY, forwardEdge, forwardEdge + 10, cells)).toBe(true);

  // Obstacle at x=330, y=430 (below building Y=312..360, also below caravan body Y=312..408)
  const below = obstacle(330, 430, 10);
  expect(isObstacleBlocking(below, forwardEdge, forwardEdge + 10, cells)).toBe(false);
});

test('obstacle at caravan body Y but behind building edge does not block when building extends further', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, [
    { col: 2, row: 0 }, // building extends forward edge to 316
  ]);
  const forwardEdge = computeForwardEdge(cells); // 316

  // Obstacle left edge = 310-10 = 300 < 316 → does not block
  const behindBuilding = obstacle(310, 330, 10);
  expect(isObstacleBlocking(behindBuilding, forwardEdge, forwardEdge + 10, cells)).toBe(false);
});

test('simulated scenario: obstacle cleared, caravan resumes', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, []);
  const forwardEdge = computeForwardEdge(cells); // 268

  // Frame 1: obstacle at x=290 (left=272 >= 268) blocks
  let woodNode = obstacle(290, 350, 18, true);
  expect(isObstacleBlocking(woodNode, forwardEdge, forwardEdge + 10, cells)).toBe(true);

  // Frame 2: obstacle harvested (remaining=0 → active=false)
  woodNode = obstacle(290, 350, 18, false);
  expect(isObstacleBlocking(woodNode, forwardEdge, forwardEdge + 10, cells)).toBe(false);
});

test('multiple obstacles: any one blocking blocks movement', () => {
  const caravanTopLeft = { x: 172, y: 312 };
  const cells = buildForwardCells(caravanTopLeft, CARAVAN_GRID_SIZE, CELL_SIZE, []);
  const forwardEdge = computeForwardEdge(cells);
  const sweptEdge = forwardEdge + 10;

  const obstacles = [
    obstacle(290, 350, 18),   // blocks (left=272 >= 268, Y-aligned)
    obstacle(290, 500, 10),   // doesn't block (Y-mismatch)
    obstacle(260, 350, 18),   // doesn't block (left=242 < 268, behind)
  ];

  const isAnyBlocking = obstacles.some((o) =>
    isObstacleBlocking(o, forwardEdge, sweptEdge, cells),
  );
  expect(isAnyBlocking).toBe(true);
});
