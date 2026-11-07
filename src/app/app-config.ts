import { defineApplication } from '@xiaobaibaifqy/jingchuanchu-app/application';
import { AppRoutes } from './app-routes.js';
import { AppShell } from './app-shell.js';
import { createWebAudioDriver } from './web-audio-driver.js';

export const AppConfig = defineApplication({
  root: AppShell,
  routes: AppRoutes,
  audio: { driver: () => createWebAudioDriver(), maxEffects: 8 },
  assets: {
    transport: () => ({
      async load(entry, signal) {
        const controller = new AbortController();
        const unsubscribe = signal.subscribe(() => controller.abort(signal.reason));
        try {
          signal.throwIfAborted();
          const response = await fetch(entry.url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Asset request failed (${response.status})`);
          return await response.arrayBuffer();
        } finally {
          unsubscribe();
        }
      },
    }),
  },
});
