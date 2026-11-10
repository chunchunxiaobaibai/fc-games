import type { Box } from '../rules/collision.ts';

export const VIEW_WIDTH = 256;
export const VIEW_HEIGHT = 240;
export const GROUND_Y = 208;

export interface Spawn {
  region: string;
  x: number;
  feet: number;
  airborne?: boolean;
}

export interface Tile extends Box {
  kind: 'ground' | 'brick' | 'stone' | 'question' | 'used' | 'pipe' | 'lift';
  item?: 'coin' | 'mushroom' | 'flower' | 'star' | 'one-up';
  art?: number;
  hidden?: boolean;
  bumpAt?: number;
  coinUntil?: number;
  multiCoin?: boolean;
  warp?: Spawn;
  warpDirection?: 'right';
  lift?: { top: number; bottom: number; period: number; offset: number; direction?: 1 | -1 };
  label?: string;
}

export interface EnemySpawn {
  x: number;
  y: number;
  kind: 'goomba' | 'koopa' | 'plant';
}

export interface Region {
  theme: 'surface' | 'underground';
  backtrack?: boolean;
  fixedCamera?: boolean;
  width: number;
  tiles: Tile[];
  spawns: EnemySpawn[];
  coins: Box[];
  background?: { x: number; y: number; art: number }[];
  signs?: { x: number; y: number; text: string }[];
}

export interface Level {
  id: string;
  title: string;
  summary: string;
  time: number;
  start: Spawn;
  finish: { region: string; flag: number; castle: number };
  createRegions: () => Record<string, Region>;
}
