import { CASTLE_X, FLAG_X, GROUND_Y, VIEW_HEIGHT, VIEW_WIDTH, createWorld11 } from './levels/world-1-1.ts';
import type { Tile } from './levels/world-1-1.ts';
import { moveBody, overlaps } from './rules/collision.ts';
import type { Body } from './rules/collision.ts';

export type Power = 'small' | 'big' | 'fire';
export type Phase = 'playing' | 'flag' | 'castle' | 'cleared' | 'lost';
export type Sound = 'jump' | 'coin' | 'stomp' | 'power' | 'bump' | 'warp' | 'lose' | 'clear' | 'fire';
type Enemy = Body & { kind: 'goomba' | 'koopa' | 'shell'; dead: boolean; active: boolean; kickGrace: number };
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
}

export const InitialHud: Hud = { score: 0, coins: 0, lives: 3, time: 400, phase: 'playing', failure: '' };

export const SIMULATION_HZ = 60;
const GRAVITY = 850;
const SHELL_SPEED = 170;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class SmbSession {
  readonly player = { x: 32, y: GROUND_Y - 15, w: 12, h: 15, vx: 0, vy: 0, grounded: true };
  readonly map = createWorld11();
  readonly actors = {
    surface: this.map.surface.spawns.map(({ x, y, kind }): Enemy => ({
      x, y, kind, w: 14, h: kind === 'koopa' ? 19 : 14, vx: -38, vy: 0,
      grounded: true, active: false, dead: false, kickGrace: 0,
    })),
    bonus: [] as Enemy[],
  };
  readonly items = { surface: [] as Pickup[], bonus: [] as Pickup[] };
  readonly shots: Fireball[] = [];
  readonly hud: Hud;
  region: 'surface' | 'bonus' = 'surface';
  power: Power = 'small';
  facing = 1;
  camera = 0;
  elapsed = 0;
  invulnerable = 0;
  flagY = 53;
  private remaining = 400;
  private returnX = 0;
  private fireCooldown = 0;

  private readonly sound: (key: Sound) => void;

  constructor(carry: Pick<Hud, 'score' | 'coins' | 'lives'> = InitialHud, sound: (key: Sound) => void = () => {}) {
    this.sound = sound;
    this.hud = { ...InitialHud, score: carry.score, coins: carry.coins, lives: carry.lives };
  }

  step(dt: number, input: Input) {
    if (this.hud.phase === 'lost' || this.hud.phase === 'cleared') return;
    this.elapsed += dt;
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
    const tiles = this.map[this.region].tiles;
    this.resizePlayer(tiles);
    if (input.direction) this.facing = Math.sign(input.direction);
    const target = input.direction * (input.sprint ? 155 : 98);
    const acceleration = (input.direction ? 620 : 740) * dt;
    player.vx += clamp(target - player.vx, -acceleration, acceleration);
    if (input.jumpPressed && player.grounded) {
      player.vy = input.sprint ? -365 : -327;
      this.sound('jump');
    } else if (!input.jump && player.vy < -126) {
      player.vy = -126;
    }
    if (input.firePressed && this.power === 'fire' && this.fireCooldown === 0) this.shoot();

    const oldBottom = player.y + player.h;
    player.vy = Math.min(410, player.vy + GRAVITY * dt);
    const falling = player.vy > 0;
    const contact = moveBody(player, tiles, dt);
    player.x = clamp(player.x, 0, this.map[this.region].width - player.w);
    if (contact.ceiling) this.hitBlock(contact.ceiling);
    if (player.y > VIEW_HEIGHT + 24) {
      this.lose('掉进了坑里');
      return;
    }

    if (input.downPressed && contact.floor?.warp) {
      const pipe = contact.floor;
      const center = player.x + player.w / 2;
      if (center >= pipe.x + 4 && center <= pipe.x + pipe.w - 4) {
        this.warp(pipe);
        return;
      }
    }
    this.updateCamera();
    this.updatePickups(dt, tiles);
    if (this.updateEnemies(dt, tiles, oldBottom, falling)) return;
    this.updateFireballs(dt, tiles);
    if (this.region === 'surface' && player.x + player.w >= FLAG_X && player.x < FLAG_X + 12) {
      this.hud.phase = 'flag';
      this.hud.score += Math.max(100, Math.round((GROUND_Y - player.y) / 16) * 100);
      this.sound('clear');
    }
  }

  private resizePlayer(tiles: Tile[]) {
    const { player } = this;
    const height = this.power === 'small' ? 15 : 26;
    if (height === player.h) return;
    const candidate = { ...player, y: player.y + player.h - height, h: height };
    if (height < player.h || !tiles.some((tile) => overlaps(candidate, tile))) Object.assign(player, candidate);
  }

  private hitBlock(tile: Tile) {
    if (tile.kind === 'question') {
      tile.kind = 'used';
      if (tile.item === 'coin') this.collectCoin();
      else if (tile.item) {
        const kind = tile.item === 'flower' && this.power !== 'small' ? 'flower' : 'mushroom';
        this.items[this.region].push({
          x: tile.x + 1, y: tile.y - 1, w: 14, h: 14, kind, emergence: 0.28, blockTop: tile.y,
          vx: kind === 'mushroom' ? 48 : 0, vy: 0, grounded: false,
        });
        this.sound('bump');
      }
    } else if (tile.kind === 'brick' && this.power !== 'small') {
      const tiles = this.map[this.region].tiles;
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
    const region = this.map[this.region];
    region.coins = region.coins.filter((coin) => {
      if (!overlaps(player, coin)) return true;
      this.collectCoin();
      return false;
    });
    this.items[this.region] = this.items[this.region].filter((item) => {
      if (item.emergence > 0) {
        item.emergence = Math.max(0, item.emergence - dt);
        item.y = item.blockTop - item.h + (item.h - 1) * item.emergence / 0.28;
        return true;
      }
      if (item.kind === 'mushroom') {
        const vx = item.vx;
        item.vy = Math.min(320, item.vy + GRAVITY * dt);
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
    const enemies = this.actors[this.region];
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      enemy.active ||= enemy.x <= this.camera + VIEW_WIDTH + 20;
      if (!enemy.active) continue;
      enemy.kickGrace = Math.max(0, enemy.kickGrace - dt);
      enemy.vy = Math.min(320, enemy.vy + GRAVITY * dt);
      const vx = enemy.vx;
      const limit = this.map[this.region].width - enemy.w;
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
        if (shell === other || other.dead || !overlaps(shell, other)) continue;
        this.defeat(other);
        if (other.kind === 'shell' && other.vx !== 0) {
          this.defeat(shell);
          break;
        }
      }
    }
    for (const enemy of enemies) {
      if (enemy.dead || !enemy.active || enemy.kickGrace > 0 || !overlaps(player, enemy)) continue;
      if (falling && oldBottom <= enemy.y + 3 && player.y < enemy.y) {
        player.y = enemy.y - player.h;
        player.vy = -205;
        player.grounded = false;
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
    if (this.map[this.region].tiles.some((tile) => overlaps(tile, shot))) return;
    this.fireCooldown = 0.24;
    this.shots.push(shot);
    this.sound('fire');
  }

  private updateFireballs(dt: number, tiles: Tile[]) {
    const enemies = this.actors[this.region];
    for (let index = this.shots.length - 1; index >= 0; index--) {
      const shot = this.shots[index]!;
      shot.life -= dt;
      shot.vy = Math.min(320, shot.vy + GRAVITY * dt);
      const { wall, floor } = moveBody(shot, tiles, dt);
      if (floor) shot.vy = -135;
      const enemy = enemies.find((other) => !other.dead && overlaps(shot, other));
      if (enemy) this.defeat(enemy);
      if (enemy || wall || shot.life <= 0 || shot.y > VIEW_HEIGHT) this.shots.splice(index, 1);
    }
  }

  private warp(pipe: Tile) {
    const destination = pipe.warp!;
    if (destination === 'bonus') this.returnX = pipe.x + pipe.w + 14;
    this.region = destination;
    this.shots.length = 0;
    this.player.x = destination === 'bonus' ? 24 : this.returnX;
    this.player.y = GROUND_Y - this.player.h;
    this.player.vx = this.player.vy = 0;
    this.camera = 0;
    this.updateCamera();
    this.sound('warp');
  }

  private updateCamera() {
    this.camera = clamp(Math.max(this.camera, this.player.x - 110), 0, this.map[this.region].width - VIEW_WIDTH);
    this.player.x = Math.max(this.player.x, this.camera);
  }

  private lose(message: string) {
    this.hud.phase = 'lost';
    this.hud.lives--;
    this.hud.failure = message;
    this.sound('lose');
  }

  private finishFlag(dt: number) {
    const { player } = this;
    if (this.hud.phase === 'flag') {
      player.x = FLAG_X - player.w;
      player.y = Math.min(GROUND_Y - player.h, player.y + 118 * dt);
      this.flagY = Math.min(179, this.flagY + 118 * dt);
      if (player.y >= GROUND_Y - player.h) {
        player.grounded = true;
        this.hud.phase = 'castle';
      }
    } else {
      player.x = Math.min(CASTLE_X + 30, player.x + 110 * dt);
      player.vx = 110;
      this.updateCamera();
      if (player.x === CASTLE_X + 30) {
        this.hud.score += this.hud.time * 10;
        this.hud.phase = 'cleared';
      }
    }
  }
}
