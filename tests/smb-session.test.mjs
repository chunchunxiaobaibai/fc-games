import assert from 'node:assert/strict';
import test from 'node:test';
import { moveBody } from '../src/games/smb/rules/collision.ts';
import { captureSmbFrame, interpolateSmbFrame } from '../src/games/smb/smb-frame.ts';
import { SIMULATION_HZ, SmbSession } from '../src/games/smb/smb-session.ts';

const dt = 1 / SIMULATION_HZ;
const idle = {
  direction: 0, sprint: false, jump: false, jumpPressed: false, downPressed: false, firePressed: false,
};
const stand = (game, x, floor = 208) => {
  Object.assign(game.player, { x, y: floor - game.player.h, vx: 0, vy: 0, grounded: true });
};
const jump = (game) => {
  game.step(dt, { ...idle, jump: true, jumpPressed: true });
  for (let frame = 0; frame < 54; frame++) game.step(dt, { ...idle, jump: true });
};

test('axis sweep stops at the nearest wall or ceiling regardless of tile order', () => {
  const firstWall = { x: 16, y: 0, w: 8, h: 32 };
  const secondWall = { x: 24, y: 0, w: 8, h: 32 };
  const ceiling = { x: 0, y: 0, w: 16, h: 4 };
  const body = { x: 4, y: 16, w: 6, h: 8, vx: 100, vy: -100, grounded: false };
  const hit = moveBody(body, [secondWall, firstWall, ceiling], 0.3);
  assert.equal(hit.wall, firstWall);
  assert.equal(hit.ceiling, ceiling);
  assert.deepEqual([body.x, body.y, body.vx, body.vy], [10, 4, 0, 0]);
});

test('holding jump rises higher than tapping, and sprint increases speed', () => {
  const short = new SmbSession();
  const long = new SmbSession();
  short.step(dt, { ...idle, jump: true, jumpPressed: true });
  long.step(dt, { ...idle, jump: true, jumpPressed: true });
  for (let i = 0; i < 17; i++) {
    short.step(dt, { ...idle, direction: 1 });
    long.step(dt, { ...idle, direction: 1, sprint: true, jump: true });
  }
  assert.ok(long.player.y < short.player.y - 20);
  assert.ok(long.player.vx > short.player.vx);
});

test('fall accelerates until landing and a jump just before landing is buffered', () => {
  const game = new SmbSession();
  Object.assign(game.player, { y: 100, grounded: false });
  game.step(dt, idle);
  const firstSpeed = game.player.vy;
  game.step(dt, idle);
  assert.ok(game.player.vy > firstSpeed);
  Object.assign(game.player, { y: 192, vy: 100 });
  game.step(dt, { ...idle, jumpPressed: true, jump: true });
  assert.equal(game.player.grounded, true);
  assert.equal(game.player.y + game.player.h, 208);
  game.step(dt, { ...idle, jump: true });
  assert.ok(game.player.vy < 0);
});

test('growth waits for headroom, then animates without moving the feet', () => {
  const game = new SmbSession();
  game.map.surface.tiles.push({ x: 30, y: 170, w: 16, h: 16, kind: 'stone' });
  game.power = 'big';
  game.step(dt, idle);
  assert.equal(game.player.h, 15);
  assert.equal(game.visualHeight, 15);
  stand(game, 49);
  game.step(dt, idle);
  assert.equal(game.player.h, 26);
  assert.equal(game.player.y + game.player.h, 208);
  game.step(dt, idle);
  assert.ok(game.visualHeight > 15 && game.visualHeight < 26);
  for (let i = 0; i < 10; i++) game.step(dt, idle);
  assert.equal(game.visualHeight, 26);
  assert.equal(game.player.y + game.player.h, 208);
});

test('player and camera interpolate together, while a pipe jump snaps to its destination', () => {
  const state = new SmbSession();
  stand(state, 920, 160);
  state.camera = 810;
  const previous = captureSmbFrame(state);
  state.player.x += 4;
  state.camera += 4;
  const view = interpolateSmbFrame({ state, previous, alpha: 0.5 });
  assert.equal(view.playerX, 922);
  assert.equal(view.playerX - view.camera, 110);
  assert.equal(view.feet, 160);
  state.step(dt, { ...idle, downPressed: true });
  assert.equal(state.region, 'bonus');
  const warped = interpolateSmbFrame({ state, previous, alpha: 0.5 });
  assert.equal(warped.playerX, state.player.x);
  assert.equal(warped.camera, 0);
  assert.equal(warped.feet, 208);
});

test('question block pays once, mushroom grows the player and larger player can break a brick', () => {
  const game = new SmbSession();
  game.actors.surface.length = 0;
  stand(game, 242);
  jump(game);
  jump(game);
  assert.equal(game.hud.coins, 1);
  assert.equal(game.map.surface.tiles.find((tile) => tile.x === 240)?.kind, 'used');

  stand(game, 321);
  jump(game);
  const mushroom = game.items.surface[0];
  assert.equal(mushroom.kind, 'mushroom');
  stand(game, mushroom.x, mushroom.y + mushroom.h);
  game.step(dt, idle);
  assert.equal(game.power, 'big');
  assert.equal(game.player.h, 26);
  stand(game, 305);
  jump(game);
  assert.equal(game.map.surface.tiles.some((tile) => tile.x === 304 && tile.kind === 'brick'), false);
});

test('fire flower changes form and a fireball defeats an enemy', () => {
  const game = new SmbSession();
  const enemy = game.actors.surface[0];
  game.actors.surface.length = 0;
  game.power = 'big';
  stand(game, 497);
  jump(game);
  const flower = game.items.surface[0];
  assert.equal(flower.kind, 'flower');
  stand(game, flower.x, flower.y + flower.h);
  game.step(dt, idle);
  assert.equal(game.power, 'fire');
  stand(game, 525);
  Object.assign(enemy, { x: 567, y: 194, vx: 0, active: true });
  game.actors.surface.push(enemy);
  game.step(dt, { ...idle, firePressed: true });
  for (let frame = 0; frame < 20; frame++) game.step(dt, idle);
  assert.equal(enemy.dead, true);
  assert.equal(game.shots.length, 0);
});

test('a stomp creates a stationary shell that can hit another enemy and return into the player', () => {
  const game = new SmbSession();
  const [target, bystander] = game.actors.surface;
  game.actors.surface.splice(2);
  Object.assign(target, { x: 400, y: 189, kind: 'koopa', h: 19, active: true, vx: 0 });
  Object.assign(bystander, { x: 430, y: 194, active: true, vx: 0 });
  stand(game, 400, 188);
  Object.assign(game.player, { vy: 160, grounded: false });
  game.step(dt, idle);
  assert.equal(target.kind, 'shell');
  assert.equal(target.vx, 0);
  for (let i = 0; i < 12; i++) game.step(dt, idle);
  stand(game, 390);
  game.step(dt, idle);
  assert.ok(target.vx > 0);
  for (let i = 0; i < 65 && game.hud.phase === 'playing'; i++) game.step(dt, idle);
  assert.equal(bystander.dead, true);
  assert.ok(target.vx < 0);
  assert.equal(game.hud.lives, 2);
  assert.equal(game.hud.phase, 'lost');
  game.step(dt, idle);
  assert.equal(game.hud.lives, 2);
});

test('warping to the bonus room and back preserves time, coins, size, and used blocks', () => {
  const game = new SmbSession();
  game.actors.surface.length = 0;
  stand(game, 242);
  jump(game);
  const time = game.hud.time;
  game.power = 'big';
  stand(game, 920, 160);
  game.step(dt, { ...idle, downPressed: true });
  assert.equal(game.region, 'bonus');
  const bonusCoin = game.map.bonus.coins[0];
  stand(game, bonusCoin.x, bonusCoin.y + bonusCoin.h);
  game.step(dt, idle);
  assert.equal(game.hud.coins, 2);
  stand(game, 216, 176);
  game.step(dt, { ...idle, downPressed: true });
  assert.equal(game.region, 'surface');
  assert.ok(game.player.x > 944);
  assert.equal(game.hud.coins, 2);
  assert.equal(game.power, 'big');
  assert.ok(game.hud.time <= time && game.hud.time > time - 2);
  assert.equal(game.map.surface.tiles.find((tile) => tile.x === 240)?.kind, 'used');
  assert.equal(game.map.bonus.coins.includes(bonusCoin), false);
});

test('a pit costs one life and timeout settles once', () => {
  const game = new SmbSession();
  stand(game, 1098);
  for (let i = 0; i < 60; i++) game.step(dt, idle);
  assert.equal(game.hud.failure, '掉进了坑里');
  assert.equal(game.hud.lives, 2);

  const retry = new SmbSession(game.hud);
  for (let i = 0; i < 61 * 161; i++) retry.step(dt, idle);
  assert.equal(retry.hud.time, 0);
  assert.equal(retry.hud.failure, '时间用尽');
  assert.equal(retry.hud.lives, 1);
});

test('World 1-1 is traversable using only sprint and jumps, and finishes once', () => {
  const game = new SmbSession();
  const jumpTargets = [
    350, 390, 480, 550, 658, 692, 801, 838, 960, 1052, 1250, 1334,
    1530, 1820, 1960, 2120, 2240, 2320, 2398, 2597, 2775, 2815, 2933, 3030, 3080,
  ];
  let hold = 0;
  for (let i = 0; i < 1500 && game.hud.phase !== 'cleared'; i++) {
    const pressed = game.player.grounded && game.player.x >= jumpTargets[0];
    if (pressed) {
      jumpTargets.shift();
      hold = 40;
    }
    game.step(dt, { ...idle, direction: 1, sprint: true, jump: hold > 0, jumpPressed: pressed });
    hold--;
  }
  assert.equal(game.hud.phase, 'cleared');
  assert.equal(game.hud.lives, 3);
  assert.ok(game.hud.score > 3000);
  const { score, time } = game.hud;
  game.step(dt, idle);
  assert.deepEqual([game.hud.score, game.hud.time], [score, time]);
});
