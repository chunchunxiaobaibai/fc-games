import { GROUND_Y, type Level } from './level.ts';
import { classicRegion } from './classic-layout.ts';
import { layout11 } from './classic-layout-data.ts';

export { GROUND_Y, VIEW_HEIGHT, VIEW_WIDTH } from './level.ts';

export const FLAG_X = 198 * 16;
export const CASTLE_X = 205 * 16 - 30;

export function createWorld11() {
  return {
    surface: classicRegion(layout11, { x: 0, y: 0, columns: 224, portals: [
      { x: 57, y: 9, to: { region: 'bonus', x: 32, feet: 48, airborne: true } },
    ] }),
    bonus: classicRegion(layout11, { x: 0, y: 18, columns: 17, underground: true, fixedCamera: true, portals: [
      { x: 13, y: 29, side: true, to: { region: 'surface', x: 163 * 16 + 10, feet: 176 } },
      { x: 13, y: 30, side: true, to: { region: 'surface', x: 163 * 16 + 10, feet: 176 } },
    ] }),
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
