import {
  computed, definePage, effect, GameCanvas, RouteLink, signal,
  type GameCanvasHandle, type GameCanvasOptions,
} from '@xiaobaibaifqy/jingchuanchu-app/application';
import { createSmbScene } from '../../../games/smb/smb-scene.js';
import { SmbRenderer } from '../../../games/smb/smb-renderer.js';
import { InitialHud, SIMULATION_HZ } from '../../../games/smb/smb-session.ts';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../../games/smb/levels/world-1-1.ts';

const options: GameCanvasOptions = Object.freeze({
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  maxPixelRatio: 1,
  clock: { tickRate: SIMULATION_HZ },
  background: '#6077d8',
  createRenderer: (canvas: HTMLCanvasElement, width: number, height: number, ratio: number) =>
    new SmbRenderer(canvas, width, height, ratio),
});

export const SmbPage = definePage({
  selector: 'fc-smb-play',
  components: [GameCanvas, RouteLink],
  setup(context) {
    const hud = signal({ ...InitialHud });
    const paused = signal(false);
    const ready = signal(false);
    const restarting = signal(false);
    const issue = signal('');
    const soundNotice = signal('');
    const muted = computed(() => context.audio.preferences().muted || context.audio.state() !== 'ready');
    const finished = computed(() => hud().phase === 'lost' || hud().phase === 'cleared');
    const result = computed(() => hud().phase === 'cleared' ? '关卡完成！' :
      hud().lives ? hud().failure : '游戏结束');
    const score = computed(() => String(hud().score).padStart(6, '0'));
    const coins = computed(() => String(hud().coins % 100).padStart(2, '0'));
    const time = computed(() => String(hud().time).padStart(3, '0'));
    let carry = { ...InitialHud };
    let handle: GameCanvasHandle | undefined;
    const scene = createSmbScene(() => carry, hud.set);
    const focusCanvas = () => context.element('board').querySelector('canvas')?.focus({ preventScroll: true });
    const applyPause = () => {
      const stop = paused() || finished() || restarting() || Boolean(issue());
      if (!handle) return;
      if (stop) handle.pause();
      else handle.resume();
    };

    effect(applyPause, context.scope);
    const onReady = (game: GameCanvasHandle) => {
      handle = game;
      ready.set(true);
      applyPause();
      if (!paused()) focusCanvas();
    };
    const pause = () => {
      if (!ready() || finished() || restarting() || issue()) return;
      paused.set(!paused());
      if (!paused()) focusCanvas();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || event.repeat || event.isComposing ||
          event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      pause();
    };
    const pauseOnBlur = () => {
      if (ready() && !finished()) paused.set(true);
    };
    const pauseWhenHidden = () => {
      if (document.hidden) pauseOnBlur();
    };
    window.addEventListener('blur', pauseOnBlur);
    document.addEventListener('visibilitychange', pauseWhenHidden);
    context.own(() => {
      window.removeEventListener('blur', pauseOnBlur);
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      handle = undefined;
    });
    const onError = (error: unknown) => {
      console.error(error);
      issue.set('游戏场景暂时无法运行，可以重试或返回大厅。');
    };
    const restart = async (continueLives: boolean) => {
      if (!handle || restarting()) return;
      const before = hud();
      carry = continueLives && before.lives > 0
        ? { ...InitialHud, score: before.score, coins: before.coins, lives: before.lives }
        : { ...InitialHud };
      restarting.set(true);
      issue.set('');
      applyPause();
      try {
        await handle.restart();
        if (context.signal.aborted) return;
        hud.set({ ...carry });
        paused.set(false);
        focusCanvas();
      } catch (error) {
        if (!context.signal.aborted) onError(error);
      } finally {
        if (!context.signal.aborted) restarting.set(false);
      }
    };
    const toggleSound = async () => {
      soundNotice.set('');
      if (!muted()) {
        context.audio.setMuted(true);
        focusCanvas();
        return;
      }
      const result = await context.audio.unlock();
      if (context.signal.aborted) return;
      if (result.status === 'ready') context.audio.setMuted(false);
      else soundNotice.set('浏览器暂时无法启用声音，请再次点击。');
      focusCanvas();
    };
    return {
      options, scene, hud, score, coins, time, paused, ready, restarting, muted, soundNotice,
      issue, finished, result, onReady, onError, onKey, pause, restart, toggleSound,
    };
  },
});
