import {
  computed, definePage, effect, GameCanvas, RouteLink, signal,
  type GameCanvasHandle, type GameCanvasOptions,
} from '@xiaobaibaifqy/jingchuanchu-app/application';
import { createSmbScene } from '../../../games/smb/smb-scene.js';
import { loadClassicArt, SmbRenderer, type ClassicArt } from './smb-renderer.js';
import { InitialHud, SIMULATION_HZ } from '../../../games/smb/smb-session.ts';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../../games/smb/levels/level.ts';
import { World11 } from '../../../games/smb/levels/world-1-1.ts';
import { World12 } from '../../../games/smb/levels/world-1-2.ts';
import { classicLogo, classicMenuBackground, hudCoin, hudMario } from '../../../games/smb/assets/classic-art.js';
import { localGameSaves } from '../../game-saves.js';
import { bindingPresets, bindingRows, defaultProfile, keyLabel, parseProfile, rebind, type BindingId, type BindingPreset, type BindingSlot, type SmbProfile } from './smb-profile.js';

const campaign = [World11, World12];
const gameId = 'smb';
const stageIntroMs = 1400;
const gameOverMs = 4500;
const nextStageMs = 650;

export const SmbPage = definePage({
  selector: 'fc-smb-play',
  components: [GameCanvas, RouteLink],
  setup(context) {
    const hud = signal({ ...InitialHud });
    const profile = signal(defaultProfile());
    const saveReady = signal(false);
    const storageNotice = signal('');
    const keyboardOpen = signal(false);
    const capturing = signal<{ id: BindingId; slot: BindingSlot } | null>(null);
    const bindingNotice = signal('');
    const bindings = computed(() => profile().bindings);
    const mappedControls = computed(() => {
      const map = bindings();
      const selection = capturing();
      return bindingRows.map(({ id, label }) => {
        const keys = map[id].map((code) => ({ code, label: keyLabel(code) }));
        return {
          id, label, keys,
          primary: keys[0]!.label,
          alternate: keys[1]?.label ?? '—',
          extraCount: Math.max(0, keys.length - 2),
          editingPrimary: selection?.id === id && selection.slot === 'primary',
          editingAlternate: selection?.id === id && selection.slot === 'alternate',
        };
      });
    });
    const activePreset = computed(() => {
      const map = bindings();
      return (['classic', 'wasd'] as const).find((preset) =>
        bindingRows.every(({ id }) => map[id].join(',') === bindingPresets[preset][id].join(','))) ?? '';
    });
    const rightKeys = computed(() => bindings().right.map((code) => ({ code, label: keyLabel(code) })));
    const resumeLevel = computed(() => profile().checkpoint?.level ?? '');
    const levelChoices = computed(() => campaign.map(({ id }, index) => ({
      id, index, completed: profile().cleared.includes(id),
    })));
    const saves = localGameSaves;
    let writes = Promise.resolve();
    const writeProfile = (changes: Partial<SmbProfile>) => {
      const next = { ...profile(), ...changes };
      profile.set(next);
      writes = writes.then(() => saves.write(gameId, next)).catch(() => {
        if (!context.signal.aborted) storageNotice.set('浏览器存储不可用，改动仅在本次打开时生效。');
      });
    };
    const levelIndex = signal(0);
    const level = computed(() => {
      const { id, title, summary } = campaign[levelIndex()]!;
      return { id, title, summary };
    });
    const nextLevelId = computed(() => campaign[levelIndex() + 1]?.id ?? '');
    const started = signal(false);
    const titlePanel = signal<'menu' | 'levels' | 'options'>('menu');
    const startingLevel = signal(0);
    const startingLevelId = computed(() => campaign[startingLevel()]!.id);
    const startingLives = signal(InitialHud.lives);
    const stageIntro = signal(false);
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
    const gameOver = computed(() => hud().phase === 'lost' && hud().lives === 0);
    const waitingForRetry = computed(() => hud().phase === 'lost' && hud().lives > 0);
    const cleared = computed(() => hud().phase === 'cleared');
    const dying = computed(() => hud().phase === 'dying');
    const score = computed(() => String(hud().score).padStart(6, '0'));
    const coins = computed(() => String(hud().coins % 100).padStart(2, '0'));
    const time = computed(() => String(hud().time).padStart(3, '0'));
    let initial = { carry: { ...InitialHud }, level: World11 };
    let handle: GameCanvasHandle | undefined;
    let stageTimer: ReturnType<typeof setTimeout> | undefined;
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
    const publishHud = (next: typeof InitialHud) => {
      const before = hud();
      hud.set(next);
      if (next.phase === before.phase) return;
      const { lives, score, coins, power } = next;
      if (next.phase === 'dying') {
        writeProfile({ checkpoint: lives > 0 ? { level: level().id, lives, score, coins, power: 'small' } : null });
      } else if (next.phase === 'cleared') {
        const id = nextLevelId();
        writeProfile({
          cleared: [...new Set([...profile().cleared, level().id])],
          checkpoint: id ? { level: id, lives, score, coins, power } : null,
        });
      }
    };
    const scene = createSmbScene(() => initial, publishHud, started);
    const heldKeys = new Set<string>();
    let syncKeyboard: (() => void) | undefined;
    const releaseKeys = () => {
      if (!heldKeys.size) return;
      heldKeys.clear();
      if (!context.signal.aborted) syncKeyboard?.();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (heldKeys.delete(event.code)) syncKeyboard?.();
    };
    const focusCanvas = () => context.element('board').querySelector('canvas')?.focus({ preventScroll: true });
    const restoreFocus = () => {
      if (started() && !keyboardOpen() && !paused() && !finished() && !issue()) focusCanvas();
    };
    const showTitlePanel = (panel: 'menu' | 'levels' | 'options') => {
      titlePanel.set(panel);
      queueMicrotask(() => {
        if (!context.signal.aborted) {
          const selector = panel === 'options' ? '.life-settings button:not(:disabled)' : '.title-actions button';
          context.element('board').querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true });
        }
      });
    };
    const selectLevel = (index: number) => {
      startingLevel.set(index);
      writeProfile({ startingLevel: campaign[index]!.id });
      showTitlePanel('menu');
    };
    const adjustLives = (delta: number) => {
      const lives = Math.max(1, Math.min(9, startingLives() + delta));
      startingLives.set(lives);
      writeProfile({ startingLives: lives });
    };
    const showStageIntro = () => {
      clearTimeout(stageTimer);
      stageIntro.set(true);
      stageTimer = setTimeout(() => {
        stageTimer = undefined;
        stageIntro.set(false);
        restoreFocus();
      }, stageIntroMs);
    };
    const applyPause = () => {
      const stop = !started() || keyboardOpen() || stageIntro() || paused() || finished() || restarting() || Boolean(issue());
      if (!handle) return;
      if (stop) {
        releaseKeys();
        handle.pause();
      }
      else handle.resume();
    };

    effect(applyPause, context.scope);
    const onReady = (game: GameCanvasHandle) => {
      heldKeys.clear();
      handle = game;
      const controls = game.forScene(scene);
      syncKeyboard = () => {
        const map = bindings();
        const active = (id: BindingId) => map[id].some((key) => heldKeys.has(key));
        controls.setVirtual('move', Number(active('right')) - Number(active('left')));
        controls.setVirtual('jump', active('jump'));
        controls.setVirtual('sprint', active('sprint'));
        controls.setVirtual('down', active('down'));
        controls.setVirtual('fire', active('fire'));
      };
      ready.set(true);
      applyPause();
      if (!started() && !restarting()) showTitlePanel('menu');
      if (started() && !restarting()) restoreFocus();
    };
    const pause = () => {
      if (!started() || stageIntro() || !ready() || dying() || finished() || restarting() || issue()) return;
      paused.set(!paused());
      if (!paused()) focusCanvas();
    };
    const toggleIntro = () => introOpen.set(!introOpen());
    const toggleKeyboard = () => {
      releaseKeys();
      const open = !keyboardOpen();
      keyboardOpen.set(open);
      capturing.set(null);
      bindingNotice.set('');
      queueMicrotask(() => {
        if (context.signal.aborted) return;
        if (!open && started() && !paused() && !finished() && !stageIntro() && !issue()) {
          restoreFocus();
          return;
        }
        const selector = open ? '.keyboard-dialog button' : '.keyboard-toggle';
        context.element('board').querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true });
      });
    };
    const captureKey = (id: BindingId, slot: BindingSlot) => {
      const selection = capturing();
      if (selection?.id === id && selection.slot === slot) {
        capturing.set(null);
        bindingNotice.set('已取消更改。');
        return;
      }
      capturing.set({ id, slot });
      bindingNotice.set(slot === 'alternate' ? '按新键，Delete 可清除备选。' : '按新键，再点该键位可取消。');
    };
    const applyPreset = (preset: BindingPreset) => {
      writeProfile({ bindings: bindingPresets[preset] });
      capturing.set(null);
      bindingNotice.set(preset === 'classic' ? '已恢复经典键位。' : '已应用 WASD 方案。');
    };
    const onSettingsKey = (event: KeyboardEvent) => {
      if (event.code === 'Tab') {
        const buttons = [...context.element('board').querySelectorAll<HTMLButtonElement>('.keyboard-dialog button')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey ? event.target === first : event.target === last) {
          (event.shiftKey ? last : first)?.focus();
          event.preventDefault();
        }
        return;
      }
      const action = capturing();
      if (event.repeat) return;
      if (event.code === 'Escape' && action?.id !== 'pause') {
        event.preventDefault();
        if (action) {
          capturing.set(null);
          bindingNotice.set('已取消更改。');
        } else toggleKeyboard();
      } else if (action) {
        event.preventDefault();
        if (action.slot === 'alternate' && (event.code === 'Delete' || event.code === 'Backspace')) {
          writeProfile({ bindings: { ...bindings(), [action.id]: [bindings()[action.id][0]!] } });
          capturing.set(null);
          bindingNotice.set('已清除备选键。');
          return;
        }
        const result = rebind(bindings(), action.id, event.code, action.slot);
        if (result.error !== undefined) {
          bindingNotice.set(result.error);
        } else {
          writeProfile({ bindings: result.bindings });
          capturing.set(null);
          bindingNotice.set('键位已更新。');
        }
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
        releaseKeys();
        return;
      }
      if (keyboardOpen()) {
        onSettingsKey(event);
        return;
      }
      if (!started() && (event.code === 'ArrowUp' || event.code === 'ArrowDown') &&
          (event.target as Element | null)?.closest('.title-actions')) {
        const buttons = [...context.element('board').querySelectorAll<HTMLButtonElement>('.title-actions button:not(:disabled)')];
        const current = buttons.findIndex((button) => button === event.target);
        if (current < 0) return;
        const direction = event.code === 'ArrowDown' ? 1 : -1;
        buttons[(current + direction + buttons.length) % buttons.length]?.focus({ preventScroll: true });
        event.preventDefault();
        return;
      }
      const escape = event.code === 'Escape';
      if (escape && fullscreen()) return;
      if (escape && !expanded() && introOpen() && (event.target as Element | null)?.closest('.info-toggle, .game-info')) {
        event.preventDefault();
        introOpen.set(false);
        return;
      }
      if (!context.element('screen').contains(event.target as Node | null)) return;
      if (escape && expanded()) {
        event.preventDefault();
        expanded.set(false);
        restoreFocus();
        return;
      }
      if (escape && !started() && titlePanel() !== 'menu') {
        event.preventDefault();
        showTitlePanel('menu');
        return;
      }
      const canvas = (event.target as Element | null)?.matches('canvas');
      if (bindings().pause.includes(event.code) && (canvas || escape)) {
        event.preventDefault();
        if (!event.repeat) pause();
        return;
      }
      if (!canvas || !started() || paused() || stageIntro() || restarting() || finished() || dying() || issue()) return;
      if (!bindingRows.some(({ id }) => id !== 'pause' && bindings()[id].includes(event.code))) return;
      event.preventDefault();
      if (!event.repeat) {
        heldKeys.add(event.code);
        syncKeyboard?.();
      }
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
      releaseKeys();
      if (started() && ready() && !dying() && !finished()) paused.set(true);
    };
    const pauseWhenHidden = () => {
      if (document.hidden) pauseOnBlur();
    };
    window.addEventListener('blur', pauseOnBlur);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', pauseWhenHidden);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    context.own(() => {
      window.removeEventListener('blur', pauseOnBlur);
      window.removeEventListener('keyup', onKeyUp);
      heldKeys.clear();
      syncKeyboard = undefined;
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      clearTimeout(stageTimer);
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
    void saves.read(gameId).then((raw) => {
      if (context.signal.aborted) return;
      const loaded = parseProfile(raw, campaign.map(({ id }) => id));
      profile.set(loaded);
      startingLives.set(loaded.startingLives);
      startingLevel.set(campaign.findIndex(({ id }) => id === loaded.startingLevel));
    }).catch(() => {
      if (!context.signal.aborted) storageNotice.set('浏览器存储不可用，改动仅在本次打开时生效。');
    }).finally(() => {
      if (!context.signal.aborted) saveReady.set(true);
    });
    const restart = async (mode: 'start' | 'resume' | 'retry' | 'new' | 'next') => {
      const starting = mode === 'start' || mode === 'resume';
      if (!handle || !saveReady() || restarting() || (starting && started())) return;
      if (starting && !context.audio.preferences().muted) void context.audio.unlock();
      const before = hud();
      const next = mode === 'next' && before.phase === 'cleared' ? campaign[levelIndex() + 1] : undefined;
      if (mode === 'next' && !next) return;
      const retry = mode === 'retry' && before.lives > 0;
      const saved = mode === 'resume' ? profile().checkpoint : null;
      if (mode === 'resume' && !saved) return;
      const target = next ?? (saved ? campaign.find(({ id }) => id === saved.level)! :
        retry ? campaign[levelIndex()]! : mode === 'start' ? campaign[startingLevel()]! : World11);
      initial = {
        level: target,
        carry: {
          ...InitialHud,
          time: target.time,
          lives: saved?.lives ?? (retry || next ? before.lives : startingLives()),
          score: saved?.score ?? (retry || next ? before.score : 0),
          coins: saved?.coins ?? (retry || next ? before.coins : 0),
          power: saved?.power ?? (next ? before.power : 'small'),
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
        const { score, coins, lives, power } = initial.carry;
        writeProfile({ checkpoint: { level: target.id, score, coins, lives, power } });
        paused.set(false);
        showStageIntro();
        started.set(true);
        restoreFocus();
      } catch (error) {
        if (!context.signal.aborted) onError(error);
      } finally {
        if (!context.signal.aborted) restarting.set(false);
      }
    };
    effect((onCleanup) => {
      if (!started() || keyboardOpen() || issue() || restarting()) return;
      if (waitingForRetry()) {
        const timer = setTimeout(() => void restart('retry'), 0);
        onCleanup(() => clearTimeout(timer));
      } else if (gameOver()) {
        const timer = setTimeout(() => {
          started.set(false);
          levelIndex.set(startingLevel());
          hud.set({ ...InitialHud });
          showTitlePanel('menu');
        }, gameOverMs);
        onCleanup(() => clearTimeout(timer));
      } else if (cleared() && nextLevelId()) {
        const timer = setTimeout(() => void restart('next'), nextStageMs);
        onCleanup(() => clearTimeout(timer));
      }
    }, context.scope);
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
      saveReady, storageNotice, mappedControls, rightKeys, resumeLevel, levelChoices, keyboardOpen, bindingNotice, toggleKeyboard, captureKey, activePreset, applyPreset, releaseKeys,
      issue, finished, dying, gameOver, waitingForRetry, cleared, onReady, onError, onKey, pause, restart, toggleSound, classicLogo, classicMenuBackground,
      hudCoin, hudMario, started, stageIntro, titlePanel, startingLevelId, startingLives, showTitlePanel, selectLevel, adjustLives, assetsReady, load, expanded, enlarged, toggleFullscreen, introOpen, toggleIntro, level, nextLevelId,
    };
  },
});
