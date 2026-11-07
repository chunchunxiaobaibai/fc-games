# SMB 素材与代码来源

- `rules/collision.ts` 的 AABB 重叠判断移植自 [mario_js 的 physics.js](https://github.com/tylerreichle/mario_js/blob/1c8978790c4c7fbf13afac6e3d300cb5af9e0b72/lib/util/physics.js)。逐轴扫掠、固定步长和实体状态适配为本项目实现。原 MIT 声明见 [mario-js.LICENSE.txt](../../../public/licenses/mario-js.txt)。
- `smb-session.ts` 的移动龟壳击敌及火球碰敌参考 [Gold872 的 EnemySystem.cpp](https://github.com/Gold872/Super-Mario-Bros/blob/609c5af217abf6eb55d3eb594df4db76cfb0c90c/src/systems/EnemySystem.cpp)，并将相应规则适配为 TypeScript。原 MIT 声明见 [gold872.LICENSE.txt](../../../public/licenses/gold872.txt)。
- `levels/world-1-1.ts` 是按首关节奏编写的地图。参考 [mario_js 的关卡结构](https://github.com/tylerreichle/mario_js/blob/1c8978790c4c7fbf13afac6e3d300cb5af9e0b72/lib/map/level_1-1.js)确定比例和推进节奏，地图文件为本项目手写。
- `assets/cover.svg`、`assets/pixels.ts` 及场景内的几何图形是本项目绘制的像素图形。`assets/*.wav` 为本项目合成的短方波提示音。界面使用系统字体。
- `src/app/web-audio-driver.ts` 来自本地引擎 0.5.0 浏览器 starter。引擎 MIT 声明保留在 `vendor/jingchuanchu-0.5.0/LICENSE`。

构建会将第三方声明复制到 `dist/licenses/`，随静态游戏分发。
