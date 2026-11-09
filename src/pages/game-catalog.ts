import type { RoutePage } from '@xiaobaibaifqy/jingchuanchu-app/application';

interface GameEntry {
  id: string;
  title: string;
  originalTitle: string;
  genre: string;
  year: number;
  summary: string;
  cover: string;
  loadPage: () => PromiseLike<RoutePage>;
}

export const GameCatalog: readonly GameEntry[] = [
  {
    id: 'smb',
    title: '超级马里奥兄弟',
    originalTitle: 'SUPER MARIO BROS.',
    genre: '平台跳跃',
    year: 1985,
    summary: '奔跑、跳跃、踢龟壳，穿过蘑菇王国与地下洞窟。',
    cover: new URL('../games/smb/assets/cover.svg', import.meta.url).href,
    loadPage: () => import('./play/smb/smb-page.js').then((module) => module.SmbPage),
  },
];
