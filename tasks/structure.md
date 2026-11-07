# FC Games 目录规划

应用以一个浏览器游戏大厅为入口。首款游戏的 ID 为 `smb`，对应《超级马里奥兄弟》。以下是大厅及首款游戏的实际目录。

```text
fcgames/
├── jingchuanchu-engine-0.5.0.tar.gz  # 本地引擎分发包
├── vendor/
│   └── jingchuanchu-0.5.0/         # 从分发包取出的本地 npm 包
├── package.json
├── package-lock.json
├── jingchuanchu.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/licenses/                # 随静态构建分发的第三方声明
├── src/
│   ├── main.ts                     # 启动引擎 Application
│   ├── app/
│   │   ├── app-config.ts
│   │   ├── app-routes.ts            # 大厅、游戏入口和未知路径
│   │   ├── app-shell.ts/html/css   # 同名的三个文件
│   │   └── web-audio-driver.ts
│   ├── pages/
│   │   ├── game-catalog.ts          # ID、名称、简介、封面、页面加载器
│   │   ├── lobby/                  # 大厅卡片和进入游戏
│   │   └── play/
│   │       └── smb/                # SMB 页面、HUD、暂停与结算界面
│   ├── games/
│   │   └── smb/
│   │       ├── smb-scene.ts        # 引擎场景、输入与玩法装配
│   │       ├── smb-renderer.ts     # 引擎 Canvas2D 渲染适配
│   │       ├── smb-session.ts      # 本局状态、计时、重开与结算
│   │       ├── levels/             # 关卡数据、出生点、管道出入口与旗杆
│   │       ├── rules/              # 移动、碰撞、敌人与道具规则
│   │       └── assets/             # 游戏专用精灵和音效
│   └── styles/
│       └── base.css
├── tests/                          # 首关固定步长回归测试
└── tasks/
    ├── structure.md
    ├── plan.md
    └── todo.md
```

## 游戏接入方式

- 使用引擎默认 hash 路由。大厅为 `#/`，首款游戏为 `#/play/smb`。从登记表生成具体游戏路由，使用引擎 `loadPage` 延迟加载游玩页，未知路径重定向到大厅。大厅初始加载只需要目录元数据和封面。
- 新增游戏时在 `src/games/<id>/` 放规则、场景与资源，在 `src/pages/play/<id>/` 放游玩页，并在登记表增加一项。页面调用游戏模块，游戏模块依赖引擎。不同游戏各自拥有局内状态，退出后可独立清理。登记表放在 `src/pages/`，这样应用路由和大厅都能引用它，同时符合引擎的依赖方向检查。
- 游戏页使用引擎 `GameCanvas` 托管场景，使用 `defineActions` 接入输入，使用引擎固定步长更新玩法。离开游戏页时由页面与场景作用域释放输入、计时、音频和资源请求。重开时创建新的一局，加载或退出期间完成的旧异步操作由原作用域取消。
- 工具配置保留浏览器模板的 `src/pages` 约定，将游戏业务路径设为 `src/games`。局内暂停、失败与通关由当前游戏页展示。共用组件等到第二款游戏确实需要时提取。
- 引擎 npm 依赖使用仓库内相对 `file:` 路径并纳入锁文件。接入时保留分发包的许可证与校验来源。实际移植第三方代码或接入第三方素材时，在对应游戏目录记录固定版本、所用文件及授权。
