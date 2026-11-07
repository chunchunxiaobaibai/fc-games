import './styles/base.css';
import { bootstrapApplication } from '@xiaobaibaifqy/jingchuanchu-app/application';
import { AppConfig } from './app/app-config.js';

void bootstrapApplication(AppConfig).catch((error: unknown) => {
  console.error(error);
  const root = document.querySelector('game-app');
  if (root) root.textContent = '游戏大厅启动失败，请刷新页面重试。';
});
