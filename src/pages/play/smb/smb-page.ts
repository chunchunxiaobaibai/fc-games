import {
  computed, definePage, effect, GameCanvas, RouteLink, signal,
  type GameCanvasHandle, type GameCanvasOptions,
} from '@xiaobaibaifqy/jingchuanchu-app/application';
import { createSmbScene } from '../../../games/smb/smb-scene.js';
import { SmbRenderer } from './smb-renderer.js';
import { InitialHud, SIMULATION_HZ } from '../../../games/smb/smb-session.ts';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../../games/smb/levels/level.ts';
import { World11 } from '../../../games/smb/levels/world-1-1.ts';
import { World12 } from '../../../games/smb/levels/world-1-2.ts';
import { classicLogo, hudCoin, loadClassicArt, type ClassicArt } from '../../../games/smb/assets/classic-art.js';

const campaign = [World11, World12];

export const SmbPage = definePage({
  selector: 'fc-smb-play',
  components: [GameCanvas, RouteLink],
  setup(context) {
    const hud = signal({ ...InitialHud });
    const levelIndex = signal(0);
    const level = computed(() => {
      const { id, title, summary } = campaign[levelIndex()]!;
      return { id, title, summary };
    });
    const nextLevelId = computed(() => campaign[levelIndex() + 1]?.id ?? '');
    const started = signal(false);
    const assetsReady = signal(false);
    const fullscreen = signal(false);
    const expanded = signal(false);
    const introOpen = signal(false);
    const enlarged = computed(() => fullscreen() || expanded());
    const paused = signal(false);
    const ready = signal(false);
    const restarting = signal(false);
    const issue = signal('');
    const soundNotice = signal('');
    const muted = computed(() => context.audio.preferences().muted || context.audio.state() !== 'ready');
    const finished = computed(() => hud().phase === 'lost' || hud().phase === 'cleared');
    const dying = computed(() => hud().phase === 'dying');
    const result = computed(() => hud().phase === 'cleared' ? '关卡完成！' :
      hud().lives ? hud().failure : '游戏结束');
    const score = computed(() => String(hud().score).padStart(6, '0'));
    const coins = computed(() => String(hud().coins % 100).padStart(2, '0'));
    const time = computed(() => String(hud().time).padStart(3, '0'));
    let initial = { carry: { ...InitialHud }, level: World11 };
    let handle: GameCanvasHandle | undefined;
    let art: ClassicArt | undefined;
    const options: GameCanvasOptions = {
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      clock: { tickRate: SIMULATION_HZ },
      background: '#5c94fc',
      createRenderer: (canvas, width, height) => {
        if (!art) throw new Error('Classic art is not loaded');
        return new SmbRenderer(canvas, width, height, art);
      },
    };
    const scene = createSmbScene(() => initial, hud.set, started);
    const focusCanvas = () => context.element('board').querySelector('canvas')?.focus({ preventScroll: true });
    const restoreFocus = () => {
      if (started() && !paused() && !finished() && !issue()) focusCanvas();
    };
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
      if (started() && !restarting()) restoreFocus();
    };
    const start = () => {
      if (!ready() || issue() || started()) return;
      started.set(true);
      focusCanvas();
    };
    const pause = () => {
      if (!started() || !ready() || dying() || finished() || restarting() || issue()) return;
      paused.set(!paused());
      if (!paused()) focusCanvas();
    };
    const toggleIntro = () => introOpen.set(!introOpen());
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || event.repeat || event.isComposing ||
          event.altKey || event.ctrlKey || event.metaKey) return;
      if (fullscreen()) return;
      if (!expanded() && introOpen() && (event.target as Element | null)?.closest('.info-toggle, .game-info')) {
        event.preventDefault();
        introOpen.set(false);
        return;
      }
      if (!context.element('screen').contains(event.target as Node | null)) return;
      event.preventDefault();
      if (expanded()) {
        expanded.set(false);
        restoreFocus();
        return;
      }
      pause();
    };
    const onFullscreenChange = () => {
      fullscreen.set(document.fullscreenElement === context.element('screen'));
      restoreFocus();
    };
    const toggleFullscreen = async () => {
      const screen = context.element('screen');
      if (expanded()) {
        expanded.set(false);
        restoreFocus();
      } else if (fullscreen()) {
        await document.exitFullscreen();
      } else {
        try {
          if (!screen.requestFullscreen) throw new Error('Fullscreen unavailable');
          await screen.requestFullscreen();
        } catch {
          if (context.signal.aborted) return;
          expanded.set(true);
          restoreFocus();
        }
      }
    };
    const pauseOnBlur = () => {
      if (started() && ready() && !dying() && !finished()) paused.set(true);
    };
    const pauseWhenHidden = () => {
      if (document.hidden) pauseOnBlur();
    };
    window.addEventListener('blur', pauseOnBlur);
    document.addEventListener('visibilitychange', pauseWhenHidden);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    context.own(() => {
      window.removeEventListener('blur', pauseOnBlur);
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      handle = undefined;
    });
    const onError = (error: unknown) => {
      console.error(error);
      issue.set('游戏场景暂时无法运行，可以重试或返回大厅。');
    };
    const load = async () => {
      issue.set('');
      try {
        const images = await loadClassicArt();
        if (context.signal.aborted) return;
        art = images;
        assetsReady.set(true);
      } catch (error) {
        if (!context.signal.aborted) onError(error);
      }
    };
    void load();
    const restart = async (mode: 'retry' | 'new' | 'next') => {
      if (!handle || restarting()) return;
      const before = hud();
      const next = mode === 'next' && before.phase === 'cleared' ? campaign[levelIndex() + 1] : undefined;
      if (mode === 'next' && !next) return;
      const retry = mode === 'retry' && before.lives > 0;
      const target = next ?? (retry ? campaign[levelIndex()]! : World11);
      initial = {
        level: target,
        carry: {
          ...InitialHud,
          time: target.time,
          ...(retry || next ? { score: before.score, coins: before.coins, lives: before.lives } : {}),
          power: next ? before.power : 'small',
        },
      };
      restarting.set(true);
      issue.set('');
      applyPause();
      try {
        await handle.restart();
        if (context.signal.aborted) return;
        levelIndex.set(campaign.indexOf(target));
        hud.set({ ...initial.carry });
        paused.set(false);
        restoreFocus();
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
        restoreFocus();
        return;
      }
      const result = await context.audio.unlock();
      if (context.signal.aborted) return;
      if (result.status === 'ready') context.audio.setMuted(false);
      else soundNotice.set('浏览器暂时无法启用声音，请再次点击。');
      restoreFocus();
    };
    return {
      options, scene, hud, score, coins, time, paused, ready, restarting, muted, soundNotice,
      issue, finished, dying, result, onReady, onError, onKey, pause, restart, toggleSound, classicLogo,
      hudCoin, started, assetsReady, start, load, expanded, enlarged, toggleFullscreen, introOpen, toggleIntro, level, nextLevelId,
    };
  },
});
