import type { Hud } from '../../../games/smb/smb-session.ts';

export const bindingRows = [
  { id: 'left', label: '向左移动' },
  { id: 'right', label: '向右移动' },
  { id: 'jump', label: '跳跃' },
  { id: 'sprint', label: '助跑' },
  { id: 'down', label: '蹲伏 / 进竖管' },
  { id: 'fire', label: '火球' },
  { id: 'pause', label: '暂停 / 继续' },
] as const;
export type BindingId = typeof bindingRows[number]['id'];
export type BindingSlot = 'primary' | 'alternate';
export type Bindings = Record<BindingId, readonly string[]>;

export const defaultBindings: Bindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'ArrowUp', 'KeyZ', 'KeyW'],
  sprint: ['ShiftLeft', 'ShiftRight', 'KeyX'],
  down: ['ArrowDown', 'KeyS'],
  fire: ['KeyC', 'KeyX'],
  pause: ['Escape'],
};

export const bindingPresets = {
  classic: defaultBindings,
  wasd: {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    jump: ['KeyW', 'Space'], sprint: ['ShiftLeft', 'ShiftRight'],
    down: ['KeyS', 'ArrowDown'], fire: ['KeyF', 'KeyC'], pause: ['Escape', 'KeyP'],
  },
} satisfies Record<string, Bindings>;
export type BindingPreset = keyof typeof bindingPresets;

const friendly: Record<string, string> = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  ShiftLeft: 'LShift', ShiftRight: 'RShift', Escape: 'Esc', Space: 'Space',
};
export const keyLabel = (code: string) => friendly[code] ?? code.replace(/^(Key|Digit)/, '');

export function supportedKey(code: string, action: BindingId) {
  return (code === 'Escape' && action === 'pause') ||
    /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash)$/.test(code);
}

export function rebind(bindings: Bindings, action: BindingId, code: string, slot: BindingSlot = 'primary') {
  if (!supportedKey(code, action)) return { error: '这个按键保留给网页或菜单，请换一个键。' } as const;
  const [primary, ...alternates] = bindings[action];
  if (slot === 'alternate' && code === primary) return { error: '备选键和主键需要不同。' } as const;
  const conflict = bindingRows.find((row) => row.id !== action && bindings[row.id].includes(code));
  if (conflict && !bindings[action].includes(code)) {
    return { error: `${keyLabel(code)} 已用于「${conflict.label}」。` } as const;
  }
  const keys = slot === 'alternate' ? [primary!, code] : [code, ...alternates.filter((key) => key !== code)];
  return { bindings: { ...bindings, [action]: keys } } as const;
}

export type Checkpoint = Pick<Hud, 'score' | 'coins' | 'lives' | 'power'> & { level: string };
export interface SmbProfile {
  version: 1;
  bindings: Bindings;
  startingLives: number;
  startingLevel: string;
  cleared: readonly string[];
  checkpoint: Checkpoint | null;
}

export const defaultProfile = (): SmbProfile => ({
  version: 1, bindings: defaultBindings, startingLives: 3, startingLevel: '1-1', cleared: [], checkpoint: null,
});

const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

export function parseProfile(value: unknown, levels: readonly string[]): SmbProfile {
  const raw = object(value);
  const profile = defaultProfile();
  if (raw?.version !== 1) return profile;
  const bindings = object(raw.bindings);
  const candidate = { ...defaultBindings };
  for (const { id } of bindingRows) {
    const keys = bindings?.[id];
    if (Array.isArray(keys) && keys.length > 0 && keys.length <= 4 &&
        keys.every((key: unknown) => typeof key === 'string' && supportedKey(key, id))) {
      candidate[id] = [...new Set(keys as string[])];
    }
  }
  // The original X shortcut intentionally covers sprint and fire. Other duplicates
  // can only come from a hand-edited or damaged save.
  const conflict = bindingRows.some(({ id }, index) =>
    bindingRows.slice(index + 1).some(({ id: other }) =>
      candidate[id].some((key) => candidate[other].includes(key) &&
        !(key === 'KeyX' && id === 'sprint' && other === 'fire'))));
  if (!conflict) profile.bindings = candidate;
  if (integer(raw.startingLives, 1, 9)) profile.startingLives = raw.startingLives;
  if (typeof raw.startingLevel === 'string' && levels.includes(raw.startingLevel)) profile.startingLevel = raw.startingLevel;
  if (Array.isArray(raw.cleared)) {
    profile.cleared = [...new Set(raw.cleared.filter((id): id is string => typeof id === 'string' && levels.includes(id)))];
  }
  const saved = object(raw.checkpoint);
  if (saved && typeof saved.level === 'string' && levels.includes(saved.level) &&
      integer(saved.score) && integer(saved.coins) && integer(saved.lives, 1) &&
      (saved.power === 'small' || saved.power === 'big' || saved.power === 'fire')) {
    profile.checkpoint = { level: saved.level, score: saved.score, coins: saved.coins, lives: saved.lives, power: saved.power };
  }
  return profile;
}
