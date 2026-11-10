import { defineRoutes } from '@xiaobaibaifqy/jingchuanchu-app/application';
import { GameCatalog } from '../pages/game-catalog.js';
import { LobbyPage } from '../pages/lobby/lobby-page.js';

export const AppRoutes = defineRoutes([
  {
    name: 'lobby',
    path: '/',
    page: LobbyPage,
  },
  ...GameCatalog.map(({ id, loadPage }) => ({ name: `play-${id}`, path: `/play/${id}`, loadPage })),
  { name: 'unknown', path: '/*missing', redirect: { name: 'lobby' } },
]);
