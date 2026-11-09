import { GROUND_Y, VIEW_HEIGHT, VIEW_WIDTH, type EnemySpawn, type Level, type Spawn, type Tile } from './levels/level.ts';
import { World11 } from './levels/world-1-1.ts';
import { moveBody, overlaps } from './rules/collision.ts';
import type { Body } from './rules/collision.ts';

export type Power = 'small' | 'big' | 'fire';
export type Phase = 'playing' | 'flag' | 'castle' | 'cleared' | 'dying' | 'lost';
export type Sound = 'jump' | 'coin' | 'stomp' | 'power' | 'bump' | 'warp' | 'lose' | 'clear' | 'fire';
type Enemy = Body & { kind: EnemySpawn['kind'] | 'shell'; dead: boolean; active: boolean; kickGrace: number; pipeTop: number };
type Pickup = Body & { kind: 'mushroom' | 'flower'; emergence: number; blockTop: number };
type Fireball = Body & { life: number };

export interface Input {
  direction: number;
  sprint: boolean;
  jump: boolean;
  jumpPressed: boolean;
  downPressed: boolean;
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
  flagY = 53;
  visualHeight: number;
  private remaining: number;
  private fireCooldown = 0;
  private jumpBuffer = 0;
  private coyoteTime = 0;
  private jumpOrigin = Infinity;
  private riseForce = 0x20;
  private fallForce = DEFAULT_FALL_FORCE;
  private holdingJump = false;
  private deathRemaining = 0;

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
    const h = this.power === 'small' ? 15 : 26;
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
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    const { player } = this;
    const tiles = this.area.tiles;
    this.resizePlayer(tiles);
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
    player.vy = Math.min(MAX_FALL_SPEED, player.vy + gravity * dt);
    const falling = player.vy > 0;
    const contact = moveBody(player, tiles, dt);
    if (contact.floor) {
      this.fallForce = DEFAULT_FALL_FORCE;
      this.jumpOrigin = Infinity;
    }
    player.x = clamp(player.x, 0, this.area.width - player.w);
    if (contact.ceiling) this.hitBlock(contact.ceiling);
    if (player.y > VIEW_HEIGHT + 24) {
      this.lose('掉进了坑里');
      return;
    }

    if (input.downPressed && contact.floor?.warp) {
      const pipe = contact.floor;
      const center = player.x + player.w / 2;
      if (center >= pipe.x + 4 && center <= pipe.x + pipe.w - 4) {
        this.warp(pipe.warp!);
        return;
      }
    }
    this.updateCamera();
    this.updatePickups(dt, tiles);
    if (this.updateEnemies(dt, tiles, oldBottom, falling)) return;
    this.updateFireballs(dt, tiles);
    const { region, flag } = this.level.finish;
    if (this.region === region && player.x + player.w >= flag && player.x < flag + 12) {
      this.hud.phase = 'flag';
      this.hud.score += Math.max(100, Math.round((GROUND_Y - player.y) / 16) * 100);
      this.sound('clear');
    }
    this.hud.power = this.power;
  }

  private updateLifts(tiles: Tile[]) {
    const p = this.player;
    for (const tile of tiles) {
      if (!tile.lift) continue;
      const { top, bottom, period, offset } = tile.lift;
      const cycle = (this.elapsed + offset) % period / period;
      const next = top + (bottom - top) * (1 - Math.abs(2 * cycle - 1));
      const feet = p.y + p.h;
      const above = p.x < tile.x + tile.w && p.x + p.w > tile.x && feet <= tile.y;
      if (above && ((p.grounded && tile.y - feet < .001) || (p.vy >= 0 && feet >= next))) {
        p.y = next - p.h;
        p.vy = 0;
        p.grounded = true;
      }
      tile.y = next;
    }
  }

  private updateHorizontalVelocity(dt: number, { direction, sprint }: Input) {
    const p = this.player;
    if (!direction && !p.grounded) return;
    if (direction && p.grounded) this.facing = Math.sign(direction);
    const speed = Math.abs(p.vx);
    const reversing = direction !== 0 && direction * p.vx < 0;
    const fast = sprint || speed >= WALK_SPEED + X_SPEED_UNIT;
    const limit = p.grounded ? (sprint ? RUN_SPEED : WALK_SPEED)
      : Math.max(WALK_SPEED, speed);
    const force = (p.grounded && sprint) || (!p.grounded && speed >= 0x19 * X_SPEED_UNIT)
      ? 0xe4 : fast ? 0xd0 : 0x98;
    const step = force * X_FORCE_UNIT * (reversing ? 2 : 1) * dt;
    const target = direction * limit;
    p.vx += clamp(target - p.vx, -step, step);
  }

  private resizePlayer(tiles: Tile[]) {
    const { player } = this;
    const height = this.power === 'small' ? 15 : 26;
    if (height === player.h) return;
    const candidate = { x: player.x, y: player.y + player.h - height, w: player.w, h: height };
    if (height < player.h || !tiles.some((tile) => overlaps(candidate, tile))) {
      player.y = candidate.y;
      player.h = height;
    }
  }

  private hitBlock(tile: Tile) {
    if (tile.kind === 'question') {
      tile.kind = 'used';
      if (tile.item === 'coin') this.collectCoin();
      else if (tile.item) {
        const kind = tile.item === 'flower' && this.power !== 'small' ? 'flower' : 'mushroom';
        this.pickups.push({
          x: tile.x + 1, y: tile.y - 1, w: 14, h: 14, kind, emergence: 0.28, blockTop: tile.y,
          vx: kind === 'mushroom' ? 48 : 0, vy: 0, grounded: false,
        });
        this.sound('bump');
      }
    } else if (tile.kind === 'brick' && this.power !== 'small') {
      const tiles = this.area.tiles;
      tiles.splice(tiles.indexOf(tile), 1);
      this.hud.score += 50;
      this.sound('bump');
    } else this.sound('bump');
  }

  private collectCoin() {
    this.hud.coins++;
    this.hud.score += 100;
    if (this.hud.coins % 100 === 0) this.hud.lives++;
    this.sound('coin');
  }

  private updatePickups(dt: number, tiles: Tile[]) {
    const { player } = this;
    const region = this.area;
    region.coins = region.coins.filter((coin) => {
      if (!overlaps(player, coin)) return true;
      this.collectCoin();
      return false;
    });
    this.items[this.region] = this.pickups.filter((item) => {
      if (item.emergence > 0) {
        item.emergence = Math.max(0, item.emergence - dt);
        item.y = item.blockTop - item.h + (item.h - 1) * item.emergence / 0.28;
        return true;
      }
      if (item.kind === 'mushroom') {
        const vx = item.vx;
        item.vy = Math.min(320, item.vy + ENTITY_GRAVITY * dt);
        if (moveBody(item, tiles, dt).wall || item.x < 0 || item.x + item.w > region.width) {
          item.x = clamp(item.x, 0, region.width - item.w);
          item.vx = -vx;
        }
      }
      if (overlaps(player, item)) {
        if (item.kind === 'flower') this.power = 'fire';
        else if (this.power === 'small') this.power = 'big';
        this.resizePlayer(tiles);
        this.hud.score += 1000;
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
    this.player.x = destination.x;
    this.player.y = destination.feet - this.player.h;
    this.player.vx = this.player.vy = 0;
    this.jumpBuffer = this.coyoteTime = 0;
    this.jumpOrigin = Infinity;
    this.fallForce = DEFAULT_FALL_FORCE;
    this.holdingJump = false;
    this.camera = 0;
    this.updateCamera();
    this.sound('warp');
  }

  private updateCamera() {
    const follow = this.player.x - 110;
    this.camera = clamp(this.area.backtrack ? follow : Math.max(this.camera, follow), 0, this.area.width - VIEW_WIDTH);
    this.player.x = Math.max(this.player.x, this.camera);
  }

  private lose(message: string) {
    const player = this.player;
    this.power = this.hud.power = 'small';
    player.y += player.h - 15;
    player.h = this.visualHeight = 15;
    player.vx = 0;
    player.vy = DEATH_LAUNCH;
    player.grounded = false;
    this.deathRemaining = DEATH_DURATION;
    this.hud.phase = 'dying';
    this.hud.lives--;
    this.hud.failure = message;
    this.sound('lose');
  }

  private finishFlag(dt: number) {
    const { player } = this;
    const { flag, castle } = this.level.finish;
    if (this.hud.phase === 'flag') {
      player.x = flag - player.w;
      player.y = Math.min(GROUND_Y - player.h, player.y + 118 * dt);
      this.flagY = Math.min(179, this.flagY + 118 * dt);
      if (player.y >= GROUND_Y - player.h) {
        player.grounded = true;
        this.hud.phase = 'castle';
      }
    } else {
      player.x = Math.min(castle + 30, player.x + 110 * dt);
      player.vx = 110;
      this.updateCamera();
      if (player.x === castle + 30) {
        this.hud.score += this.hud.time * 10;
        this.hud.phase = 'cleared';
      }
    }
  }
}
