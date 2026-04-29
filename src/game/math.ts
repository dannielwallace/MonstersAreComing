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
  if (maxDistance <= 0) {
    return { x: current.x, y: current.y };
  }

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
