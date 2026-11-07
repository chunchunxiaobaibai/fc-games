import { defineActions, defineGameScene } from '@xiaobaibaifqy/jingchuanchu-app/application';
import { SmbSounds } from './assets/sounds.js';
import { captureSmbFrame, SmbFrame } from './smb-frame.ts';
import { SmbSession, type Hud } from './smb-session.ts';

const actions = defineActions({
  move: { kind: 'axis', negative: ['ArrowLeft', 'KeyA'], positive: ['ArrowRight', 'KeyD'], preventDefault: true },
  jump: { kind: 'button', keys: ['Space', 'ArrowUp', 'KeyZ', 'KeyW'], preventDefault: true },
  sprint: { kind: 'button', keys: ['ShiftLeft', 'ShiftRight', 'KeyX'], preventDefault: true },
  down: { kind: 'button', keys: ['ArrowDown', 'KeyS'], preventDefault: true },
  fire: { kind: 'button', keys: ['KeyX', 'KeyC'], preventDefault: true },
});

export function createSmbScene(initialHud: () => Hud, publish: (hud: Hud) => void) {
  return defineGameScene({
    id: 'smb-world-1-1',
    actions,
    setup(context) {
      const run = new SmbSession(initialHud(), (key) => {
        if (context.audio.state() === 'ready' && !context.audio.preferences().muted) {
          void context.audio.playEffect(SmbSounds, key);
        }
      });
      const frame = { state: run, previous: captureSmbFrame(run), alpha: 1 };
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
          frame.previous = captureSmbFrame(run);
          const { move } = context.actions.axes;
          const { down, fire, jump, sprint } = context.actions.buttons;
          run.step(delta, {
            direction: move, sprint: sprint.down, jump: jump.down, jumpPressed: jump.pressed,
            downPressed: down.pressed, firePressed: fire.pressed,
          });
          const next = run.hud;
          if (!last || next.time !== last.time || next.coins !== last.coins ||
              next.score !== last.score || next.lives !== last.lives || next.phase !== last.phase) {
            last = { ...next };
            publish(last);
          }
        },
      });
    },
  });
}
