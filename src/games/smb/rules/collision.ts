// The AABB overlap test is adapted from mario_js/lib/util/physics.js (MIT).
export interface Box { x: number; y: number; w: number; h: number }

export interface Body extends Box {
  vx: number;
  vy: number;
  grounded: boolean;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Sweep one axis at a time so a step resolves against the first surface reached. */
export function moveBody<T extends Box & { hidden?: boolean }>(body: Body, solids: readonly T[], dt: number) {
  const startX = body.x;
  const startY = body.y;
  const dx = body.vx * dt;
  const dy = body.vy * dt;
  let x = startX + dx;
  let y = startY + dy;
  let wall: T | undefined;
  let floor: T | undefined;
  let ceiling: T | undefined;

  for (const tile of solids) {
    if (tile.hidden) continue;
    if (startY >= tile.y + tile.h || startY + body.h <= tile.y) continue;
    if (dx > 0 && startX + body.w <= tile.x && x + body.w >= tile.x) {
      x = tile.x - body.w;
      wall = tile;
    } else if (dx < 0 && startX >= tile.x + tile.w && x <= tile.x + tile.w) {
      x = tile.x + tile.w;
      wall = tile;
    }
  }

  for (const tile of solids) {
    if (x >= tile.x + tile.w || x + body.w <= tile.x) continue;
    if (!tile.hidden && dy > 0 && startY + body.h <= tile.y && y + body.h >= tile.y) {
      y = tile.y - body.h;
      floor = tile;
    } else if (dy < 0 && startY >= tile.y + tile.h && y <= tile.y + tile.h) {
      y = tile.y + tile.h;
      ceiling = tile;
    }
  }

  body.x = x;
  body.y = y;
  if (wall) body.vx = 0;
  if (floor || ceiling) body.vy = 0;
  body.grounded = Boolean(floor);
  return { wall, floor, ceiling };
}
