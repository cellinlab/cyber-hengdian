# 场景搭建与资产库：一手资料研究和实施建议

核验日期：2026-10-13。范围：Cine Tracer、Unreal Sequencer、Blender Asset Browser、Twinmotion、D5，以及 Kenney、Poly Haven、Quaternius 的资产与分发条款。本文区分**官方资料已证实**、**本仓库现状**和**建议实现**。没有购买、下载第三方模型或发起云端生成；未宣称已完成全部扩展，也不做“全球最好”的排名。

## 结论

赛博横店值得建设的是“可继续导演的场景资源”：具有尺寸、入口、可走路径、拍摄方向、灯光意图、稳定对象身份和可复用镜头的组合。把模型堆进一个搜索框，只解决了找到物体，没有解决快速开拍。第一轮应交付原创程序化组件、六类可拍场景、局部追加机制和真实镜头验收。第三方资源以后接入同一数据契约。

## 主流产品提供的机制

| 产品 | 官方资料已证实 | 对赛博横店的建议，不代表已实现 |
| --- | --- | --- |
| Cine Tracer | 发行方 Steam 页面仍说明摄影机、布光和演员调度；页面同时有超过三年未更新的提示。2019 年 Epic 访谈介绍按真实尺度搭景、地面放置、从摄影机取景生成故事板。不能把历史路线图当成当前能力。[Steam](https://store.steampowered.com/app/904960/Cine_Tracer/)；[Epic 访谈，2019-07-17](https://www.unrealengine.com/spotlights/cine-tracer-delivers-easy-to-use-realistic-cinematography-simulation) | 以“我要拍什么”组织资源；放置后直接得到可用机位、人物尺度和走位。真实设备约束可作为可选模式，不必把创作者锁在复杂摄影器材模拟中。 |
| Unreal Sequencer | 多轨编辑器以轨道和关键帧控制对象、角色、摄影机；Level Sequence Asset 保存序列数据，Level Sequence Actor 绑定到场景。[Sequencer Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-sequencer-movie-tool-overview) | 场景身份和镜头动作分开保存；可复用机位、动作片段不能隐式改写共享场景。不同镜头之间的连续性要明确，不依赖聊天历史。 |
| Blender Asset Browser | 资产浏览器通过库、目录和缩略图组织对象；可复制自包含 bundle 到资源库，bundle 要打包外部依赖。4.4 官方手册页面的搜索索引可读，直接抓取返回错误；因此只采用已检索到的稳定机制，不推断最新版本新增功能。[4.4 官方手册](https://docs.blender.org/manual/en/4.4/editors/asset_browser.html) | 搜索索引与实体文件分离；同一资产可带多标签。提供独立预览、尺寸和来源；组合资产必须随包带齐依赖。 |
| Twinmotion | 用户库可保存自定义、导入及成组资产，并按文件夹组织。Spacing / Area 工具沿路径或区域散布物体，支持固定 seed、间距、尺度、旋转和贴地。[User Library](https://dev.epicgames.com/documentation/en-us/twinmotion/get-an-overview-of-the-user-library-in-twinmotion)；[Spacing and Area](https://dev.epicgames.com/documentation/en-us/twinmotion/spacing-and-area-tools-in-twinmotion) | “一排路灯”“两侧店面”“课桌矩阵”应是确定性组合操作。固定 seed 和显式展开结果保证别人打开工程不会换布局。 |
| D5 | 资源库区分模型、材质、粒子、HDRI、散布和地形；人物路径具有宽度、密度、方向和贴地选项；Scatter 支持密度、尺度、碰撞半径与 seed。[Asset Library](https://docs.d5render.com/user-guide/assets/whats-in-the-d5-online-assets-library)；[Character Path](https://docs.d5render.com/user-guide/animation-path/character-path)；[D5 Scatter](https://docs.d5render.com/user-guide/tool/how-to-use-d5-scatter) | 场景填充与有叙事身份的主演应分开。主演 A 不应因改变路人密度而失去 ID 或走位；局部替换不扰动其他角色和镜头。 |

上述资料用于研究机制，不授权复制软件界面、源码或商业资产。Cine Tracer 的旧独立域名本次访问跳到无关页面，未作为产品事实来源；采用发行方商品页与 Epic 访谈交叉限定时效。

## 免费使用不等于可以做资产仓库分发

| 来源 | 2026-10-13 已证实的许可/条件 | 本项目采用边界 |
| --- | --- | --- |
| Kenney | 官方支持页称资产页游戏素材为 CC0，可商用、不强制署名，并要求具体详情看资产页或包内许可。其 Logo 保留给官方项目。[Support](https://kenney.nl/support) | 适合将来接入低面数道具/道路；每个下载包保存许可原文、版本、原链接、内容哈希，不以品牌首页代替资产凭证，不放官方 Logo 暗示合作。 |
| Poly Haven | 资产许可页明确 HDRI、纹理、模型为 CC0，可重新分发；网页文案、示例渲染等站点内容不因此一起成为 CC0。[Asset License](https://polyhaven.com/license) | 适合将来补真实材质、环境光与选定道具。使用实际资产自己生成预览，避免直接把网站展示图当可分发素材。 |
| Poly Haven live API | 2026-07-18 官方说明现为免费，包括商用；调用需独立 User-Agent，产品内明确标注来源。这是 API 服务条件，和资产 CC0 是两层规则。[API](https://polyhaven.com/our-api) | 第一轮无需联网。后续做可选 provider 时分开管理 asset license 与 service terms；不靠抓网页批量爬取。 |
| Quaternius | 官方 `license.html` 的 QAL v1.0 日期为 2026-08-28，允许作品使用，但禁止将资产自身以独立资产、资产包或模板再分发，免费也不例外；该页声明未来修改不追溯已取得的旧版许可。[QAL](https://quaternius.com/license.html) | 不默认打包进开放场景库。若未来接入，核验具体取得版本和包内许可，保留证据，必要时获得清晰授权；不因为“免费”就给整个来源标 CC0。 |
| Quaternius 旧包页面 | [Simple Buildings](https://quaternius.com/packs/simplebuildings.html) 仍标 CC0，介绍医院、房屋、商店；[Modular Streets](https://quaternius.com/packs/modularstreets.html) 也标 CC0；[FAQ](https://quaternius.com/faq.html) 仍称所有模型 CC0。与新 QAL 页面存在公开冲突。 | 这是待解的来源冲突，不能简单宣称“全部已经改许可证”或“全部仍可再分发”。本轮不用其二进制资产，保持独立原创实现。 |
| D5 Material Library | 2026-05-09 条款区分 Personal Use 与 Project Use；后者也禁止独立形式再分发素材。[D5 条款](https://www.d5render.com/legal-terms/d5-render-terms-of-service) | 学习搭景交互；不抽取 D5 库模型来填充本项目。 |
| Twinmotion Library | 文档列出自有资产、Megascans、Sketchfab、Substance 等来源；Sketchfab 可含多种不同 CC 条款。[Library](https://dev.epicgames.com/documentation/twinmotion/the-twinmotion-library) | 聚合目录不是单一许可证，不应整体复制到开源库。来源逐项登记。 |

可供后续核验的明确候选包括 Kenney [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads)（官方标 CC0，90 个文件）与 [Furniture Kit](https://kenney.nl/assets/furniture-kit)（官方标 CC0，140 个文件）。文件数不等于独立高质量模型数，也不代表本项目已导入、优化或测试这些素材。

## 首批原创场景体系：六类、可拆可合

以下均为建议目标。每类至少有“完整片场 preset”和“可追加组合 assembly”；地标采用原创通用设计，不把近似造型冒充真实建筑扫描。

| 场景 | 模块化构件 | 拍摄锚点与开箱镜头 | 关键验收 |
| --- | --- | --- | --- |
| 地标广场 Landmark Plaza | 门廊、钟塔、台阶、栏杆、长椅、铺地、旗杆 | 广场入口、主角站位、台阶中点；建立镜头、低机位揭示、双人会面 | 远景可识别地标；近景台阶和人尺度协调；演员通道不被装饰占满。 |
| 通用建筑 Building Kit | 墙段、门洞、窗洞、柱、楼板、楼梯、屋檐、可替换立面 | 门内/门外停位、窗口、转角；进门、窗边对话、转角揭示 | 摄影机能进入；门洞是真开口；外景与内景共用对象身份。 |
| 乡村道路 Rural Road | 直路/弯路/路口、路肩、围栏、田块、树列、路牌、小屋 | 路径起终点、路边停靠区；正面跟拍、侧跟、人物走远 | 主演朝向与路径相符；路面连贯；近处植被不遮挡主体。 |
| 都市街道 Urban Street | 车行道、人行道、斑马线、店面、公交站、路灯、建筑立面 | 人行横道入口、店门、街角；街头对话、过街跟拍、街口全景 | 正常尺度的人行空间；排列不交叠；同一店面可在多个场景复用。 |
| 教室 Classroom | 教室壳体、门窗、黑板、讲台、课桌椅组合、书架 | 讲台、座位、后门；讲台看学生、学生反打、走道推进 | 课桌布局留通道；坐姿/站姿锚点独立；室内镜头没有误穿墙。 |
| 医院 Hospital | 走廊、门、接待台、等候椅、病床、床头柜、隔帘架 | 接待位、病床两侧、走廊交汇；候诊、床边对话、推行通道 | 医疗环境是叙事布景；不虚构实际医疗流程或医学模拟；不使用受保护的机构标志。 |

优先做六类都有可辨认空间、三种可拍构图和稳定操作，再逐个提高细节。不能用六张装饰海报代替六个可编辑片场。

## 与当前代码的差距

读取时，本仓库 `src/core/schema.ts` 的 environment 是 courtyard / studio / exterior；`src/runtime/stage.ts` 将主要布景写在渲染器内。`server/packs.ts` 的 `hengdian-pack/1` 可以保存完整 Project，但不能把一段局部建筑组合独立追加进现有工程。现有实体 ID、四元数、原子事务、快照导出和 GLB 内容寻址值得保留。

因此本轮应把“预设地图”和“运行器几何实现”解耦，避免每增加一个新地点都重复修改核心枚举、MCP schema、前端和服务。旧三个场景需继续能打开，不能静默把历史工程重解释成新布景。

## 建议数据接口

### 三个不同的资源层

- **Catalog entry / 目录条目**：轻量元数据，支持 category、tags、中文名称、英文别名、作者、许可、版本、预览、尺寸与来源；搜索列表不拉完整几何。
- **Assembly / 组合件**：局部原点下的一组实体，可追加、移动、复制；具有锚点和几何包围盒。例如整排课桌、一个街口、一段有门窗的建筑。
- **Scene preset / 场景预设**：环境底座、组合件布局、主演站位及镜头起点构成完整工程。创建时展开为可编辑实体，不要求渲染器认识“医院”这个业务名词。

建议新增独立模块 `src/core/scene-library.ts`；通用几何构件渲染仍由 runtime 负责。新 schema 的版本号、字段名由集成实现确认，下面是设计契约，不是现有可调用 API：

```ts
type SceneAssetDefinition = {
  id: string;
  version: string;
  name: string;
  aliases: string[];
  category: 'landmark' | 'building' | 'rural' | 'urban' | 'classroom' | 'hospital';
  tags: string[];
  source: { kind: 'original' | 'third-party'; url?: string; author: string };
  license: { id: string; evidence?: string; redistributable: boolean | 'unknown' };
  bounds: { min: Vec3; max: Vec3 }; // meters, Y-up
  front: Vec3;                    // default +Z
  pivot: Vec3;                    // ground placement origin
  anchors: { id: string; role: 'entry' | 'actor' | 'camera' | 'seat'; position: Vec3; yaw: number }[];
  assembly: { entities: Entity[] }; // local IDs, no executable scripts
};
```

实施时 `license.redistributable` 只记录来源证据推导的准入状态，不能让上传者随手写 `true` 就冒充许可核验。原创数据可使用项目既有 MIT，第三方维持各自许可。

### 最小操作面

| 接口建议 | 输入与效果 |
| --- | --- |
| `listSceneAssets(query, category)` | 返回目录条目；前端和 Agent 使用同一索引，支持中文“医院”和英文 hospital。 |
| `instantiateAssembly(assetId, version, placement, idPrefix)` | 纯函数，把组合局部坐标展开为一组 `entity.add`；完整重映射 ID 和引用；不直接写文件。 |
| `createScenePreset(presetId)` | 纯函数产生可验证 Project；明确新建/替换与局部追加的语义差别。 |
| 已有 `POST /api/commands` | 一次提交全部展开操作，沿用 `baseRevision`、requestId、撤销和冲突语义。 |
| `inspectPlacement` | 返回包围盒相交和落地提示；先做几何近似，不把它宣传为物理碰撞/可走性求解。 |

一个组合可能有超过 200 个子实体，当前事务上限 200、工程上限 300。首轮设计应控制预算，或加入经验证的组合节点表示；不要把一次用户操作静默拆成多个可能部分失败的事务。通过实例绘制优化的装饰物仍应有可追踪的语义归属；depth/ID 输出要明确组合 ID 还是子对象 ID。

### 确定性与升级

1. 布局、scatter 和道路生成器的输入必须包含 seed、算法版本、参数和尺寸边界。
2. 首版优先把生成后的实体展开写入工程，以保证导出快照完整；以后如保留参数化实例，也要携带锁定版本或烘焙快照。
3. 组合追加时每个实例都得到唯一 ID；引用映射覆盖跟拍、轨道、注释和锚点。
4. 资源版本不可覆盖；默认不在线更新已经在拍的片场。
5. GLB 继续自包含、内容哈希寻址。正式目录增加模型尺寸、枢轴、面数/字节预算；材质、贴图、骨骼不支持时明确报出。
6. 墙、门、路径等若有特殊几何，从允许列表选择声明式结构；资源包不允许任意 JavaScript 或远程模块。

## 交互与验证建议

资源面板分“完整片场”和“组合/道具”。卡片先展示真实缩略图、用途和尺寸，点击后提供“新建片场”或“加入当前片场”，不能同一个按钮有时追加、有时清空。新增组合默认落地并进入选择状态；用户可以沿网格摆放、旋转、复制和展开。搜索词可以是“教室后排”“街角对白”，但命中结果仍需对应具体资产与锚点。

每个新片场至少验证：开箱全景、中景、反打；主演实际移动；镜头首中尾真实画面；工程保存再开；两个相同组合追加不产生 ID 冲突；撤销整次追加；导出后的工程与资源复原。医院、教室尤其要用室内摄影机检查遮挡和穿墙，不能只看俯视布局图。

第一轮可验证完成的目标是：六类原创可拍场景、可追加组合库、可搜索目录、相同操作可由 UI/CLI/MCP 驱动、完整拍摄包可恢复。完整照片级数字城市、全球地标库、复杂人群导航和多后端渲染互通属于后续目标，应分别验证。
