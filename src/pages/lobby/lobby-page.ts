import { computed, definePage, RouteLink } from '@xiaobaibaifqy/jingchuanchu-app/application';
import { GameCatalog } from '../game-catalog.js';

export const LobbyPage = definePage({
  selector: 'fc-lobby',
  components: [RouteLink],
  setup: ({ router }) => ({
    pendingGame: computed(() => router.pending()?.to.name),
    games: GameCatalog.map(({ loadPage: _loadPage, ...game }, index) => ({
      ...game,
      number: String(index + 1).padStart(2, '0'),
      target: { name: `play-${game.id}` },
    })),
  }),
});
