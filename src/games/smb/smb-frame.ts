import { component } from '@xiaobaibaifqy/jingchuanchu-ecs';
import type { Box } from './rules/collision.ts';
import type { Power, SmbSession } from './smb-session.ts';

type Point = Pick<Box, 'x' | 'y'>;

export function captureSmbFrame(state: SmbSession) {
  const positions = new Map<Box, { x: number; feet: number }>();
  for (const group of [state.pickups, state.enemies, state.shots, state.area.tiles.filter((tile) => tile.lift)]) {
    for (const body of group) positions.set(body, { x: body.x, feet: body.y + body.h });
  }
  return {
    region: state.region,
    camera: state.camera,
    flagY: state.flagY,
    castleFlagY: state.castleFlagY,
    elapsed: state.elapsed,
    playerX: state.player.x,
    feet: state.player.y + state.player.h,
    height: state.visualHeight,
    positions,
  };
}

export interface SmbPresentation {
  state: SmbSession;
  previous: ReturnType<typeof captureSmbFrame>;
  alpha: number;
  powerChange?: { from: Power; at: number };
}

export const SmbFrame = component<SmbPresentation>('smb-frame');

export function interpolateSmbFrame({ state, previous, alpha }: SmbPresentation) {
  // A pipe changes coordinate spaces. Draw the destination immediately.
  const mix = previous.region === state.region ? alpha : 1;
  const lerp = (from: number, to: number) => from + (to - from) * mix;
  return {
    camera: lerp(previous.camera, state.camera),
    flagY: lerp(previous.flagY, state.flagY),
    castleFlagY: lerp(previous.castleFlagY, state.castleFlagY),
    elapsed: lerp(previous.elapsed, state.elapsed),
    playerX: lerp(previous.playerX, state.player.x),
    feet: lerp(previous.feet, state.player.y + state.player.h),
    height: lerp(previous.height, state.visualHeight),
    position(body: Box): Point {
      const prior = previous.positions.get(body);
      return prior ? { x: lerp(prior.x, body.x), y: lerp(prior.feet, body.y + body.h) - body.h } : body;
    },
  };
}
