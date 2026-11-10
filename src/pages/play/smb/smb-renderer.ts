import type { World } from '@xiaobaibaifqy/jingchuanchu-ecs';
import { Canvas2D } from '@xiaobaibaifqy/jingchuanchu-renderer-2d';
import { classicAtlasUrls } from '../../../games/smb/assets/classic-art.js';
import { GROUND_Y, VIEW_WIDTH } from '../../../games/smb/levels/level.ts';
import { interpolateSmbFrame, SmbFrame } from '../../../games/smb/smb-frame.ts';
import { BIG_MARIO_HEIGHT, EFFECT_TIME, SMALL_MARIO_HEIGHT } from '../../../games/smb/smb-session.ts';

export type ClassicArt = Record<keyof typeof classicAtlasUrls, HTMLCanvasElement>;

let cached: Promise<ClassicArt> | undefined;

export function loadClassicArt() {
  cached ??= Promise.all(Object.entries(classicAtlasUrls).map(async ([key, url]) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    // Rasterize each atlas once. Drawing cropped SVGs directly can rerasterize
    // their paths when the camera or destination rectangle changes.
    const atlas = document.createElement('canvas');
    atlas.width = image.naturalWidth;
    atlas.height = image.naturalHeight;
    const context = atlas.getContext('2d');
    if (!context) throw new Error(`Cannot rasterize SMB art: ${key}`);
    context.drawImage(image, 0, 0);
    return [key, atlas] as const;
  })).then((entries) => Object.fromEntries(entries) as ClassicArt).catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  return cached;
}

const RASTER_SCALE = 2;
const snap = (value: number) => Math.round(value * RASTER_SCALE) / RASTER_SCALE;

export class SmbRenderer extends Canvas2D {
  constructor(canvas: HTMLCanvasElement, width: number, height: number, private readonly art: ClassicArt) {
    super(canvas, width, height);
  }

  override resize(width = this.width, height = this.height) {
    super.resize(width, height, RASTER_SCALE);
    this.context.imageSmoothingEnabled = false;
  }

  override drawWorld(world: World) {
    for (const entity of world.query(SmbFrame)) {
      const frame = world.require(entity, SmbFrame);
      const { state } = frame;
      const { camera, elapsed, feet, height, playerX, position, flagY, castleFlagY } = interpolateSmbFrame(frame);
      const ctx = this.context;
      const surface = state.area.theme === 'surface';
      const { flag, castle, region: finishRegion } = state.level.finish;
      const { phase } = state.hud;
      const dying = phase === 'dying';
      const climbing = phase === 'flag' || phase === 'flag-dismount';
      const inCastle = phase === 'countdown' || phase === 'fireworks' || phase === 'cleared';
      const tiles = state.area.tiles;
      const visible = (x: number, w: number) => x + w >= camera && x < camera + VIEW_WIDTH;
      const sprite = (
        image: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number,
        x: number, y: number, w: number, h: number, flip = false,
      ) => {
        const left = snap(x - camera);
        const top = snap(y);
        if (!flip) {
          ctx.drawImage(image, sx, sy, sw, sh, left, top, w, h);
          return;
        }
        ctx.save();
        ctx.translate(left + w, top);
        ctx.scale(-1, 1);
        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
        ctx.restore();
      };
      // Two transparent pixels around each cell keep adjacent poses out of the sample.
      const playerSprite = (
        column: number, row: number, size: number, sourceHeight: number,
        x: number, y: number, drawHeight: number, flip = false,
      ) => sprite(this.art.player, 2 + column * 20, 2 + row * 36, size, sourceHeight,
        x, y, size, drawHeight, flip);
      const tile = (id: number, x: number, y: number, h = 16) =>
        sprite(this.art.blocks, 1 + id % 48 * 17, 1 + Math.floor(id / 48) * 17, 16, h, x, y, 16, h);
      const blockPhase = Math.floor(elapsed * 8) % 4;

      ctx.fillStyle = surface ? '#5c94fc' : '#000';
      ctx.fillRect(0, 0, this.width, this.height);
      if (surface && state.level.id === '1-1') ctx.drawImage(this.art.background, -snap(camera), 0);
      else for (const art of state.area.background ?? []) {
        if (visible(art.x, 16)) tile(art.art, art.x, art.y);
      }

      const p = state.player;
      const change = frame.powerChange;
      const age = change ? Math.max(0, elapsed - change.at) : Infinity;
      const growing = state.transformTime > 0 && change?.from === 'small' && state.power === 'big' && p.h > SMALL_MARIO_HEIGHT;
      const changingSize = Math.abs(height - p.h) > .5;
      const cycle = Math.floor(age * 24) % 3;
      const tall = p.h === BIG_MARIO_HEIGHT;
      const flashing = (state.transformTime > 0 || age < .24) && !changingSize && tall && change?.from !== 'small';
      const blinking = state.invulnerable && !growing && !changingSize && !flashing && Math.floor(state.invulnerable * 15) % 2 !== 0;
      if (!dying && !inCastle && phase !== 'lost' && !blinking) {
        const stride = Math.floor(elapsed * (Math.abs(p.vx) > 100 ? 16 : 11)) % 3;
        const pose = !p.grounded ? 4 : Math.abs(p.vx) > 8 ? 1 + stride : 0;
        const crouching = state.crouching && !growing && !flashing;
        const form = !tall ? 0 : state.power === 'fire' ? 2 : 1;
        const climbPose = form * 2 + (phase === 'flag' ? Math.floor(elapsed * 9) % 2 : 0);
        const column = climbing ? climbPose : crouching ? 5 : growing || changingSize ? 0 : flashing ? Math.floor(age * 24) % 4 : pose;
        const row = climbing ? 6 : crouching ? (state.power === 'fire' ? 2 : 1) :
          growing ? [0, 3, 1][cycle]! : changingSize ? 3 : flashing ? 4 : form;
        // The source sprites are 16/32 pixels tall, anchored to the shared feet.
        const drawHeight = crouching ? 32 : growing ? (row === 0 ? 16 : 32) : snap(16 * height / SMALL_MARIO_HEIGHT);
        const x = playerX + (p.w - 16) / 2;
        const y = snap(feet) - drawHeight;
        const left = snap(x - camera);
        ctx.save();
        if (state.starTime > 0) ctx.filter = `hue-rotate(${Math.floor(elapsed * 16) % 6 * 60}deg)`;
        // A sprite can extend past the hitbox. Mask solid cells even at transparent tile edges.
        for (const block of tiles) {
          if (block.hidden) continue;
          const edge = snap(block.x - camera);
          const top = block.lift ? position(block).y : block.y;
          if (left + 16 <= edge || left >= edge + block.w ||
              y + drawHeight <= top || y >= top + block.h) continue;
          ctx.beginPath();
          ctx.rect(left, y, 16, drawHeight);
          ctx.rect(edge, top, block.w, block.h);
          ctx.clip('evenodd');
        }
        playerSprite(column, row, 16, row === 0 || (climbing && !tall) ? 16 : 32,
          x, y, drawHeight, state.facing < 0);
        ctx.restore();
      }

      for (const block of tiles) {
        const { x, y, w, h, kind } = block;
        if (block.hidden || !visible(x, w)) continue;
        const sinceBump = elapsed - (block.bumpAt ?? -Infinity);
        const bump = sinceBump >= 0 && sinceBump < .18 ? 5 * Math.sin(sinceBump / .18 * Math.PI) : 0;
        switch (kind) {
          case 'ground': {
            const first = Math.max(0, Math.floor((camera - x) / 16) * 16);
            for (let dx = first; dx < Math.min(w, camera + VIEW_WIDTH - x); dx += 16) {
              for (let dy = 0; dy < h; dy += 16) tile(block.art ?? (surface ? 384 : 400), x + dx, y + dy);
            }
            break;
          }
          case 'lift': {
            const liftY = snap(position(block).y);
            if (block.art !== undefined) {
              for (let i = 0; i < 3; i++) tile(block.art + i, x + i * 16, liftY, h);
            } else {
              ctx.fillStyle = '#ac4b16';
              ctx.fillRect(snap(x - camera), liftY, w, h);
            }
            break;
          }
          case 'pipe':
            for (let dy = 0; dy < h; dy += 16) {
              const id = block.art ?? (dy === 0 ? 150 : 198);
              const remaining = Math.min(16, h - dy);
              tile(id, x, y + dy, remaining);
              if (w === 32) tile(id + 1, x + 16, y + dy, remaining);
            }
            if (block.warp && !block.warpDirection && state.player.grounded && Math.abs(state.player.x + 6 - x - 16) <= 10 &&
                Math.abs(state.player.y + state.player.h - y) < 1) {
              ctx.fillStyle = '#fff';
              ctx.fillRect(snap(x - camera + 12), y - 35, 8, 2);
              ctx.fillRect(snap(x - camera + 14), y - 33, 4, 2);
            }
            break;
          case 'question': {
            const art = block.art ?? (surface ? 192 : 208);
            tile(art === 192 || art === 208 ? art + blockPhase : art, x, y - bump);
            break;
          }
          case 'used': tile(surface ? 196 : 212, x, y - bump); break;
          case 'stone': tile(block.art ?? 197, x, y); break;
          case 'brick': tile(block.art ?? (surface ? 289 : 306), x, y - bump); break;
        }
      }

      ctx.font = '7px "FC SMB", monospace';
      ctx.fillStyle = '#fff';
      for (const sign of state.area.signs ?? []) {
        if (visible(sign.x, 70)) ctx.fillText(sign.text, snap(sign.x - camera), sign.y);
      }
      for (const block of tiles) {
        if (block.label && visible(block.x, block.w)) {
          ctx.fillText(block.label, snap(block.x - camera + 4), block.y - 8);
        }
      }
      if (state.region === finishRegion && visible(flag - 16, 32)) {
        tile(101, flag - 8, 32);
        for (let y = 48; y < GROUND_Y - 16; y += 16) tile(149, flag - 8, y);
        tile(152, flag - 16, flagY);
      }
      if ((phase === 'fireworks' || phase === 'cleared') && visible(castle + 24, 12)) {
        const x = snap(castle + 24 - camera);
        const y = snap(castleFlagY);
        ctx.fillStyle = '#fcfcfc';
        ctx.fillRect(x, y, 11, 8);
        ctx.fillRect(x, y + 8, 1, 4);
        ctx.fillStyle = '#d82800';
        ctx.fillRect(x + 5, y + 1, 2, 6);
        ctx.fillRect(x + 3, y + 3, 6, 2);
      }
      for (const coin of state.area.coins) {
        if (visible(coin.x, coin.w)) tile((surface ? 144 : 160) + blockPhase, coin.x - 4, coin.y - 2);
      }
      for (const item of state.pickups) {
        const { x, y } = position(item);
        if (!visible(x, item.w)) continue;
        if (item.emergence > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, VIEW_WIDTH, item.blockTop);
          ctx.clip();
        }
        const id = item.kind === 'mushroom' ? 608 : item.kind === 'one-up' ? 52 : item.kind === 'star' ? 96 + blockPhase : 48 + blockPhase;
        tile(id, x - 1, y - 2);
        if (item.emergence > 0) ctx.restore();
      }
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        const { x, y } = position(enemy);
        if (!visible(x, enemy.w)) continue;
        if (enemy.kind === 'plant') {
          const exposed = Math.round(enemy.pipeTop - y);
          if (exposed > 0) {
            sprite(this.art.enemy, 145 + (Math.floor(elapsed * 6) % 2) * 16, surface ? 25 : 73,
              16, exposed, x - 1, enemy.pipeTop - exposed, 16, exposed);
          }
          continue;
        }
        const stride = enemy.active && enemy.vx !== 0 ? Math.floor(elapsed * 8) % 2 : 0;
        const column = (enemy.kind === 'goomba' ? 0 : enemy.kind === 'koopa' ? 3 : 7) + stride;
        const tall = enemy.kind === 'koopa';
        // Use the lower half of the Koopa's 32px slot for the compact shell only.
        sprite(this.art.enemy, 1 + column * 16, (tall ? 17 : 33) + (surface ? 0 : 48), 16, tall ? 32 : 16,
          x - 1, y, 16, enemy.h, enemy.vx > 0);
      }
      for (const shot of state.shots) {
        const { x, y } = position(shot);
        playerSprite(Math.floor(elapsed * 16) % 2, 5, 8, 8, x - 1, y - 1, 8);
      }
      for (const effect of state.effects) {
        const age = Math.max(0, elapsed - effect.at);
        if (age >= EFFECT_TIME || !visible(effect.x - 16, 32)) continue;
        const x = snap(effect.x - camera);
        if (effect.kind === 'firework') {
          const radius = Math.floor(3 + age / EFFECT_TIME * 13);
          const y = snap(effect.y);
          const diagonal = Math.round(radius * .7);
          ctx.fillStyle = age < .28 ? '#fcfcfc' : '#fc9838';
          for (const [dx, dy] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]] as const) {
            ctx.fillRect(x + dx - 1, y + dy - 1, 3, 3);
          }
          ctx.fillStyle = '#d82800';
          for (const dx of [-diagonal, diagonal]) {
            for (const dy of [-diagonal, diagonal]) ctx.fillRect(x + dx, y + dy, 3, 3);
          }
          if (age < .22) ctx.fillRect(x - 1, y - 1, 3, 3);
          continue;
        }
        if (effect.kind === 'brick') {
          ctx.fillStyle = surface ? '#c84c0c' : '#008088';
          for (const direction of [-1, 1]) {
            for (const speed of [70, 105]) {
              const y = effect.y - speed * age + 210 * age * age;
              ctx.fillRect(snap(x + direction * (3 + age * speed / 2)), snap(y), 4, 4);
            }
          }
          continue;
        }
        if (effect.kind === 'coin' && age < .36) {
          tile((surface ? 144 : 160) + Math.floor(age * 24) % 4, effect.x - 8, effect.y - 15 - 27 * Math.sin(age / .36 * Math.PI));
          continue;
        }
        if (effect.kind === 'spark' && age < .2) {
          const y = snap(effect.y + 4);
          ctx.fillStyle = '#fff2a8';
          ctx.fillRect(x - 4, y - 1, 8, 2);
          ctx.fillRect(x - 1, y - 4, 2, 8);
        }
        ctx.font = '7px "FC SMB", monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(effect.text ?? '100', x - 10, snap(effect.y - 7 - 24 * age));
      }
      // Death is a foreground particle, so the sprite falls past solid ground.
      if (dying) playerSprite(5, 0, 16, 16, playerX + (p.w - 16) / 2, snap(feet) - 16, 16);
    }
  }
}
