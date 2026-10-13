# 原创场景与组合资源库

本轮资源库包含 30 个原创程序化布景模型、4 个局部组合和5个完整场景模板。它们是用于摆场、走位和摄影机预演的可编辑几何，不是真实地点扫描、照片级资产或通用建筑设计工具。研究来源、许可边界和后续方向见 [场景与资产研究](research/SCENES-ASSETS.md)。

## 三层资源

| 层级 | 用途 | 代码入口 |
| --- | --- | --- |
| 资产目录 Asset library | 单个整体可移动模型，含中英名称、用途、标签、尺寸、来源和许可 | `src/core/library.ts` 的 `assetLibrary` |
| 局部组合 Assembly | 一次加入数个相关对象，保留每个对象的独立身份 | `instantiateAssembly(id, position, rotationYaw)` |
| 完整片场 Scene template | 创建具备布景、演员和三个摄影机起点的工程 | `createSceneTemplate(id)` |

`newSetpiece(modelId, position)` 创建一个 `kind: setpiece` 实体；`modelId` 从 `src/core/model-ids.ts` 的允许列表选择。渲染器调用 `createSetpiece(modelId, color)`，同一个实体可以包含几十个几何零件，但只占一个场内对象 ID。资源数据不执行包内脚本、不从网络加载模型。

全部长度为米、Y向上、默认正面为+Z，模型脚底原点在y=0。`dimensions` 是模型总体尺寸预算，供资产浏览和预估放置使用，不是精确碰撞盒。窗口、门洞是开放几何；楼立面与店面是外观布景，不提供完整可进入室内。`floor-slab` 放在y=-0.1时，其上表面位于y=0。

## 当前清单

| 类别 | 模型 IDs |
| --- | --- |
| 地标 | `eiffel-tower`, `clock-tower` |
| 建筑构件 | `cottage`, `apartment`, `shopfront`, `wall-panel`, `doorway`, `window-wall`, `stairs`, `floor-slab` |
| 街道 | `road-straight`, `sidewalk`, `crosswalk`, `streetlight`, `bollard`, `bus-stop`, `traffic-light` |
| 自然 | `tree`, `fence`, `planter` |
| 教室 | `school-desk`, `blackboard` |
| 医院 | `hospital-bed`, `iv-stand`, `monitor`, `reception` |
| 家具 | `bookshelf`, `bench`, `cafe-table`, `chair` |

埃菲尔铁塔模型是本项目用基础杆件搭建的缩尺近似轮廓，高约6.5米，用于巴黎印象片场；不声称还原真实建筑尺寸或结构。医院监护仪波形是固定装饰，交通灯和路灯为外形道具，不包含医疗数据、交通控制或灯光发射逻辑。

## 组合与片场

| ID | 内容 | 使用注意 |
| --- | --- | --- |
| `classroom-row` | 四套桌椅，中间保留走道 | 学生朝+Z；教室模板整体旋转180°使其朝黑板。 |
| `hospital-bay` | 病床、输液架、监护仪、访客椅 | 组合以病床中心为平面原点，床边锚点是站位提示。 |
| `street-lighting` | 道路两侧六盏路灯 | 灯杆间距5米，组合可整体旋转放置。 |
| `cafe-corner` | 圆桌、相向两把椅子、花池 | 适合店门前、广场和室外对话。 |

五个模板是 `rural-road` 乡村道路、`urban-street` 都市街道、`classroom` 教室、`hospital` 病房和 `paris-plaza` 巴黎印象广场。每个模板创建新的工程和实体 ID，包含三个可继续调整的镜头。乡村道路的第二镜头还包含双人位移、各49个显式行走姿态关键帧与摄影机同速跟拍；其他镜头不继承原地行走。

模板采用 `environment: empty`，布景完全由明确实体组成。室内模板刻意保留前侧/右侧拍摄开口，便于导演；它们不声称是封闭建筑或有碰撞的可漫游数字孪生。开箱镜头需要和具体人物动作一起看图调整，不能把预设机位当成任何主体都适用的保证。

## 程序化使用

```ts
import { newSetpiece, instantiateAssembly, createSceneTemplate } from './src/core/library';

const tower = newSetpiece('clock-tower', [0, 0, -4]);
const bedside = instantiateAssembly('hospital-bay', [2, 0, -2], Math.PI / 2);
const classroom = createSceneTemplate('classroom');
```

以上是纯构建函数，不直接保存工作空间。加入现有工程时，把实体转换为一批 `entity.add` 操作，通过已有版本化事务提交；创建完整模板要使用明确的新建/替换操作。不得悄悄将“加入一个组合”解释为清空当前工程。

组合坐标与四元数围绕组合原点一起变换，每次实例化均产生新 ID。复制两组床位不会共享可变坐标或覆盖另一组；更新某张椅子也不自动改变未来模板。原始来源和MIT许可写入实体，随工程和拍摄包保留。

## 扩展方法

1. 在 `model-ids.ts` 增加稳定ID，在 `assetLibrary` 增加名称、标签、尺寸、来源、许可与必要锚点。
2. 在 `createSetpiece` 增加原创几何实现，保持默认朝向和地面枢轴；未知ID必须明确失败。
3. 用少量对象组成可复用组合；几何细节留在单个setpiece内，避免突破事务200操作和工程300实体的既有预算。
4. 完整模板只编排实体、演员和镜头；不为每个地名给渲染器再加一段隐藏布景。
5. 运行 `npx vitest run tests/library.test.ts`，再通过实际导演台预览全景/中景/反打，导出并复开工程。

行为测试覆盖重复实例身份隔离、旋转/偏移、引用完整性、尺寸与落地、门洞实际可穿视线以及未知模型拒绝。它们不能代替人的视觉审查或证明所有镜头无碰撞。

当前构件由项目原创代码生成并采用MIT许可。此目录没有内置Kenney、Poly Haven、Quaternius、D5或Twinmotion的模型二进制。未来接入第三方资源须保留具体资产版本和许可证据；“免费使用”不自动表示可以放进可重新分发的场景包。
