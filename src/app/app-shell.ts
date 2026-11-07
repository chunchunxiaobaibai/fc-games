import { defineComponent, RouteLink, RouterOutlet } from '@xiaobaibaifqy/jingchuanchu-app/application';

export const AppShell = defineComponent({
  selector: 'game-app',
  components: [RouterOutlet, RouteLink],
  setup: () => ({}),
});
