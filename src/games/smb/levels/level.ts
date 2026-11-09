import type { Box } from '../rules/collision.ts';

export const VIEW_WIDTH = 256;
export const VIEW_HEIGHT = 240;
export const GROUND_Y = 208;

export interface Spawn {
  region: string;
  x: number;
  feet: number;
}

export interface Tile extends Box {
  kind: 'ground' | 'brick' | 'stone' | 'question' | 'used' | 'pipe' | 'lift';
  item?: 'coin' | 'mushroom' | 'flower';
  warp?: Spawn;
  lift?: { top: number; bottom: number; period: number; offset: number };
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
  width: number;
  tiles: Tile[];
  spawns: EnemySpawn[];
  coins: Box[];
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
