import { GROUND_Y, type Level } from './level.ts';
import { classicRegion } from './classic-layout.ts';
import { layout12 } from './classic-layout-data.ts';

export function createWorld12() {
  const entrance = { region: 'cave', x: 48, feet: 48, airborne: true };
  const bonus = { region: 'bonus', x: 16, feet: 48, airborne: true };
  const exit = { region: 'exit', x: 58, feet: 176 };
  const bonusExit = { region: 'cave', x: 115 * 16 + 10, feet: 176 };
  const cave = classicRegion(layout12, { x: 0, y: 18, columns: 192, underground: true, backtrack: true, portals: [
    { x: 103, y: 28, to: bonus },
    { x: 166, y: 26, side: true, to: exit }, { x: 166, y: 27, side: true, to: exit },
    { x: 178, y: 28, label: '4-1' }, { x: 182, y: 28, label: '3-1' }, { x: 186, y: 28, label: '2-1' },
  ] });
  cave.signs = [{ x: 178 * 16, y: 134, text: 'WARP ZONE' }];
  return {
    surface: classicRegion(layout12, { x: 0, y: 0, columns: 26, fixedCamera: true, portals: [
      { x: 10, y: 11, side: true, to: entrance }, { x: 10, y: 12, side: true, to: entrance },
    ] }),
    cave,
    bonus: classicRegion(layout12, { x: 100, y: 36, columns: 17, underground: true, fixedCamera: true, portals: [
      { x: 113, y: 47, side: true, to: bonusExit }, { x: 113, y: 48, side: true, to: bonusExit },
    ] }),
    exit: classicRegion(layout12, { x: 150, y: 0, columns: 42 }),
  };
}

export const World12: Level = {
  id: '1-2',
  title: '地下洞窟',
  summary: '向右进入洞窟，穿过低顶砖道、奖励房与升降台，再出管回到地面。顶层的跳关管道暂未开放。',
  time: 400,
  start: { region: 'surface', x: 32, feet: GROUND_Y },
  finish: { region: 'exit', flag: (172 - 150) * 16, castle: (179 - 150) * 16 - 30 },
  createRegions: createWorld12,
};
