import { GROUND_Y, VIEW_WIDTH, type Level, type Region, type Tile } from './level.ts';
import type { Box } from '../rules/collision.ts';

export { GROUND_Y, VIEW_HEIGHT, VIEW_WIDTH } from './level.ts';

export const FLAG_X = 3168;
export const CASTLE_X = 3248;

const tile = (x: number, y: number, kind: Tile['kind']): Tile => ({ x, y, w: 16, h: 16, kind });
const brickRow = (x: number, y: number, count: number) =>
  Array.from({ length: count }, (_, i) => tile(x + i * 16, y, 'brick'));
const stairs = (x: number, height: number, descending = false) =>
  Array.from({ length: height }, (_, i) =>
    Array.from({ length: i + 1 }, (_, j) =>
      tile(x + (descending ? height - i - 1 : i) * 16, GROUND_Y - 16 * (j + 1), 'stone'),
    ),
  ).flat();
const ground = (x: number, end: number): Tile =>
  ({ x, y: GROUND_Y, w: end - x, h: 32, kind: 'ground' });
const pipe = (x: number, height: number, warp?: Tile['warp']): Tile =>
  ({ x, y: GROUND_Y - height, w: 32, h: height, kind: 'pipe', warp });
const question = (x: number, y: number, item: Tile['item']): Tile =>
  ({ ...tile(x, y, 'question'), item });
const coin = (x: number, y: number): Box => ({ x, y, w: 8, h: 12 });

export function createWorld11(): Record<'surface' | 'bonus', Region> {
  return {
    surface: {
      theme: 'surface',
      width: 3392,
      tiles: [
        ground(0, 1088), ground(1136, 1376), ground(1440, 2448), ground(2496, 3392),
        question(240, 144, 'coin'), tile(304, 144, 'brick'), question(320, 144, 'mushroom'),
        tile(336, 144, 'brick'), question(352, 144, 'coin'), tile(368, 144, 'brick'),
        question(336, 80, 'coin'), question(496, 144, 'flower'),
        pipe(448, 32), pipe(608, 48), pipe(752, 56), pipe(912, 48, { region: 'bonus', x: 24, feet: GROUND_Y }),
        ...brickRow(1200, 144, 2), question(1232, 144, 'mushroom'), ...brickRow(1248, 96, 6),
        ...brickRow(1472, 96, 3), question(1520, 96, 'coin'), ...brickRow(1600, 144, 4),
        question(1696, 144, 'coin'), question(1744, 144, 'flower'), question(1792, 144, 'coin'),
        question(1744, 80, 'coin'), ...brickRow(1920, 144, 3), ...brickRow(2032, 96, 4),
        question(2064, 144, 'coin'), ...stairs(2176, 4), ...stairs(2256, 4, true),
        ...stairs(2384, 4), ...stairs(2496, 4, true), pipe(2656, 32),
        ...brickRow(2720, 144, 2), question(2752, 144, 'coin'), tile(2768, 144, 'brick'),
        pipe(2880, 32), ...stairs(2992, 7), tile(FLAG_X - 8, 192, 'stone'),
      ],
      spawns: [
        { x: 416, y: 194, kind: 'goomba' }, { x: 560, y: 194, kind: 'goomba' },
        { x: 720, y: 189, kind: 'koopa' }, { x: 865, y: 194, kind: 'goomba' },
        { x: 1020, y: 194, kind: 'goomba' }, { x: 1320, y: 194, kind: 'goomba' },
        { x: 1570, y: 194, kind: 'goomba' }, { x: 1880, y: 189, kind: 'koopa' },
        { x: 2020, y: 194, kind: 'goomba' }, { x: 2315, y: 194, kind: 'goomba' },
        { x: 2840, y: 189, kind: 'koopa' },
      ],
      coins: [coin(622, 130), coin(764, 120), coin(1076, 158), coin(1104, 144), coin(1136, 158)],
    },
    bonus: {
      theme: 'underground',
      width: VIEW_WIDTH,
      tiles: [
        ground(0, VIEW_WIDTH), ...brickRow(0, 64, 5), ...brickRow(48, 160, 8),
        ...brickRow(64, 128, 6), pipe(208, 32, { region: 'surface', x: 958, feet: GROUND_Y }),
      ],
      spawns: [],
      coins: [96, 112, 128].flatMap((y) =>
        Array.from({ length: 8 }, (_, index) => coin(52 + index * 16, y - 12)),
      ),
    },
  };
}

export const World11: Level = {
  id: '1-1',
  title: '蘑菇王国',
  summary: '在蘑菇王国的第一关奔跑、跳过管道，抵达终点旗杆。',
  time: 400,
  start: { region: 'surface', x: 32, feet: GROUND_Y },
  finish: { region: 'surface', flag: FLAG_X, castle: CASTLE_X },
  createRegions: createWorld11,
};
