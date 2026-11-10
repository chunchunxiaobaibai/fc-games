import assert from 'node:assert/strict';
import test from 'node:test';
import { moveBody } from '../src/games/smb/rules/collision.ts';
import { captureSmbFrame, interpolateSmbFrame } from '../src/games/smb/smb-frame.ts';
import { World11 } from '../src/games/smb/levels/world-1-1.ts';
import { World12 } from '../src/games/smb/levels/world-1-2.ts';
import { BIG_MARIO_HEIGHT, SIMULATION_HZ, SMALL_MARIO_HEIGHT, SmbSession } from '../src/games/smb/smb-session.ts';

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

test('ground speed at takeoff makes a running jump higher and farther', () => {
  const measure = (sprint, approachFrames) => {
    const game = new SmbSession();
    for (let i = 0; i < approachFrames; i++) game.step(dt, { ...idle, direction: 1, sprint });
    const { x, y } = game.player;
    game.step(dt, { ...idle, direction: 1, sprint, jump: true, jumpPressed: true });
    const launchSpeed = game.player.vy;
    let highest = game.player.y;
    for (let i = 0; i < 120 && !game.player.grounded; i++) {
      game.step(dt, { ...idle, jump: true });
      highest = Math.min(highest, game.player.y);
    }
    assert.equal(game.player.grounded, true);
    return { launchSpeed, rise: y - highest, distance: game.player.x - x };
  };
  const standing = measure(false, 0);
  const sprintFromRest = measure(true, 0);
  const walking = measure(false, 48);
  const running = measure(true, 48);
  assert.equal(sprintFromRest.launchSpeed, standing.launchSpeed);
  assert.ok(running.rise > walking.rise + 8);
  assert.ok(running.distance > walking.distance + 30);
});

test('NES jump displaces before gravity and Mario size changes ceiling reach', () => {
  const measure = (power, sprint, ceiling) => {
    const game = new SmbSession({ score: 0, coins: 0, lives: 3, power });
    if (ceiling) game.area.tiles.push({ x: 32, y: 102, w: 16, h: 16, kind: 'stone' });
    if (sprint) game.player.vx = 150;
    const start = game.player.y;
    game.step(dt, { ...idle, direction: Number(sprint), sprint, jump: true, jumpPressed: true });
    const first = start - game.player.y;
    let apex = game.player.y;
    for (let i = 0; i < 120 && !game.player.grounded; i++) {
      game.step(dt, { ...idle, jump: true });
      apex = Math.min(apex, game.player.y);
    }
    return { first, height: start - apex };
  };
  for (const power of ['small', 'big']) {
    assert.deepEqual(measure(power, false, false), { first: 4, height: 66 });
    assert.deepEqual(measure(power, true, false), { first: 5, height: 82.5 });
  }
  assert.equal(measure('small', false, true).height, 66);
  assert.equal(measure('big', false, true).height, 62);
});

test('a ground release keeps running friction and an airborne release keeps momentum', () => {
  const run = { ...idle, direction: 1, sprint: true };
  const ground = new SmbSession();
  for (let i = 0; i < 48; i++) ground.step(dt, run);
  const x = ground.player.x;
  for (let i = 0; i < 50; i++) ground.step(dt, idle);
  assert.equal(ground.player.vx, 0);
  assert.ok(ground.player.x - x > 59 && ground.player.x - x < 61);

  const air = new SmbSession();
  for (let i = 0; i < 48; i++) air.step(dt, run);
  air.step(dt, { ...run, jump: true, jumpPressed: true });
  const speed = air.player.vx;
  for (let i = 0; i < 15; i++) air.step(dt, { ...idle, jump: true });
  assert.equal(air.player.grounded, false);
  assert.equal(air.player.vx, speed);
});

test('small Mario stops at a brick and big Mario continues rising after breaking it', () => {
  for (const power of ['small', 'big']) {
    const game = new SmbSession({ score: 0, coins: 0, lives: 3, power });
    const brick = { x: 32, y: 144, w: 16, h: 16, kind: 'brick' };
    game.area.tiles.push(brick);
    game.step(dt, { ...idle, jump: true, jumpPressed: true });
    for (let i = 0; i < 32 && game.player.y > brick.y + brick.h; i++) game.step(dt, { ...idle, jump: true });
    assert.equal(game.player.y, brick.y + brick.h);
    assert.equal(game.player.vy, power === 'small' ? 0 : -2 * SIMULATION_HZ);
    game.step(dt, { ...idle, jump: true });
    assert.equal(game.player.y < brick.y + brick.h, power === 'big');
    assert.equal(game.area.tiles.includes(brick), power === 'small');
  }
});

test('fall accelerates until landing and a jump just before landing is buffered', () => {
  const game = new SmbSession();
  Object.assign(game.player, { y: 100, grounded: false });
  game.step(dt, idle);
  const firstSpeed = game.player.vy;
  game.step(dt, idle);
  assert.ok(game.player.vy > firstSpeed);
  Object.assign(game.player, { y: 208 - game.player.h - 1, vy: 100 });
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
  assert.equal(game.player.h, SMALL_MARIO_HEIGHT);
  assert.equal(game.visualHeight, SMALL_MARIO_HEIGHT);
  stand(game, 49);
  game.step(dt, idle);
  assert.equal(game.player.h, BIG_MARIO_HEIGHT);
  assert.equal(game.player.y + game.player.h, 208);
  game.step(dt, idle);
  assert.ok(game.visualHeight > SMALL_MARIO_HEIGHT && game.visualHeight < BIG_MARIO_HEIGHT);
  for (let i = 0; i < 10; i++) game.step(dt, idle);
  assert.equal(game.visualHeight, BIG_MARIO_HEIGHT);
  assert.equal(game.player.y + game.player.h, 208);
});

test('player and camera interpolate together, while a pipe jump snaps to its destination', () => {
  const state = new SmbSession();
  stand(state, 920, 144);
  state.camera = 810;
  const previous = captureSmbFrame(state);
  state.player.x += 4;
  state.camera += 4;
  const view = interpolateSmbFrame({ state, previous, alpha: 0.5 });
  assert.equal(view.playerX, 922);
  assert.equal(view.playerX - view.camera, 110);
  assert.equal(view.feet, 144);
  state.step(dt, { ...idle, downPressed: true });
  assert.equal(state.region, 'bonus');
  const warped = interpolateSmbFrame({ state, previous, alpha: 0.5 });
  assert.equal(warped.playerX, state.player.x);
  assert.equal(warped.camera, 0);
  assert.equal(warped.feet, 48);
});

test('question block pays once, mushroom grows the player and larger player can break a brick', () => {
  const game = new SmbSession();
  game.actors.surface.length = 0;
  stand(game, 258);
  jump(game);
  jump(game);
  assert.equal(game.hud.coins, 1);
  assert.equal(game.map.surface.tiles.find((tile) => tile.x === 256)?.kind, 'used');

  stand(game, 337);
  jump(game);
  const mushroom = game.items.surface[0];
  assert.equal(mushroom.kind, 'mushroom');
  stand(game, mushroom.x, mushroom.y + mushroom.h);
  game.step(dt, idle);
  assert.equal(game.power, 'big');
  assert.equal(game.player.h, BIG_MARIO_HEIGHT);
  assert.ok(game.transformTime > 0);
  const feet = game.player.y + game.player.h;
  game.step(dt, { ...idle, direction: 1, jump: true, jumpPressed: true });
  assert.equal(game.player.y + game.player.h, feet);
  for (let i = 0; i < 30; i++) game.step(dt, idle);
  assert.ok(game.invulnerable > 0);
  stand(game, 321);
  jump(game);
  assert.equal(game.map.surface.tiles.some((tile) => tile.x === 320 && tile.kind === 'brick'), false);
});

test('fire flower changes form and a fireball defeats an enemy', () => {
  const game = new SmbSession();
  const enemy = game.actors.surface[0];
  game.actors.surface.length = 0;
  game.power = 'big';
  stand(game, 337);
  jump(game);
  const flower = game.items.surface[0];
  assert.equal(flower.kind, 'flower');
  stand(game, flower.x, flower.y + flower.h);
  game.step(dt, idle);
  assert.equal(game.power, 'fire');
  for (let i = 0; i < 30; i++) game.step(dt, idle);
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
  assert.equal(game.hud.phase, 'dying');
  for (let i = 0; i < 180; i++) game.step(dt, idle);
  assert.equal(game.hud.phase, 'lost');
  game.step(dt, idle);
  assert.equal(game.hud.lives, 2);
});

test('a side hit plays a single death arc before showing the result', () => {
  const sounds = [];
  const game = new SmbSession(undefined, (sound) => sounds.push(sound));
  const [goomba] = game.actors.surface;
  Object.assign(goomba, { x: 42, y: 194, vx: 0, active: true });
  game.step(dt, idle);
  const { x, y } = game.player;
  const { time } = game.hud;
  assert.equal(game.hud.phase, 'dying');
  assert.equal(game.hud.lives, 2);
  assert.equal(game.hud.failure, '碰到了敌人');
  const input = { ...idle, direction: 1, sprint: true, jump: true, jumpPressed: true };
  for (let i = 0; i < 18; i++) game.step(dt, input);
  assert.ok(game.player.y < y - 50);
  assert.equal(game.player.x, x);
  for (let i = 18; i < 60; i++) game.step(dt, input);
  assert.ok(game.player.y >= 240);
  assert.equal(game.hud.phase, 'dying');
  for (let i = 60; i < 181; i++) game.step(dt, input);
  assert.equal(game.hud.phase, 'lost');
  assert.equal(game.hud.time, time);
  assert.equal(game.hud.lives, 2);
  assert.deepEqual(sounds, ['lose']);
});

test('warping to the bonus room and back preserves time, coins, size, and used blocks', () => {
  const game = new SmbSession();
  game.actors.surface.length = 0;
  stand(game, 258);
  jump(game);
  const time = game.hud.time;
  game.power = 'big';
  stand(game, 920, 144);
  game.step(dt, { ...idle, downPressed: true });
  assert.equal(game.region, 'bonus');
  const bonusCoin = game.map.bonus.coins[0];
  stand(game, bonusCoin.x, bonusCoin.y + bonusCoin.h);
  game.step(dt, idle);
  assert.equal(game.hud.coins, 2);
  stand(game, 196);
  game.step(dt, { ...idle, direction: 1 });
  assert.equal(game.region, 'surface');
  assert.equal(game.player.x, 2618);
  assert.equal(game.hud.coins, 2);
  assert.equal(game.power, 'big');
  assert.ok(game.hud.time <= time && game.hud.time > time - 2);
  assert.equal(game.map.surface.tiles.find((tile) => tile.x === 256)?.kind, 'used');
  assert.equal(game.map.bonus.coins.includes(bonusCoin), false);
});

test('a pit costs one life and timeout settles once', () => {
  const game = new SmbSession();
  stand(game, 1112);
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
  // Each pair is the grounded approach time and the jump hold time, in fixed ticks.
  const jumps = [
    [75, 40], [57, 40], [45, 40], [33, 40], [6, 40], [78, 40],
    [57, 40], [6, 40], [36, 40], [72, 5], [12, 5], [6, 40],
    [0, 40], [66, 40], [18, 40], [51, 40], [15, 40], [0, 40],
  ];
  const run = { ...idle, direction: 1, sprint: true };
  for (const [approach, hold] of jumps) {
    for (let frame = 0; frame < approach; frame++) game.step(dt, run);
    assert.equal(game.player.grounded, true);
    let airborne = false;
    for (let frame = 0; frame < 78 && game.hud.phase === 'playing'; frame++) {
      game.step(dt, { ...run, jump: frame < hold, jumpPressed: frame === 0 });
      airborne ||= !game.player.grounded;
      if (airborne && game.player.grounded) break;
    }
  }
  for (let frame = 0; frame < 850 && game.hud.phase !== 'cleared'; frame++) game.step(dt, idle);
  assert.equal(game.hud.phase, 'cleared');
  assert.equal(game.hud.lives, 3);
  assert.ok(game.hud.score > 3000);
  const { score, time } = game.hud;
  game.step(dt, idle);
  assert.deepEqual([game.hud.score, game.hud.time], [score, time]);
});

test('flagpole awards the five NES scores and counts down before launching fireworks', () => {
  const cases = [
    { feet: 192, points: 100, time: 21, bursts: 1 },
    { feet: 160, points: 400, time: 23, bursts: 3 },
    { feet: 124, points: 800, time: 26, bursts: 6 },
    { feet: 80, points: 2000, time: 22, bursts: 0 },
    { feet: 54, points: 5000, time: 24, bursts: 0 },
  ];
  for (const { feet, points, time, bursts } of cases) {
    const sounds = [];
    const game = new SmbSession(undefined, (sound) => sounds.push(sound), { ...World11, time });
    stand(game, game.level.finish.flag - 10, feet);
    game.player.grounded = false;
    game.step(dt, idle);
    assert.equal(game.hud.phase, 'flag');
    assert.equal(game.hud.score, 0);
    const phases = new Set(['flag']);
    for (let i = 0; i < 600 && game.hud.phase !== 'cleared'; i++) {
      game.step(dt, { ...idle, direction: -1, jump: true, jumpPressed: true });
      phases.add(game.hud.phase);
      if (game.hud.phase === 'flag-dismount') assert.equal(game.hud.score, points);
      if (game.hud.phase === 'castle') assert.equal(game.hud.time, time);
    }
    assert.deepEqual([...phases], ['flag', 'flag-dismount', 'castle', 'countdown', 'fireworks', 'cleared']);
    assert.equal(game.flagY, 176);
    assert.equal(game.castleFlagY, 114);
    assert.equal(game.hud.time, 0);
    assert.equal(game.hud.score, points + time * 50 + bursts * 500);
    assert.equal(sounds.filter((sound) => sound === 'clear').length, 1);
    assert.equal(sounds.filter((sound) => sound === 'firework').length, bursts);
    assert.ok(sounds.includes('timer'));
    const score = game.hud.score;
    game.step(dt, idle);
    assert.equal(game.hud.score, score);
  }
});

test('World 1-2 keeps progress through named pipes and leaves future warp destinations locked', () => {
  const game = new SmbSession({ score: 1500, coins: 8, lives: 2, power: 'fire' }, undefined, World12);
  assert.equal(game.region, 'surface');
  assert.equal(game.player.h, BIG_MARIO_HEIGHT);
  assert.deepEqual([game.hud.time, game.hud.score, game.hud.coins, game.hud.lives], [400, 1500, 8, 2]);
  stand(game, 148);
  game.step(dt, { ...idle, direction: 1 });
  assert.equal(game.region, 'cave');
  assert.equal(game.player.x, 48);
  const bonusEntrance = game.area.tiles.find((tile) => tile.warp?.region === 'bonus');
  stand(game, bonusEntrance.x + 10, bonusEntrance.y);
  game.step(dt, { ...idle, downPressed: true });
  assert.equal(game.region, 'bonus');
  assert.equal(game.area.coins.length, 17);
  stand(game, 196);
  game.step(dt, { ...idle, direction: 1 });
  assert.equal(game.region, 'cave');
  for (const block of game.area.tiles.filter((tile) => tile.label)) {
    stand(game, block.x + 10, block.y);
    game.step(dt, { ...idle, downPressed: true });
    assert.equal(game.region, 'cave');
  }
  const farCamera = game.camera;
  const exit = game.area.tiles.find((tile) => tile.warp?.region === 'exit');
  stand(game, exit.x - game.player.w, 160);
  game.step(dt, idle);
  assert.ok(game.camera < farCamera);
  game.step(dt, { ...idle, direction: 1 });
  assert.equal(game.region, 'exit');
  assert.deepEqual([game.player.x, game.player.y + game.player.h], [58, 176]);
  assert.deepEqual([game.hud.score, game.hud.coins, game.hud.lives, game.power], [1500, 8, 2, 'fire']);
});

test('World 1-2 lifts carry a rider in both directions and allow a jump off', () => {
  for (const direction of [-1, 1]) {
    const game = new SmbSession(undefined, undefined, World12);
    game.region = 'cave';
    const lift = game.area.tiles.find((tile) => tile.lift?.direction === direction);
    stand(game, lift.x + 8, lift.y);
    const start = lift.y;
    for (let i = 0; i < 12; i++) game.step(dt, idle);
    assert.ok(direction * (lift.y - start) > 10);
    assert.ok(Math.abs(game.player.y + game.player.h - lift.y) < .001);
    game.step(dt, { ...idle, jumpPressed: true, jump: true });
    assert.equal(game.player.grounded, false);
    assert.ok(game.player.vy < 0);
  }
});

test('World 1-2 Piranha Plant waits when the pipe is occupied and damages an exposed visitor', () => {
  const game = new SmbSession(undefined, undefined, World12);
  game.region = 'cave';
  const plant = game.enemies.find((enemy) => enemy.kind === 'plant');
  game.elapsed = 1.3;
  stand(game, plant.x, plant.pipeTop);
  game.step(dt, idle);
  assert.equal(plant.active, false);
  stand(game, plant.x - 64);
  game.step(dt, idle);
  assert.equal(plant.active, true);
  assert.ok(plant.y < plant.pipeTop);
  stand(game, plant.x, plant.pipeTop);
  game.step(dt, idle);
  assert.equal(game.hud.phase, 'dying');
});

test('World 1-2 is traversable from the entrance to the flag as small Mario', () => {
  const game = new SmbSession(undefined, undefined, World12);
  const run = { ...idle, direction: 1, sprint: true };
  for (let tick = 0; tick < 200 && game.region === 'surface'; tick++) game.step(dt, { ...idle, direction: 1 });
  assert.equal(game.region, 'cave');
  for (let tick = 0; tick < 100 && !game.player.grounded; tick++) game.step(dt, idle);

  const traverse = (jumps) => {
    for (const [approach, hold] of jumps) {
      for (let tick = 0; tick < approach; tick++) game.step(dt, run);
      let airborne = false;
      for (let tick = 0; tick < 78 && game.hud.phase === 'playing' && game.region === 'cave'; tick++) {
        game.step(dt, { ...run, jump: tick < hold, jumpPressed: tick === 0 });
        airborne ||= !game.player.grounded;
        if (airborne && game.player.grounded) break;
      }
      assert.equal(game.hud.phase, 'playing');
    }
  };
  traverse([[40, 40], [38, 40], [56, 40], [60, 40]]);

  // Brake and reverse around the Koopas in the low corridor. Each segment
  // specifies fixed ticks, direction, sprint held, and jump held.
  const corridor = [
    [24, 1, true, false], [6, 0, false, false], [6, -1, false, true], [6, -1, false, false],
    [6, -1, true, false], [18, 1, true, false], [6, -1, true, false], [6, -1, false, false],
    [12, 1, true, false], [6, 0, false, false], [6, 0, false, true], [6, 0, false, false],
    [6, 1, true, true], [18, 1, true, false], [6, 0, false, false], [12, -1, false, false],
    [6, 1, true, true], [12, 1, true, false], [6, 0, false, false], [24, 1, true, false],
    [6, -1, false, false],
  ];
  let previousJump = false;
  for (const [ticks, direction, sprint, jump] of corridor) {
    for (let tick = 0; tick < ticks; tick++) {
      game.step(dt, { ...idle, direction, sprint, jump, jumpPressed: tick === 0 && jump && !previousJump });
    }
    previousJump = jump;
  }
  traverse([[54, 5], [39, 40], [90, 40], [15, 40], [15, 40], [9, 40], [30, 40], [102, 40], [0, 40]]);
  assert.equal(game.region, 'exit');
  for (let tick = 0; tick < 1000 && game.hud.phase !== 'cleared'; tick++) {
    game.step(dt, { ...run, jump: true, jumpPressed: game.player.grounded && game.player.vx === 0 });
  }
  assert.equal(game.hud.phase, 'cleared');
  assert.equal(game.hud.lives, 3);
  assert.equal(game.power, 'small');
});

test('a timed coin brick launches one coin per bump and becomes used', () => {
  const game = new SmbSession();
  game.enemies.length = 0;
  const block = game.area.tiles.find((tile) => tile.multiCoin);
  assert.ok(block);
  stand(game, block.x + 2);
  const hit = () => {
    const coins = game.hud.coins;
    game.step(dt, { ...idle, jump: true, jumpPressed: true });
    for (let i = 0; i < 32 && game.hud.coins === coins; i++) game.step(dt, { ...idle, jump: true });
    assert.equal(game.hud.coins, coins + 1);
    assert.deepEqual(game.effects.at(-1), { kind: 'coin', x: block.x + 8, y: block.y, at: game.elapsed });
    for (let i = 0; i < 42; i++) game.step(dt, idle);
  };
  hit();
  assert.equal(block.kind, 'brick');
  hit();
  assert.equal(block.kind, 'brick');
  for (let i = 0; i < 240; i++) game.step(dt, idle);
  hit();
  assert.equal(block.kind, 'used');
  assert.equal(game.hud.coins, 3);
  assert.equal(game.effects.length, 0);
});

test('collecting a bonus room coin creates one short-lived sparkle', () => {
  const game = new SmbSession();
  game.region = 'bonus';
  const coin = game.area.coins[0];
  stand(game, coin.x, coin.y + coin.h);
  game.step(dt, idle);
  assert.equal(game.hud.coins, 1);
  assert.equal(game.effects[0].kind, 'spark');
  assert.equal(game.area.coins.includes(coin), false);
  stand(game, 32);
  for (let i = 0; i < 42; i++) game.step(dt, idle);
  assert.equal(game.effects.length, 0);
  assert.equal(game.hud.coins, 1);
});

test('big Mario can crouch beneath a one-tile gap and stays short until clear', () => {
  const game = new SmbSession({ score: 0, coins: 0, lives: 3, power: 'big' });
  game.area.tiles.push({ x: 64, y: 176, w: 32, h: 16, kind: 'stone' });
  stand(game, 52);
  game.step(dt, { ...idle, direction: 1, down: true });
  assert.equal(game.player.h, SMALL_MARIO_HEIGHT);
  stand(game, 68);
  game.step(dt, idle);
  assert.equal(game.player.h, SMALL_MARIO_HEIGHT);
  stand(game, 98);
  game.step(dt, idle);
  assert.equal(game.player.h, BIG_MARIO_HEIGHT);
});
