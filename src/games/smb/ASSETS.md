# SMB 素材与代码来源

- `rules/collision.ts` 的 AABB 重叠判断移植自 [mario_js 的 physics.js](https://github.com/tylerreichle/mario_js/blob/1c8978790c4c7fbf13afac6e3d300cb5af9e0b72/lib/util/physics.js)。逐轴扫掠、固定步长和实体状态适配为本项目实现。原 MIT 声明见 [mario-js.LICENSE.txt](../../../public/licenses/mario-js.txt)。
- `smb-session.ts` 的移动龟壳击敌及火球碰敌参考 [Gold872 的 EnemySystem.cpp](https://github.com/Gold872/Super-Mario-Bros/blob/609c5af217abf6eb55d3eb594df4db76cfb0c90c/src/systems/EnemySystem.cpp)，并将相应规则适配为 TypeScript。原 MIT 声明见 [gold872.LICENSE.txt](../../../public/licenses/gold872.txt)。
- `levels/world-1-1.ts` 是按首关节奏编写的地图。参考 [mario_js 的关卡结构](https://github.com/tylerreichle/mario_js/blob/1c8978790c4c7fbf13afac6e3d300cb5af9e0b72/lib/map/level_1-1.js)确定比例和推进节奏，地图文件为本项目手写。
- `assets/classic/` 的 SVG 图集、标题、背景和大厅封面来自 [Gold872 的图块、角色和关卡数据](https://github.com/Gold872/Super-Mario-Bros/tree/609c5af217abf6eb55d3eb594df4db76cfb0c90c/res)。渲染器按当前关卡的碰撞位置绘制地形与角色，背景装饰使用上游的 1-1 背景层。
- HUD 使用 [Press Start 2P](https://github.com/google/fonts/tree/main/ofl/pressstart2p)，授权文本见 [press-start-2p.txt](../../../public/licenses/press-start-2p.txt)。中文界面使用系统字体。`assets/*.wav` 为本项目合成的短方波提示音。
- 玩家的起跳速度、升降力和横向速度上限参考 [NES 版 SMB 的反汇编](https://github.com/Xkeeper0/smb1/blob/master/src/prg.asm#L4858)，按项目的 60 Hz 固定步长换算。
- `src/app/web-audio-driver.ts` 来自本地引擎 0.5.0 浏览器 starter。引擎 MIT 声明保留在 `vendor/jingchuanchu-0.5.0/LICENSE`。

构建会将第三方声明复制到 `dist/licenses/`，随静态游戏分发。
