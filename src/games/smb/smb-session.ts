import { GROUND_Y, VIEW_HEIGHT, VIEW_WIDTH, type EnemySpawn, type Level, type Spawn, type Tile } from './levels/level.ts';
import { World11 } from './levels/world-1-1.ts';
import { moveBody, overlaps } from './rules/collision.ts';
import type { Body } from './rules/collision.ts';

export type Power = 'small' | 'big' | 'fire';
export type Phase = 'playing' | 'flag' | 'flag-dismount' | 'castle' | 'countdown' | 'fireworks' | 'cleared' | 'dying' | 'lost';
export type Sound = 'jump' | 'coin' | 'stomp' | 'power' | 'bump' | 'warp' | 'lose' | 'clear' | 'fire' | 'timer' | 'firework';
type Enemy = Body & { kind: EnemySpawn['kind'] | 'shell'; dead: boolean; active: boolean; kickGrace: number; pipeTop: number };
type Pickup = Body & { kind: Exclude<NonNullable<Tile['item']>, 'coin'>; emergence: number; blockTop: number };
type Fireball = Body & { life: number };
type Effect = { kind: 'coin' | 'spark' | 'brick' | 'points' | 'firework'; x: number; y: number; at: number; text?: string };

export interface Input {
  direction: number;
  sprint: boolean;
  jump: boolean;
  jumpPressed: boolean;
  downPressed: boolean;
  down: boolean;
  firePressed: boolean;
}

export interface Hud {
  score: number;
  coins: number;
  lives: number;
  time: number;
  phase: Phase;
  failure: string;
  power: Power;
}

export const InitialHud: Hud = { score: 0, coins: 0, lives: 3, time: 400, phase: 'playing', failure: '', power: 'small' };

export const SIMULATION_HZ = 60;
// The NES land collision probes share a foot at $20, with heads at $12/$04.
export const SMALL_MARIO_HEIGHT = 0x20 - 0x12;
export const BIG_MARIO_HEIGHT = 0x20 - 0x04;
// NES horizontal speed uses 1/16 px per frame, vertical force 1/256 px per frame².
const X_SPEED_UNIT = SIMULATION_HZ / 16;
const X_FORCE_UNIT = SIMULATION_HZ ** 2 / 4096;
const Y_FORCE_UNIT = SIMULATION_HZ ** 2 / 256;
const ENTITY_GRAVITY = 850;
const WALK_SPEED = 0x18 * X_SPEED_UNIT;
const RUN_SPEED = 0x28 * X_SPEED_UNIT;
const DEFAULT_FALL_FORCE = 0x70;
const MAX_FALL_SPEED = 4 * SIMULATION_HZ;
const JUMP_BUFFER = 0.1;
const COYOTE_TIME = 0.065;
const RESIZE_SPEED = 95;
const TRANSFORM_TIME = 0.45;
export const EFFECT_TIME = 0.58;
const FLAG_BASE = GROUND_Y - 16;
const CASTLE_FLAG_TOP = 114;
const FLAG_SCORE = [[0x90, 100], [0x68, 400], [0x50, 800], [0x22, 2000]] as const;
const FIREWORK_POSITIONS = [[-48, 96], [0, 64], [48, 112], [48, 64], [-48, 96], [-16, 48]] as const;
const SHELL_SPEED = 170;
// Gold872's 2x renderer uses -12.5 scaled pixels per tick and a 180-tick delay.
const DEATH_LAUNCH = -12.5 * SIMULATION_HZ / 2;
const DEATH_GRAVITY = 0.575 * SIMULATION_HZ ** 2 / 2;
const DEATH_DURATION = 180 / SIMULATION_HZ;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class SmbSession {
  readonly player: Body;
  readonly level: Level;
  readonly map: ReturnType<Level['createRegions']>;
  readonly actors: Record<string, Enemy[]>;
  readonly items: Record<string, Pickup[]>;
  readonly shots: Fireball[] = [];
  effects: Effect[] = [];
  readonly hud: Hud;
  region: string;
  power: Power;
  get area() { return this.map[this.region]!; }
  get enemies() { return this.actors[this.region]!; }
  get pickups() { return this.items[this.region]!; }
  facing = 1;
  camera = 0;
  elapsed = 0;
  invulnerable = 0;
  transformTime = 0;
  starTime = 0;
  crouching = false;
  flagY = 48;
  castleFlagY = 154;
  visualHeight: number;
  private remaining: number;
  private fireCooldown = 0;
  private jumpBuffer = 0;
  private coyoteTime = 0;
  private jumpOrigin = Infinity;
  private riseForce = 0x20;
  private fallForce = DEFAULT_FALL_FORCE;
  private holdingJump = false;
  private runFriction = false;
  private deathRemaining = 0;
  private flagScore = 0;
  private celebrationDelay = 0;
  private fireworksTotal = 0;
  private fireworksLeft = 0;

  private readonly sound: (key: Sound) => void;

  constructor(
    carry: Pick<Hud, 'score' | 'coins' | 'lives'> & { power?: Power } = InitialHud,
    sound: (key: Sound) => void = () => {},
    level: Level = World11,
  ) {
    this.sound = sound;
    this.level = level;
    this.power = carry.power ?? 'small';
    this.region = level.start.region;
    const h = this.power === 'small' ? SMALL_MARIO_HEIGHT : BIG_MARIO_HEIGHT;
    this.player = { x: level.start.x, y: level.start.feet - h, w: 12, h, vx: 0, vy: 0, grounded: true };
    this.visualHeight = h;
    this.remaining = level.time;
    this.hud = { ...InitialHud, score: carry.score, coins: carry.coins, lives: carry.lives, power: this.power, time: level.time };
    this.map = level.createRegions();
    this.items = Object.fromEntries(Object.keys(this.map).map((region) => [region, []]));
    this.actors = Object.fromEntries(Object.entries(this.map).map(([region, area]) => [
      region,
      area.spawns.map(({ x, y, kind }): Enemy => ({
        x, y, kind, w: 14, h: kind === 'plant' ? 24 : kind === 'koopa' ? 19 : 14,
        vx: kind === 'plant' ? 0 : -38, vy: 0, grounded: true, active: false,
        dead: false, kickGrace: 0, pipeTop: y,
      })),
    ]));
  }

  step(dt: number, input: Input) {
    if (this.hud.phase === 'lost' || this.hud.phase === 'cleared') return;
    if (this.hud.phase === 'dying') {
      const player = this.player;
      if (player.y < VIEW_HEIGHT || player.vy < 0) {
        player.vy += DEATH_GRAVITY * dt;
        player.y += player.vy * dt;
      }
      this.deathRemaining -= dt;
      if (this.deathRemaining <= 1e-9 && player.y >= VIEW_HEIGHT) this.hud.phase = 'lost';
      return;
    }
    this.elapsed += dt;
    if (this.effects.length) this.effects = this.effects.filter((effect) => this.elapsed - effect.at < EFFECT_TIME);
    if (this.transformTime > 0) {
      this.transformTime = Math.max(0, this.transformTime - dt);
      return;
    }
    const resizeStep = RESIZE_SPEED * dt;
    this.visualHeight += clamp(this.player.h - this.visualHeight, -resizeStep, resizeStep);
    if (this.hud.phase !== 'playing') {
      this.finishFlag(dt);
      return;
    }
    this.remaining = Math.max(0, this.remaining - dt * 2.5);
    this.hud.time = Math.ceil(this.remaining);
    if (this.remaining === 0) {
      this.lose('时间用尽');
      return;
    }
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.starTime = Math.max(0, this.starTime - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    const { player } = this;
    const tiles = this.area.tiles;
    this.resizePlayer(tiles, input.down && (player.grounded || this.crouching));
    this.crouching = this.power !== 'small' && player.h === SMALL_MARIO_HEIGHT;
    this.updateLifts(tiles);
    this.jumpBuffer = input.jumpPressed ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);
    this.coyoteTime = player.grounded ? COYOTE_TIME : Math.max(0, this.coyoteTime - dt);
    if (this.jumpBuffer > 0 && this.coyoteTime > 0) {
      const speed = Math.abs(player.vx) / X_SPEED_UNIT;
      const fast = speed >= 0x19;
      this.riseForce = fast ? 0x28 : speed >= 0x10 ? 0x1e : 0x20;
      this.fallForce = fast ? 0x90 : speed >= 0x10 ? 0x60 : DEFAULT_FALL_FORCE;
      this.jumpOrigin = player.y;
      player.vy = (fast ? -5 : -4) * SIMULATION_HZ;
      this.jumpBuffer = this.coyoteTime = 0;
      this.holdingJump = input.jump;
      this.sound('jump');
    }
    this.updateHorizontalVelocity(dt, input);
    if (input.firePressed && this.power === 'fire' && this.fireCooldown === 0) this.shoot();

    const oldBottom = player.y + player.h;
    this.holdingJump &&= input.jump && player.vy < 0;
    const rising = player.vy < 0 && (this.holdingJump || this.jumpOrigin - player.y < 1);
    const gravity = (rising ? this.riseForce : this.fallForce) * Y_FORCE_UNIT;
    const nextVy = Math.min(MAX_FALL_SPEED, player.vy + gravity * dt);
    // Keep a downward support probe on the ground; airborne displacement uses
    // the current velocity, as the NES integrator applies gravity after moving.
    if (player.grounded && player.vy === 0) player.vy = nextVy;
    const falling = player.vy > 0;
    const contact = moveBody(player, tiles, dt);
    if (contact.floor) {
      this.fallForce = DEFAULT_FALL_FORCE;
      this.jumpOrigin = Infinity;
    } else if (!contact.ceiling) {
      player.vy = nextVy;
    }
    player.x = clamp(player.x, 0, this.area.width - player.w);
    if (contact.ceiling) this.hitBlock(contact.ceiling);
    if (player.y > VIEW_HEIGHT + 24) {
      this.lose('掉进了坑里');
      return;
    }

    if (input.direction > 0 && contact.wall?.warpDirection === 'right' && contact.wall.warp) {
      this.warp(contact.wall.warp);
      return;
    }
    if (input.downPressed && contact.floor?.warp && !contact.floor.warpDirection) {
      const pipe = contact.floor;
      const center = player.x + player.w / 2;
      if (center >= pipe.x + 4 && center <= pipe.x + pipe.w - 4) {
        this.warp(pipe.warp!);
        return;
      }
    }
    this.updateCamera();
    this.updatePickups(dt, tiles);
    if (this.transformTime > 0) return;
    if (this.updateEnemies(dt, tiles, oldBottom, falling)) return;
    this.updateFireballs(dt, tiles);
    const { region, flag } = this.level.finish;
    if (this.region === region && player.x + player.w >= flag && player.x < flag + 12 &&
        player.y < FLAG_BASE && player.y + player.h > 32) {
      this.startFlag();
    }
    this.hud.power = this.power;
  }

  private updateLifts(tiles: Tile[]) {
    const p = this.player;
    for (const tile of tiles) {
      if (!tile.lift) continue;
      const { top, bottom, period, offset, direction } = tile.lift;
      const cycle = (this.elapsed + offset) % period / period;
      const next = top + (bottom - top) * (direction === 1 ? cycle : direction === -1 ? 1 - cycle : 1 - Math.abs(2 * cycle - 1));
      const feet = p.y + p.h;
      const above = p.x < tile.x + tile.w && p.x + p.w > tile.x && feet <= tile.y;
      if (Math.abs(next - tile.y) < (bottom - top) / 2 && above && ((p.grounded && tile.y - feet < .001) || (p.vy >= 0 && feet >= next))) {
        p.y = next - p.h;
        p.vy = 0;
        p.grounded = true;
      }
      tile.y = next;
    }
  }

  private updateHorizontalVelocity(dt: number, { direction, sprint }: Input) {
    const p = this.player;
    const speed = Math.abs(p.vx);
    const reversing = direction !== 0 && direction * p.vx < 0;
    if (p.grounded) {
      // NES RunningSpeed survives release of the direction buttons, so the
      // running brake applies throughout the coast instead of becoming weaker.
      if (speed >= 0x1c * X_SPEED_UNIT) this.runFriction = true;
      else if (direction && !reversing) this.runFriction = false;
      if (!direction) {
        const force = this.runFriction ? 0xd0 : 0x98;
        const brake = force * X_FORCE_UNIT * dt;
        p.vx = sprint && speed < 0x0b * X_SPEED_UNIT ? 0 : p.vx + clamp(-p.vx, -brake, brake);
        return;
      }
      this.facing = Math.sign(direction);
    } else if (!direction) return;
    const fast = sprint || speed >= WALK_SPEED + X_SPEED_UNIT;
    const limit = p.grounded ? (sprint ? RUN_SPEED : WALK_SPEED)
      : Math.max(WALK_SPEED, speed);
    const force = (p.grounded && sprint) || (!p.grounded && speed >= 0x19 * X_SPEED_UNIT)
      ? 0xe4 : fast ? 0xd0 : 0x98;
    const step = force * X_FORCE_UNIT * (reversing ? 2 : 1) * dt;
    const target = direction * limit;
    p.vx += clamp(target - p.vx, -step, step);
  }

  private resizePlayer(tiles: Tile[], crouch = false) {
    const { player } = this;
    const height = this.power === 'small' || crouch ? SMALL_MARIO_HEIGHT : BIG_MARIO_HEIGHT;
    if (height === player.h) return;
    const candidate = { x: player.x, y: player.y + player.h - height, w: player.w, h: height };
    if (height < player.h || !tiles.some((tile) => !tile.hidden && overlaps(candidate, tile))) {
      player.y = candidate.y;
      player.h = height;
    }
  }

  private hitBlock(tile: Tile) {
    if (tile.kind === 'question' || tile.multiCoin) {
      const multi = tile.multiCoin;
      tile.hidden = false;
      tile.bumpAt = this.elapsed;
      if (multi) tile.coinUntil ??= this.elapsed + 4;
      if (!multi || this.elapsed >= tile.coinUntil!) {
        tile.kind = 'used';
        tile.multiCoin = false;
      }
      if (multi || tile.item === 'coin') {
        this.collectCoin(tile.x + 8, tile.y, true);
      } else if (tile.item) {
        const kind = tile.item === 'mushroom' && this.power !== 'small' ? 'flower' : tile.item;
        this.pickups.push({
          x: tile.x + 1, y: tile.y - 1, w: 14, h: 14, kind, emergence: 0.28, blockTop: tile.y,
          vx: kind === 'flower' ? 0 : 48, vy: 0, grounded: false,
        });
        this.sound('bump');
      }
    } else if (tile.kind === 'brick' && this.power !== 'small') {
      const tiles = this.area.tiles;
      tiles.splice(tiles.indexOf(tile), 1);
      this.player.vy = -2 * SIMULATION_HZ;
      this.hud.score += 50;
      this.effects.push({ kind: 'brick', x: tile.x + 8, y: tile.y + 8, at: this.elapsed });
      this.sound('bump');
    } else {
      if (tile.kind === 'brick' || tile.kind === 'used') tile.bumpAt = this.elapsed;
      else this.player.vy = SIMULATION_HZ;
      this.sound('bump');
    }
  }

  private collectCoin(x: number, y: number, launched = false) {
    this.hud.coins++;
    this.hud.score += 100;
    if (this.hud.coins % 100 === 0) this.hud.lives++;
    this.effects.push({ kind: launched ? 'coin' : 'spark', x, y, at: this.elapsed });
    this.sound('coin');
  }

  private updatePickups(dt: number, tiles: Tile[]) {
    const { player } = this;
    const region = this.area;
    region.coins = region.coins.filter((coin) => {
      if (!overlaps(player, coin)) return true;
      this.collectCoin(coin.x + coin.w / 2, coin.y);
      return false;
    });
    this.items[this.region] = this.pickups.filter((item) => {
      if (item.emergence > 0) {
        item.emergence = Math.max(0, item.emergence - dt);
        item.y = item.blockTop - item.h + (item.h - 1) * item.emergence / 0.28;
        return true;
      }
      if (item.kind !== 'flower') {
        const vx = item.vx;
        item.vy = Math.min(320, item.vy + ENTITY_GRAVITY * dt);
        const contact = moveBody(item, tiles, dt);
        if (item.kind === 'star' && contact.floor) item.vy = -230;
        if (contact.wall || item.x < 0 || item.x + item.w > region.width) {
          item.x = clamp(item.x, 0, region.width - item.w);
          item.vx = -vx;
        }
      }
      if (overlaps(player, item)) {
        const before = this.power;
        if (item.kind === 'one-up') this.hud.lives++;
        else {
          if (item.kind === 'star') this.starTime = 10;
          else if (item.kind === 'flower') this.power = 'fire';
          else if (this.power === 'small') this.power = 'big';
          this.hud.score += 1000;
        }
        if (before !== this.power) {
          this.resizePlayer(tiles);
          this.visualHeight = player.h;
          this.hud.power = this.power;
          this.transformTime = TRANSFORM_TIME;
          this.invulnerable = Math.max(this.invulnerable, 0.25);
        }
        this.effects.push({ kind: 'points', x: item.x + 7, y: item.y, at: this.elapsed, text: item.kind === 'one-up' ? '1UP' : '1000' });
        this.sound('power');
        return false;
      }
      return item.y <= VIEW_HEIGHT + 24;
    });
  }

  private updateEnemies(dt: number, tiles: Tile[], oldBottom: number, falling: boolean) {
    const { player } = this;
    const enemies = this.enemies;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (enemy.kind === 'plant') {
        const cycle = this.elapsed % 3.6;
        const rise = clamp(Math.min((cycle - .8) / .45, (2.55 - cycle) / .45), 0, 1);
        const close = Math.abs(enemy.x + enemy.w / 2 - player.x - player.w / 2) < 24 &&
          player.y + player.h <= enemy.pipeTop + 3;
        if (!close || enemy.active) enemy.y = enemy.pipeTop - enemy.h * rise;
        enemy.active = enemy.y < enemy.pipeTop;
        continue;
      }
      enemy.active ||= enemy.x <= this.camera + VIEW_WIDTH + 20;
      if (!enemy.active) continue;
      enemy.kickGrace = Math.max(0, enemy.kickGrace - dt);
      enemy.vy = Math.min(320, enemy.vy + ENTITY_GRAVITY * dt);
      const vx = enemy.vx;
      const limit = this.area.width - enemy.w;
      if (moveBody(enemy, tiles, dt).wall || enemy.x < 0 || enemy.x > limit) {
        enemy.x = clamp(enemy.x, 0, limit);
        enemy.vx = -vx;
      }
      if (enemy.y > VIEW_HEIGHT + 24) enemy.dead = true;
    }
    // Adapted from Gold872's EnemySystem: a moving shell defeats enemies on overlap.
    for (const shell of enemies) {
      if (shell.dead || shell.kind !== 'shell' || shell.vx === 0) continue;
      for (const other of enemies) {
        if (shell === other || other.dead || other.kind === 'plant' || !overlaps(shell, other)) continue;
        this.defeat(other);
        if (other.kind === 'shell' && other.vx !== 0) {
          this.defeat(shell);
          break;
        }
      }
    }
    for (const enemy of enemies) {
      if (enemy.dead || !enemy.active || enemy.kickGrace > 0 || !overlaps(player, enemy)) continue;
      if (this.starTime > 0) {
        this.defeat(enemy);
        continue;
      }
      if (enemy.kind !== 'plant' && falling && oldBottom <= enemy.y + 3 && player.y < enemy.y) {
        player.y = enemy.y - player.h;
        player.vy = -205;
        player.grounded = false;
        this.coyoteTime = 0;
        this.jumpOrigin = Infinity;
        this.holdingJump = false;
        if (enemy.kind === 'koopa') {
          enemy.kind = 'shell';
          enemy.y += enemy.h - 12;
          enemy.h = 12;
          enemy.vx = 0;
          enemy.kickGrace = 0.15;
          this.hud.score += 100;
          this.sound('stomp');
        } else if (enemy.kind === 'goomba') this.defeat(enemy);
        else if (enemy.vx) {
          enemy.vx = 0;
          enemy.kickGrace = 0.15;
          this.sound('stomp');
        } else this.kick(enemy);
        break;
      }
      if (enemy.kind === 'shell' && !enemy.vx) this.kick(enemy);
      else if (!this.invulnerable) {
        if (this.power === 'small') {
          this.lose('碰到了敌人');
          return true;
        }
        this.power = this.power === 'fire' ? 'big' : 'small';
        this.resizePlayer(tiles);
        this.invulnerable = 1.5;
        this.hud.power = this.power;
        this.sound('bump');
        break;
      }
    }
    return false;
  }

  private kick(enemy: Enemy) {
    enemy.vx = (this.player.x + this.player.w / 2 <= enemy.x + enemy.w / 2 ? 1 : -1) * SHELL_SPEED;
    enemy.kickGrace = 0.13;
    this.sound('stomp');
  }

  private defeat(enemy: Enemy) {
    enemy.dead = true;
    this.hud.score += 100;
    this.sound('stomp');
  }

  private shoot() {
    if (this.shots.length >= 2) return;
    const { player } = this;
    const shot = {
      x: this.facing > 0 ? player.x + player.w : player.x - 6, y: player.y + 8,
      w: 6, h: 6, vx: this.facing * 210, vy: 20, grounded: false, life: 1.7,
    };
    if (this.area.tiles.some((tile) => overlaps(tile, shot))) return;
    this.fireCooldown = 0.24;
    this.shots.push(shot);
    this.sound('fire');
  }

  private updateFireballs(dt: number, tiles: Tile[]) {
    const enemies = this.enemies;
    for (let index = this.shots.length - 1; index >= 0; index--) {
      const shot = this.shots[index]!;
      shot.life -= dt;
      shot.vy = Math.min(320, shot.vy + ENTITY_GRAVITY * dt);
      const { wall, floor } = moveBody(shot, tiles, dt);
      if (floor) shot.vy = -135;
      const enemy = enemies.find((other) => !other.dead && (other.kind !== 'plant' || other.active) && overlaps(shot, other));
      if (enemy) this.defeat(enemy);
      if (enemy || wall || shot.life <= 0 || shot.y > VIEW_HEIGHT) this.shots.splice(index, 1);
    }
  }

  private warp(destination: Spawn) {
    this.region = destination.region;
    this.shots.length = 0;
    this.effects.length = 0;
    this.player.grounded = !destination.airborne;
    this.crouching = false;
    this.player.x = destination.x;
    this.player.y = destination.feet - this.player.h;
    this.player.vx = this.player.vy = 0;
    this.jumpBuffer = this.coyoteTime = 0;
    this.jumpOrigin = Infinity;
    this.fallForce = DEFAULT_FALL_FORCE;
    this.holdingJump = false;
    this.runFriction = false;
    this.camera = 0;
    this.updateCamera();
    this.sound('warp');
  }

  private updateCamera() {
    if (this.area.fixedCamera) return;
    const follow = this.player.x - 110;
    this.camera = clamp(this.area.backtrack ? follow : Math.max(this.camera, follow), 0, this.area.width - VIEW_WIDTH);
    this.player.x = Math.max(this.player.x, this.camera);
  }

  private lose(message: string) {
    const player = this.player;
    this.starTime = this.transformTime = 0;
    this.power = this.hud.power = 'small';
    player.y += player.h - SMALL_MARIO_HEIGHT;
    player.h = this.visualHeight = SMALL_MARIO_HEIGHT;
    player.vx = 0;
    player.vy = DEATH_LAUNCH;
    player.grounded = false;
    this.deathRemaining = DEATH_DURATION;
    this.hud.phase = 'dying';
    this.hud.lives--;
    this.hud.failure = message;
    this.sound('lose');
  }

  private startFlag() {
    const player = this.player;
    const feet = player.y + player.h;
    // The NES measures both forms from the same 32-pixel sprite anchor.
    this.flagScore = FLAG_SCORE.find(([top]) => feet - 32 >= top)?.[1] ?? 5000;
    const digit = this.hud.time % 10;
    this.fireworksTotal = this.fireworksLeft = digit === 1 || digit === 3 || digit === 6 ? digit : 0;
    this.hud.phase = 'flag';
    player.x = this.level.finish.flag - player.w;
    player.vx = player.vy = 0;
    player.grounded = false;
    this.facing = 1;
    this.crouching = false;
    this.resizePlayer(this.area.tiles);
    this.starTime = this.invulnerable = 0;
    this.sound('clear');
  }

  private finishFlag(dt: number) {
    const { player } = this;
    const { flag, castle } = this.level.finish;
    switch (this.hud.phase) {
      case 'flag': {
        const base = FLAG_BASE - player.h;
        player.y = Math.min(base, player.y + 120 * dt);
        this.flagY = Math.min(176, this.flagY + 120 * dt);
        if (player.y === base && this.flagY === 176) {
          this.hud.score += this.flagScore;
          this.effects.push({ kind: 'points', x: flag + 12, y: 160, at: this.elapsed, text: String(this.flagScore) });
          player.x = flag + 2;
          this.facing = -1;
          this.celebrationDelay = .35;
          this.hud.phase = 'flag-dismount';
        }
        break;
      }
      case 'flag-dismount':
        this.celebrationDelay -= dt;
        if (this.celebrationDelay <= 0) {
          this.facing = 1;
          this.hud.phase = 'castle';
        }
        break;
      case 'castle': {
        player.x = Math.min(castle + 30, player.x + 95 * dt);
        const ground = player.x < flag + 16 ? FLAG_BASE : GROUND_Y;
        player.vy = Math.min(MAX_FALL_SPEED, player.vy + DEFAULT_FALL_FORCE * Y_FORCE_UNIT * dt);
        player.y = Math.min(ground - player.h, player.y + player.vy * dt);
        player.grounded = player.y + player.h >= ground;
        if (player.grounded) player.vy = 0;
        player.vx = 95;
        this.updateCamera();
        if (player.x === castle + 30) this.hud.phase = 'countdown';
        break;
      }
      case 'countdown':
        if (this.hud.time > 0) {
          this.hud.time--;
          this.hud.score += 50;
          if (this.hud.time % 8 === 0) this.sound('timer');
        }
        if (this.hud.time === 0) {
          this.celebrationDelay = this.fireworksLeft > 0 ? 0 : .45;
          this.hud.phase = 'fireworks';
        }
        break;
      case 'fireworks':
        if (this.castleFlagY > CASTLE_FLAG_TOP) {
          this.castleFlagY = Math.max(CASTLE_FLAG_TOP, this.castleFlagY - 60 * dt);
          break;
        }
        this.celebrationDelay -= dt;
        if (this.celebrationDelay > 0) break;
        if (this.fireworksLeft === 0) {
          this.hud.phase = 'cleared';
          break;
        }
        const [x, y] = FIREWORK_POSITIONS[--this.fireworksLeft + 6 - this.fireworksTotal]!;
        this.effects.push({ kind: 'firework', x: castle + 24 + x, y, at: this.elapsed });
        this.hud.score += 500;
        this.sound('firework');
        this.celebrationDelay = this.fireworksLeft > 0 ? 32 / SIMULATION_HZ : EFFECT_TIME;
        break;
    }
  }
}
