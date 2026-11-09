# FC Games 红白机游戏厅

浏览器单机游戏大厅。首款游戏为《超级马里奥兄弟》，已开放 World 1-1 和 1-2，使用项目附带的 Jingchuanchu Engine 0.5.0。

## 本地运行

在项目根目录使用 Node.js 22.12 或更高版本运行以下命令。

```sh
npm ci
npm run dev
```

打开终端显示的地址，在大厅选择游戏，再点击画面内的「开始游戏」。也可以直接进入 `#/play/smb`。1-1 通关后选择「下一关」进入 1-2，继续使用本局生命、分数、金币和体型。画面右下方可切换全屏，网页内和全屏均采用 16:15 比例。游玩时用方向键或 A / D 移动，Space 或 Z 跳跃，Shift 或 X 冲刺，向下键进隐藏管道，取得火力花后用 C 或 X 发射火球。助跑后起跳可以跳得更高、更远，按住跳跃键可延长上升。Esc 暂停或退出全屏，点「开启声音」可启用音效。

```sh
npm test        # 关卡和玩法规则回归
npm run build   # 检查引擎组件、类型并构建静态文件
npm run preview # 预览 dist
```

将 `dist/` 放到任意静态 HTTP 站点即可运行。游戏使用 hash 路由，部署到子目录时保留构建产物的目录结构。

## 接入游戏

把游戏规则和素材放到 `src/games/<id>/`，游玩页放到 `src/pages/play/<id>/`。在 [游戏登记表](src/pages/game-catalog.ts) 增加条目，登记表驱动大厅卡片和按需加载的游玩路由。

- [目录规划](tasks/structure.md)
- [实施计划](tasks/plan.md)
- [TODO 和验收记录](tasks/todo.md)
- [SMB 源码和素材来源](src/games/smb/ASSETS.md)
