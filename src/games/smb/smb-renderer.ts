import { component, type World } from '@xiaobaibaifqy/jingchuanchu-ecs';
import { Canvas2D } from '@xiaobaibaifqy/jingchuanchu-renderer-2d';
import { pixels, palette } from './assets/pixels.js';
import { CASTLE_X, FLAG_X, GROUND_Y, VIEW_WIDTH } from './levels/world-1-1.ts';
import type { Tile } from './levels/world-1-1.ts';
import type { SmbSession } from './smb-session.ts';

export const SmbFrame = component<SmbSession>('smb-frame');

export class SmbRenderer extends Canvas2D {
  override drawWorld(world: World) {
    for (const entity of world.query(SmbFrame)) {
      const state = world.require(entity, SmbFrame);
      const ctx = this.context;
      const camera = Math.floor(state.camera);
      const box = (color: string, x: number, y: number, w: number, h: number) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), w, h);
      };
      const art = (sprite: readonly string[], x: number, y: number, w: number, h: number, flip = false, colors = palette) => {
        const columns = sprite[0]!.length;
        for (let row = 0; row < sprite.length; row++) {
          for (let col = 0; col < columns; col++) {
            const color = colors[sprite[row]![col]!];
            if (!color) continue;
            const column = flip ? columns - col - 1 : col;
            const left = Math.floor(column * w / columns);
            const top = Math.floor(row * h / sprite.length);
            box(color, x + left, y + top, Math.ceil((column + 1) * w / columns) - left,
              Math.ceil((row + 1) * h / sprite.length) - top);
          }
        }
      };
      const visible = (x: number, w: number) => x + w >= camera && x <= camera + VIEW_WIDTH;

      if (state.region === 'surface') {
        box('#6077d8', 0, 0, this.width, this.height);
        box('#7589e2', 0, 120, this.width, 120);
        for (let i = 0; i < 4; i++) {
          const x = i * 96 - (camera * 0.25 % 96);
          const y = 43 + ((i + Math.floor(camera * 0.25 / 96)) % 3) * 15;
          box('#d4e3f5', x, y + 5, 34, 7);
          box('#fff1db', x + 7, y, 21, 8);
          box('#fff1db', x + 13, y - 4, 11, 4);
        }
        for (let i = 0; i < 4; i++) {
          const x = i * 98 - (camera * 0.55 % 98);
          box('#4c8c67', x, 192, 77, 16);
          box('#4c8c67', x + 10, 181, 55, 12);
          box('#73a765', x + 19, 170, 38, 12);
          box('#73a765', x + 29, 162, 18, 8);
        }
      } else {
        box('#141c32', 0, 0, this.width, this.height);
        for (let y = 38; y < GROUND_Y; y += 16) {
          for (let x = 0; x < VIEW_WIDTH; x += 32) box('#202a43', x + (y % 32), y, 23, 2);
        }
      }

      if (state.region === 'surface' && visible(CASTLE_X, 64)) {
        const x = CASTLE_X - camera;
        box('#80443e', x, 150, 64, 58);
        box('#bd6951', x + 3, 154, 58, 54);
        for (let offset = 0; offset < 64; offset += 16) {
          box('#80443e', x + offset, 142, 11, 10);
          box('#d88a65', x + offset, 142, 11, 2);
        }
        for (let y = 159; y < 208; y += 8) {
          box('#8d4f46', x + 3, y, 58, 1);
          for (let j = y % 16; j < 56; j += 13) box('#8d4f46', x + j + 3, y, 1, 7);
        }
        box('#372b3d', x + 25, 181, 14, 27);
        box('#372b3d', x + 28, 177, 8, 4);
        box('#372b3d', x + 11, 164, 6, 9);
        box('#372b3d', x + 47, 164, 6, 9);
      }

      const drawTile = (tile: Tile) => {
        const x = tile.x - camera;
        const { y, w, h } = tile;
        if (tile.kind === 'pipe') {
          box('#195541', x + 2, y, w - 4, h);
          box('#31834f', x + 4, y, 20, h);
          box('#75be59', x + 7, y, 5, h);
          box('#26623f', x, y, w, 8);
          box('#8fd46c', x + 1, y + 1, w - 2, 2);
          box('#59ab55', x + 4, y + 3, 7, 4);
          if (tile.warp && state.player.grounded && Math.abs(state.player.x + 6 - tile.x - 16) <= 10 &&
              Math.abs(state.player.y + state.player.h - y) < 1) {
            box('#fff1db', x + 12, y - 35, 8, 2);
            box('#fff1db', x + 14, y - 33, 4, 2);
          }
          return;
        }
        if (tile.kind === 'ground') {
          const start = Math.max(0, Math.floor(-x / 16) * 16);
          const end = Math.min(w, VIEW_WIDTH - x);
          for (let offset = start; offset < end; offset += 16) {
            const left = x + offset;
            box('#8a493e', left, y, 16, h);
            box('#c97752', left + 1, y + 1, 14, 14);
            box('#aa5b46', left + 1, y + 17, 14, 14);
            box('#eea166', left + 1, y + 1, 14, 3);
            box('#9a5441', left + 5, y + 8, 6, 2);
          }
          return;
        }
        if (tile.kind === 'question') {
          box('#85463c', x, y, 16, 16);
          box(Math.floor(state.elapsed * 5) % 3 === 0 ? '#ffd577' : '#efaa4f', x + 1, y + 1, 14, 13);
          box('#935540', x + 5, y + 3, 6, 2);
          box('#935540', x + 9, y + 5, 2, 2);
          box('#935540', x + 7, y + 7, 4, 2);
          box('#935540', x + 7, y + 11, 2, 2);
          return;
        }
        box('#703e40', x, y, 16, 16);
        box(tile.kind === 'used' ? '#9e7060' : tile.kind === 'stone' ? '#d8a86c' : '#c77354', x + 1, y + 1, 14, 14);
        if (tile.kind === 'brick') {
          box('#854b43', x, y + 7, 16, 1);
          box('#854b43', x + 7, y, 1, 7);
          box('#854b43', x + 4, y + 8, 1, 8);
          box('#854b43', x + 12, y + 8, 1, 8);
        } else box('#eab47b', x + 2, y + 2, 12, 2);
      };
      for (const tile of state.map[state.region].tiles) if (visible(tile.x, tile.w)) drawTile(tile);

      if (state.region === 'surface' && visible(FLAG_X - 12, 32)) {
        const x = FLAG_X - camera;
        box('#f8edd4', x, 46, 2, GROUND_Y - 46 - 16);
        box('#ffd564', x - 2, 43, 6, 5);
        box('#faf0db', x - 16, state.flagY, 16, 10);
        box('#31834f', x - 14, state.flagY + 2, 8, 6);
      }
      for (const coin of state.map[state.region].coins) {
        if (!visible(coin.x, coin.w)) continue;
        const width = Math.floor(state.elapsed * 10) % 3 === 0 ? 3 : 6;
        const x = coin.x - camera + (8 - width) / 2;
        box('#d8843c', x, coin.y + 1, width, 10);
        box('#ffdb6d', x + 1, coin.y, width - 1, 10);
      }
      for (const item of state.items[state.region]) {
        if (!visible(item.x, item.w)) continue;
        ctx.save();
        if (item.emergence > 0) {
          ctx.beginPath();
          ctx.rect(0, 0, VIEW_WIDTH, item.blockTop);
          ctx.clip();
        }
        art(pixels[item.kind], item.x - camera, item.y, item.w, item.h);
        ctx.restore();
      }
      for (const enemy of state.actors[state.region]) {
        if (!enemy.dead && visible(enemy.x, enemy.w)) art(pixels[enemy.kind], enemy.x - camera, enemy.y, enemy.w, enemy.h, enemy.vx > 0);
      }
      for (const shot of state.shots) {
        box('#ff9651', shot.x - camera, shot.y, 6, 6);
        box('#ffe988', shot.x - camera + 1, shot.y + 1, 4, 4);
      }
      const p = state.player;
      if (state.hud.phase !== 'cleared' && (!state.invulnerable || Math.floor(state.invulnerable * 15) % 2 === 0)) {
        const stride = p.grounded && Math.abs(p.vx) > 15 ? Math.floor(state.elapsed * 13) % 2 : 0;
        const colors = state.power === 'fire' ? { ...palette, r: '#fff0cd', b: '#c13d36' } : palette;
        art(pixels.player, p.x - camera, p.y - stride, p.w, p.h, state.facing < 0, colors);
      }
    }
  }
}
