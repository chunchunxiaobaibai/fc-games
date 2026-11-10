import type { Layout } from './classic-layout-data.ts';
import type { EnemySpawn, Region, Spawn, Tile } from './level.ts';

interface RegionSpec {
  x: number;
  y: number;
  columns: number;
  underground?: boolean;
  backtrack?: boolean;
  fixedCamera?: boolean;
  portals?: { x: number; y: number; side?: boolean; to?: Spawn; label?: string }[];
}

const itemFor = (id: number | undefined): Tile['item'] =>
  id === 608 ? 'mushroom' : id === 52 || id === 68 ? 'one-up' :
    id === 96 || id === 112 ? 'star' : id === 144 || id === 160 ? 'coin' : undefined;

export function classicRegion(layout: Layout, spec: RegionSpec): Region {
  const { x, y, columns, underground, backtrack, fixedCamera } = spec;
  const region: Region = { width: columns * 16, theme: underground ? 'underground' : 'surface',
    backtrack, fixedCamera, tiles: [], spawns: [], coins: [], background: [] };
  const inBounds = (col: number, row: number) => col >= x && col < x + columns && row >= y && row < y + 15;
  const key = (col: number, row: number) => row * 256 + col;
  const collectibles = new Map<number, number>();
  for (const [row, first, last, art] of layout.collectibles) {
    for (let col = first; col <= last; col++) if (inBounds(col, row)) collectibles.set(key(col, row), art);
  }
  const background = region.background!;
  for (const [row, first, last, art] of layout.background) {
    for (let col = first; col <= last; col++) {
      if (inBounds(col, row)) background.push({ x: (col - x) * 16, y: (row - y) * 16, art });
    }
  }
  for (const [row, first, last, art] of underground ? layout.underground : layout.foreground) {
    for (let col = Math.max(first, x); col <= Math.min(last, x + columns - 1); col++) {
      if (!inBounds(col, row)) continue;
      const px = (col - x) * 16;
      const py = (row - y) * 16;
      if (art === 101 || art === 149 || art === 152 || art === 810 || art === 811) continue;
      if (art === 144 || art === 160) {
        region.coins.push({ x: px + 4, y: py + 2, w: 8, h: 12 });
        continue;
      }
      const item = itemFor(collectibles.get(key(col, row)));
      collectibles.delete(key(col, row));
      const box = { x: px, y: py, w: 16, h: 16, art };
      const portal = spec.portals?.find((candidate) => candidate.x === col && candidate.y === row);
      if (portal) {
        const verticalCap = !portal.side;
        region.tiles.push({ ...box, kind: 'pipe', w: verticalCap ? 32 : 16,
          warp: portal.to, warpDirection: portal.side ? 'right' : undefined, label: portal.label });
        continue;
      }
      if (spec.portals?.some((candidate) => !candidate.side && candidate.x + 1 === col && candidate.y === row)) continue;
      if (art === 384 || art === 400) {
        const end = Math.min(last, x + columns - 1);
        region.tiles.push({ ...box, kind: 'ground', w: (end - col + 1) * 16 });
        col = end;
      } else if (art === 192 || art === 208) region.tiles.push({ ...box, kind: 'question', item: item ?? 'coin' });
      else if (art === 289 || art === 290 || art === 306) {
        region.tiles.push({ ...box, kind: item && item !== 'coin' ? 'question' : 'brick', item, multiCoin: item === 'coin' });
      } else if (art === 809) {
        const down = col === 140;
        const top = -16;
        const bottom = 240;
        region.tiles.push({ ...box, kind: 'lift', w: 48, h: 8,
          lift: { top, bottom, period: (bottom - top) / 60, offset: (down ? py - top : bottom - py) / 60, direction: down ? 1 : -1 } });
      } else {
        region.tiles.push({ ...box, kind: 'stone' });
      }
    }
  }
  for (const [index, art] of collectibles) {
    if (itemFor(art) !== 'one-up') continue;
    region.tiles.push({ x: (index % 256 - x) * 16, y: (Math.floor(index / 256) - y) * 16,
      w: 16, h: 16, kind: 'question', hidden: true, item: 'one-up' });
  }
  for (const [row, first, last, art] of layout.enemies) {
    const kind: EnemySpawn['kind'] | undefined = [70, 71, 175, 176].includes(art) ? 'goomba' :
      [38, 39, 143, 144, 455].includes(art) ? 'koopa' : art === 149 ? 'plant' : undefined;
    if (!kind) continue;
    for (let col = first; col <= last; col++) {
      if (!inBounds(col, row)) continue;
      const px = (col - x) * 16;
      const py = (row - y + 1) * 16;
      const shifted = [71, 144, 176].includes(art) ? 8 : 0;
      region.spawns.push({ x: px + shifted + (kind === 'plant' ? 9 : 0),
        y: kind === 'goomba' ? py - 14 : kind === 'koopa' ? py + 16 - 19 : py + 16, kind });
    }
  }
  return region;
}
