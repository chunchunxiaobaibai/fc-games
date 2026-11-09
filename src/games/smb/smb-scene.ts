import { defineActions, defineGameScene } from '@xiaobaibaifqy/jingchuanchu-app/application';
import { SmbSounds } from './assets/sounds.js';
import { captureSmbFrame, SmbFrame, type SmbPresentation } from './smb-frame.ts';
import { SmbSession, type Hud } from './smb-session.ts';
import type { Level } from './levels/level.ts';

const actions = defineActions({
  move: { kind: 'axis', negative: ['ArrowLeft', 'KeyA'], positive: ['ArrowRight', 'KeyD'], preventDefault: true },
  jump: { kind: 'button', keys: ['Space', 'ArrowUp', 'KeyZ', 'KeyW'], preventDefault: true },
  sprint: { kind: 'button', keys: ['ShiftLeft', 'ShiftRight', 'KeyX'], preventDefault: true },
  down: { kind: 'button', keys: ['ArrowDown', 'KeyS'], preventDefault: true },
  fire: { kind: 'button', keys: ['KeyX', 'KeyC'], preventDefault: true },
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
            downPressed: down.pressed, firePressed: fire.pressed,
          });
          if (power !== run.power) frame.powerChange = { from: power, at: run.elapsed };
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
