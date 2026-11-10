import { defineActions, defineGameScene } from '@xiaobaibaifqy/jingchuanchu-app/application';
import { SmbMusic, SmbSounds } from './assets/sounds.js';
import { captureSmbFrame, SmbFrame, type SmbPresentation } from './smb-frame.ts';
import { SmbSession, type Hud } from './smb-session.ts';
import type { Level } from './levels/level.ts';

// The page maps physical keys into these engine actions through setVirtual().
const actions = defineActions({
  move: { kind: 'axis', negative: [], positive: [] },
  jump: { kind: 'button' },
  sprint: { kind: 'button' },
  down: { kind: 'button' },
  fire: { kind: 'button' },
});

export function createSmbScene(initial: () => { carry: Hud; level: Level }, publish: (hud: Hud) => void, started: () => boolean) {
  return defineGameScene({
    id: 'smb-world',
    actions,
    setup(context) {
      const { carry, level } = initial();
      const run = new SmbSession(carry, (key) => {
        if (context.audio.state() === 'ready' && !context.audio.preferences().muted) {
          void context.audio.playEffect(SmbSounds, key);
        }
      }, level);
      const frame: SmbPresentation = { state: run, previous: captureSmbFrame(run), alpha: 1 };
      context.world.set(context.create(), SmbFrame, frame);
      context.addSystem({
        id: 'smb-render-interpolation',
        phase: 'render',
        update({ alpha }) {
          frame.alpha = alpha;
        },
      });

      let last: Hud | undefined;
      let track: 'overworld' | 'underground' | 'superstar' | undefined;
      let stopMusic: (() => void) | undefined;
      let musicRequest = 0;
      const syncMusic = () => {
        const next = run.hud.phase !== 'playing' || context.audio.state() !== 'ready' || context.audio.preferences().muted
          ? undefined : run.starTime > 0 ? 'superstar' : run.area.theme === 'surface' ? 'overworld' : 'underground';
        if (next === track) return;
        track = next;
        const request = ++musicRequest;
        stopMusic?.();
        stopMusic = undefined;
        if (!next) return;
        void context.audio.playMusic(SmbMusic, next, { loop: true }).then((result) => {
          if (result.status !== 'played') {
            if (request === musicRequest && (result.status === 'cancelled' ||
                (result.status === 'blocked' && result.reason === 'suspended'))) track = undefined;
            return;
          }
          if (request !== musicRequest) result.playback.stop();
          else stopMusic = () => result.playback.stop();
        });
      };
      context.scope.own(() => {
        musicRequest++;
        stopMusic?.();
      });
      context.addSystem({
        id: 'smb-fixed-update',
        update({ delta }) {
          if (!started()) return;
          frame.previous = captureSmbFrame(run);
          const { move } = context.actions.axes;
          const { down, fire, jump, sprint } = context.actions.buttons;
          const power = run.power;
          run.step(delta, {
            direction: move, sprint: sprint.down, jump: jump.down, jumpPressed: jump.pressed,
            down: down.down, downPressed: down.pressed, firePressed: fire.pressed,
          });
          if (power !== run.power) frame.powerChange = { from: power, at: run.elapsed };
          syncMusic();
          const next = run.hud;
          if (!last || next.time !== last.time || next.coins !== last.coins ||
              next.score !== last.score || next.lives !== last.lives || next.phase !== last.phase || next.power !== last.power) {
            last = { ...next };
            publish(last);
          }
        },
      });
    },
  });
}
