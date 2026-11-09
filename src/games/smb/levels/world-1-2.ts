import { GROUND_Y, type Level, type Region, type Spawn, type Tile } from './level.ts';

const ground = (x: number, end: number): Tile =>
  ({ x, y: GROUND_Y, w: end - x, h: 32, kind: 'ground' });
const tile = (x: number, y: number, kind: Tile['kind'] = 'brick', item?: Tile['item']): Tile =>
  ({ x, y, w: 16, h: 16, kind, item });
const row = (x: number, y: number, count: number, kind: Tile['kind'] = 'brick') =>
  Array.from({ length: count }, (_, index) => tile(x + index * 16, y, kind));
const pipe = (x: number, top: number, bottom: number, warp?: Spawn, label?: string): Tile =>
  ({ x, y: top, w: 32, h: bottom - top, kind: 'pipe', warp, label });
const lift = (x: number, top: number, offset: number): Tile =>
  ({ x, y: top, w: 48, h: 8, kind: 'lift', lift: { top, bottom: 200, period: 4, offset } });

export function createWorld12(): Record<'surface' | 'cave' | 'exit', Region> {
  return {
    surface: {
      theme: 'surface', width: 256, spawns: [], coins: [],
      tiles: [ground(0, 256), pipe(144, 176, GROUND_Y, { region: 'cave', x: 32, feet: GROUND_Y }),
        ...row(208, 144, 3, 'stone'), ...row(224, 160, 2, 'stone'), ...row(240, 176, 1, 'stone')],
      signs: [{ x: 144, y: 122, text: 'ENTRANCE' }],
    },
    cave: {
      theme: 'underground', backtrack: true, width: 1888,
      tiles: [
        ground(0, 1072), ground(1296, 1888),
        ...row(0, 32, 59), ...row(224, 144, 11),
        tile(160, 144, 'question', 'mushroom'), tile(176, 144, 'question', 'coin'),
        ...row(416, 160, 6), ...row(512, 128, 8), ...row(656, 144, 4),
        pipe(768, 176, GROUND_Y), ...row(848, 144, 5),
        tile(912, 128, 'question', 'flower'), ...row(992, 128, 3),
        lift(1096, 136, 0), lift(1192, 88, 2),
        ...row(1280, 104, 9, 'stone'), ...row(1504, 104, 24, 'stone'),
        pipe(1472, 176, GROUND_Y, { region: 'exit', x: 42, feet: 176 }),
        pipe(1600, 72, 104, undefined, '4-1'), pipe(1696, 72, 104, undefined, '3-1'),
        pipe(1792, 72, 104, undefined, '2-1'),
      ],
      spawns: [
        { x: 336, y: 194, kind: 'goomba' }, { x: 384, y: 194, kind: 'goomba' },
        { x: 610, y: 189, kind: 'koopa' }, { x: 775, y: 176, kind: 'plant' },
        { x: 928, y: 194, kind: 'goomba' },
      ],
      coins: [
        ...Array.from({ length: 7 }, (_, index) => ({ x: 516 + index * 16, y: 100, w: 8, h: 12 })),
        { x: 1138, y: 120, w: 8, h: 12 }, { x: 1220, y: 106, w: 8, h: 12 },
      ],
      signs: [{ x: 1472, y: 143, text: 'EXIT' }, { x: 1624, y: 31, text: 'WARP ZONE' }],
    },
    exit: {
      theme: 'surface', width: 512, spawns: [], coins: [],
      tiles: [ground(0, 512), pipe(32, 176, GROUND_Y), ...row(240, 192, 4, 'stone'),
        ...row(256, 176, 3, 'stone'), ...row(272, 160, 2, 'stone'), tile(288, 144, 'stone'),
        tile(344, 192, 'stone')],
    },
  };
}

export const World12: Level = {
  id: '1-2',
  title: '地下洞窟',
  summary: '从地面管道进入洞窟，越过食人花和升降台，再出管回到地面。顶层的跳关管道暂未开放。',
  time: 400,
  start: { region: 'surface', x: 32, feet: GROUND_Y },
  finish: { region: 'exit', flag: 352, castle: 432 },
  createRegions: createWorld12,
};
