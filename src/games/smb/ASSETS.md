# SMB 素材与代码来源

- `rules/collision.ts` 的 AABB 重叠判断移植自 [mario_js 的 physics.js](https://github.com/tylerreichle/mario_js/blob/1c8978790c4c7fbf13afac6e3d300cb5af9e0b72/lib/util/physics.js)。逐轴扫掠、固定步长和实体状态适配为本项目实现。原 MIT 声明见 [mario-js.LICENSE.txt](../../../public/licenses/mario-js.txt)。
- `smb-session.ts` 的移动龟壳击敌及火球碰敌参考 [Gold872 的 EnemySystem.cpp](https://github.com/Gold872/Super-Mario-Bros/blob/609c5af217abf6eb55d3eb594df4db76cfb0c90c/src/systems/EnemySystem.cpp)，并将相应规则适配为 TypeScript。原 MIT 声明见 [gold872.LICENSE.txt](../../../public/licenses/gold872.txt)。
- 1-1、1-2 的地形、敌人和道具坐标由 [Gold872 固定版本的 CSV 地图](https://github.com/Gold872/Super-Mario-Bros/tree/609c5af217abf6eb55d3eb594df4db76cfb0c90c/res/data) 转写为 `levels/classic-layout-data.ts`。`classic-layout.ts` 将图块和出入口适配到当前引擎，地图事件与运动继续由本项目实现。
- `assets/classic/` 的 SVG 图集、标题、背景和大厅封面来自 [Gold872 的图块、角色和关卡数据](https://github.com/Gold872/Super-Mario-Bros/tree/609c5af217abf6eb55d3eb594df4db76cfb0c90c/res)。
- `assets/music/` 的地面、地下、超级星背景音乐来自同一提交的 [WAV 音乐目录](https://github.com/Gold872/Super-Mario-Bros/tree/609c5af217abf6eb55d3eb594df4db76cfb0c90c/res/sounds/music)，压缩为单声道 MP3 供网页播放。
- `assets/finish/` 的滑旗、计时和爆炸音效来自同一提交的 [Gold872 WAV 音效](https://github.com/Gold872/Super-Mario-Bros/tree/609c5af217abf6eb55d3eb594df4db76cfb0c90c/res/sounds/effects)。旗杆分档、每单位时间 50 分和烟花条件参考 [NES 版结算逻辑](https://www.6502disassembly.com/nes-smb/SuperMarioBros.html#GameTimerFireworks)。
- HUD 使用 [Press Start 2P](https://github.com/google/fonts/tree/main/ofl/pressstart2p)，授权文本见 [press-start-2p.txt](../../../public/licenses/press-start-2p.txt)。中文界面使用系统字体。`assets/*.wav` 为本项目合成的短方波提示音。
- 玩家的起跳速度、升降力和横向速度上限参考 [NES 版 SMB 的反汇编](https://github.com/Xkeeper0/smb1/blob/master/src/prg.asm#L4858)，按项目的 60 Hz 固定步长换算。
- `src/app/web-audio-driver.ts` 来自本地引擎 0.5.0 浏览器 starter。引擎 MIT 声明保留在 `vendor/jingchuanchu-0.5.0/LICENSE`。

构建会将第三方声明复制到 `dist/licenses/`，随静态游戏分发。
