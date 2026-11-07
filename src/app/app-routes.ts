import { defineRoutes } from '@xiaobaibaifqy/jingchuanchu-app/application';
import { GameCatalog } from '../pages/game-catalog.js';

export const AppRoutes = defineRoutes([
  {
    name: 'lobby',
    path: '/',
    loadPage: () => import('../pages/lobby/lobby-page.js').then((module) => module.LobbyPage),
  },
  ...GameCatalog.map(({ id, loadPage }) => ({ name: `play-${id}`, path: `/play/${id}`, loadPage })),
  { name: 'unknown', path: '/*missing', redirect: { name: 'lobby' } },
]);
