# README 展示图来源

这组图片用于项目 README 的功能说明。图中的导演台和预演画面均来自真实工程；排版与模块编号为编辑说明，不是产品内新增的界面。产品 UI 截图没有使用 AI 伪造；TapNow 结果图明确标注为外部生成视频的真实抽帧。

## 成品

| 图片                                                             | 尺寸        | 内容                                                        |
| ---------------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| [功能全景](../../public/readme/module-overview.jpg)              | 1280 × 1350 | 真实导演台大图、六个已实现功能模块、外部视频工具交接        |
| [镜头迭代](../../public/readme/codex-camera-iteration.jpg)       | 1280 × 856  | 真实 Codex CLI 第二轮修改前后，第二镜头相同 2.0 秒位置      |
| [导演台原始截图](../../public/readme/director-courtyard.jpg)     | 1280 × 720  | 《午后交接》r3，第一镜头起始帧                              |
| [摄影机原始截图](../../public/readme/director-camera.jpg)        | 1280 × 720  | 《午后交接》r3，第二镜头起始帧                              |
| [镜头对比原图](../../public/readme/codex-camera-comparison.png)  | 1280 × 390  | r2 / r3 的第二镜头 2.0 秒，沿用已核验案例证据               |
| [典型场景展板](../../public/readme/scene-examples.jpg)           | 1600 × 931  | 香水产品广告与公路双人跟拍，两幅实际预演关键帧              |
| [TapNow 真实生成对照](../../public/readme/tapnow-comparison.jpg) | 1600 × 1432 | 两条实际输出的 3 秒静帧与输入对照，保留未达到真人目标的说明 |

## 来源和真实边界

- 采集日期：2026-10-13。
- 两张导演台原始截图来自独立案例服务的 Codex in-app browser 页面截图。采集过程中只切换第一、第二镜头，没有修改工程；界面保存状态为 r3。
- 镜头对比原图来自本地案例证据 `.hengdian/codex-case/visual-evidence/camera-before-after.png`，保持文件原样。原图 SHA-256：`532778cf88a66b06db2d825fa03e8beaa62f8d2939f01dd460078f3bf7a09400`。
- 功能全景和镜头对照分别由 [modules.html](modules.html) 和 [camera.html](camera.html) 在浏览器渲染并全页截图，未修改被引用截图的内容。
- 典型场景展板源为 [scenes.html](scenes.html)。两幅图片来自 `.hengdian/showcase/product/handoff/keyframes/000072.png` 与 `.hengdian/showcase/road/handoff/keyframes/000072.png` 的真实拍摄包关键帧，以原文件复制到 `public/readme/product-previs.png` 和 `public/readme/road-previs.png`。两个 manifest 均为 1280 × 720、24 FPS、144 帧、6 秒，因此第 72 帧对应 3.0 秒。产品工程为 r3，公路工程为 r2；展板不展示或宣称 TapNow 成片。展板通过 CUA 在 Chrome 独立临时页截图，并按 main 内容边界截取 1600 × 931；两幅原始场景画面均完整保留，未裁切。
- TapNow 对照展板源为 [results.html](results.html)。结果帧来自本轮实际下载输出的 `.hengdian/showcase/tapnow/product-result-middle.png` 和 `road-result-middle.png`，均为 3 秒抽帧。使用系统图像工具按 JPEG 质量 88 转为 `public/readme/product-result.jpg` 和 `road-result.jpg`，保持 1280 × 720 全幅，没有裁切、补画、调色或替换内容。输入 MP4 为 6 秒 720p，输出为 6.04 秒 720p；模型为 TapNow 页面中的 Seedance 2.5。
- TapNow 对照是静帧层面的构图与外观展示，不作为全程运镜、动作或时序一致性的验收证明。香水结果呈现玻璃与石材质感；公路结果保留木偶角色，未达到真人目标，图中显式标出。
- “真实 Codex”限定于已有 [Codex CLI 案例](../CODEX.md)，不代表 DeepSeek Harness 已实测。
- “外部视频工具”是导出后的交接阶段，不代表项目内置 TapNow 自动直连。三维预演与外部 AI 生成结果分开陈述。
- 图片仅精选 README 展示内容；原始工程、视频、会话及测试工作空间继续留在被忽略的 `.hengdian/`。这次用户明确要求把展示图放入 README，因此这些小型展示图片随文档提交。

## 重新生成

在仓库根目录运行一个本地静态文件服务，打开 `docs/showcase/modules.html`、`docs/showcase/camera.html` 、`docs/showcase/scenes.html` 或 `docs/showcase/results.html`。前两页按 1280 像素宽设计，场景与生成对照展板按 1600 像素宽设计；使用浏览器全页截图保存 JPEG 到 `public/readme/`。HTML 仅引用仓库内截图，没有网络字体或外部资源。

修改文案后应同时更新成品图片并重新肉眼复核：中文完整、无溢出、模块编号正确、不把未实现能力写入图中。
