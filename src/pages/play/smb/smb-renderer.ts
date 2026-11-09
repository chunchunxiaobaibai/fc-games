import type { World } from '@xiaobaibaifqy/jingchuanchu-ecs';
import { Canvas2D } from '@xiaobaibaifqy/jingchuanchu-renderer-2d';
import type { ClassicArt } from '../../../games/smb/assets/classic-art.js';
import { GROUND_Y, VIEW_WIDTH } from '../../../games/smb/levels/level.ts';
import { CASTLE_X } from '../../../games/smb/levels/world-1-1.ts';
import { interpolateSmbFrame, SmbFrame } from '../../../games/smb/smb-frame.ts';

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
      const { camera, elapsed, feet, height, playerX, position, flagY } = interpolateSmbFrame(frame);
      const ctx = this.context;
      const surface = state.area.theme === 'surface';
      const { flag, castle, region: finishRegion } = state.level.finish;
      const dying = state.hud.phase === 'dying';
      const tiles = state.area.tiles;
      const visible = (x: number, w: number) => x + w >= camera && x < camera + VIEW_WIDTH;
      const sprite = (
        image: HTMLImageElement, sx: number, sy: number, sw: number, sh: number,
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
      if (surface) {
        ctx.drawImage(this.art.background, -snap(camera), 0);
        if (state.region === finishRegion && state.level.id !== '1-1' && visible(castle - 16, 80)) {
          ctx.drawImage(this.art.background, CASTLE_X - 16, 0, 80, this.height,
            snap(castle - 16 - camera), 0, 80, this.height);
        }
      }

      const p = state.player;
      const change = frame.powerChange;
      const age = change ? Math.max(0, elapsed - change.at) : Infinity;
      const changingSize = Math.abs(height - p.h) > .5;
      const flashing = age < .24 && !changingSize && p.h > 15 && change?.from !== 'small';
      const blinking = state.invulnerable && !changingSize && !flashing && Math.floor(state.invulnerable * 15) % 2 !== 0;
      if (!dying && state.hud.phase !== 'cleared' && state.hud.phase !== 'lost' && !blinking) {
        const tall = p.h > 15;
        const stride = Math.floor(elapsed * (Math.abs(p.vx) > 100 ? 16 : 11)) % 3;
        const pose = !p.grounded ? 4 : Math.abs(p.vx) > 8 ? 1 + stride : 0;
        const column = changingSize ? 0 : flashing ? Math.floor(age * 24) % 4 : pose;
        const row = changingSize ? 3 : flashing ? 4 : !tall ? 0 : state.power === 'fire' ? 2 : 1;
        const drawHeight = snap(height);
        const x = playerX + (p.w - 16) / 2;
        const y = snap(feet) - drawHeight;
        const left = snap(x - camera);
        ctx.save();
        // A sprite can extend past the hitbox. Mask solid cells even at transparent tile edges.
        for (const block of tiles) {
          const edge = snap(block.x - camera);
          const top = block.lift ? position(block).y : block.y;
          if (left + 16 <= edge || left >= edge + block.w ||
              y + drawHeight <= top || y >= top + block.h) continue;
          ctx.beginPath();
          ctx.rect(left, y, 16, drawHeight);
          ctx.rect(edge, top, block.w, block.h);
          ctx.clip('evenodd');
        }
        playerSprite(column, row, 16, row === 0 ? 16 : 32,
          x, y, drawHeight, state.facing < 0);
        ctx.restore();
      }

      for (const block of tiles) {
        const { x, y, w, h, kind } = block;
        if (!visible(x, w)) continue;
        switch (kind) {
          case 'ground': {
            const first = Math.max(0, Math.floor((camera - x) / 16) * 16);
            for (let dx = first; dx < Math.min(w, camera + VIEW_WIDTH - x); dx += 16) {
              for (let dy = 0; dy < h; dy += 16) tile(surface ? 384 : 400, x + dx, y + dy);
            }
            break;
          }
          case 'lift': {
            const liftY = snap(position(block).y);
            ctx.fillStyle = '#ac4b16';
            ctx.fillRect(snap(x - camera), liftY, w, h);
            ctx.fillStyle = '#ffc184';
            ctx.fillRect(snap(x - camera), liftY, w, 2);
            break;
          }
          case 'pipe':
            for (let dy = 0; dy < h; dy += 16) {
              const id = dy === 0 ? 150 : 198;
              const remaining = Math.min(16, h - dy);
              tile(id, x, y + dy, remaining);
              tile(id + 1, x + 16, y + dy, remaining);
            }
            if (block.warp && state.player.grounded && Math.abs(state.player.x + 6 - x - 16) <= 10 &&
                Math.abs(state.player.y + state.player.h - y) < 1) {
              ctx.fillStyle = '#fff';
              ctx.fillRect(snap(x - camera + 12), y - 35, 8, 2);
              ctx.fillRect(snap(x - camera + 14), y - 33, 4, 2);
            }
            break;
          case 'question': tile(192 + blockPhase, x, y); break;
          case 'used': tile(196, x, y); break;
          case 'stone': tile(197, x, y); break;
          case 'brick': tile(surface ? 289 : 306, x, y); break;
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
        tile(101, flag - 8, 40);
        for (let y = 48; y < GROUND_Y - 16; y += 16) tile(149, flag - 8, y);
        tile(152, flag - 16, flagY);
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
        tile(item.kind === 'mushroom' ? 608 : 48 + blockPhase, x - 1, y - 2);
        if (item.emergence > 0) ctx.restore();
      }
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        const { x, y } = position(enemy);
        if (!visible(x, enemy.w)) continue;
        if (enemy.kind === 'plant') {
          const exposed = Math.round(enemy.pipeTop - y);
          if (exposed > 0) {
            sprite(this.art.enemy, 145 + (Math.floor(elapsed * 6) % 2) * 16, 25,
              16, exposed, x - 1, enemy.pipeTop - exposed, 16, exposed);
          }
          continue;
        }
        const stride = enemy.active && enemy.vx !== 0 ? Math.floor(elapsed * 8) % 2 : 0;
        const column = (enemy.kind === 'goomba' ? 0 : enemy.kind === 'koopa' ? 3 : 7) + stride;
        const tall = enemy.kind === 'koopa';
        // Use the lower half of the Koopa's 32px slot for the compact shell only.
        sprite(this.art.enemy, 1 + column * 16, tall ? 17 : 33, 16, tall ? 32 : 16,
          x - 1, y, 16, enemy.h, enemy.vx > 0);
      }
      for (const shot of state.shots) {
        const { x, y } = position(shot);
        playerSprite(Math.floor(elapsed * 16) % 2, 5, 8, 8, x - 1, y - 1, 8);
      }
      // Death is a foreground particle, so the sprite falls past solid ground.
      if (dying) playerSprite(5, 0, 16, 16, playerX + (p.w - 16) / 2, snap(feet) - 16, 16);
    }
  }
}
