import { defineConfig } from 'vite';
import { jingchuanchu } from '@xiaobaibaifqy/jingchuanchu-tooling/vite';
export default defineConfig({ base: './', plugins: [jingchuanchu()] });
