# 开放工程与片场包

真源定义在 `src/core/schema.ts`，服务的 `GET /api/schema` 返回机器可读 JSON Schema。离线定义见 [工程 JSON Schema](../schemas/project.schema.json)、[事务 JSON Schema](../schemas/transaction.schema.json) 和 [资源包 JSON Schema](../schemas/pack.schema.json)。这些文件由 `npm run schema` 生成，`npm run check` 会阻止定义漂移；跨对象引用与时间关系仍需运行核心验证。当前 schemaVersion 是 `hengdian/1`；不支持的版本显式拒绝。

## 坐标与时间

右手系，Y 轴向上，距离单位为米。基础对象枢轴在地面中心，GLB 保留源文件枢轴/单位/朝向，不猜测归一化。位置为 XYZ，旋转为归一化四元数 XYZW，缩放为三个正数。镜头局部时间以秒计，帧号对应 frame / fps。导出帧数 round(duration × fps)，不额外包含结束帧。

对象是共享空间中的实体；镜头 tracks 是局部覆盖。无关键帧时使用对象基础姿态；首帧之前保持首关键帧、末帧之后保持末关键帧。位置和缩放线性插值，四元数走最短弧球面插值。初次添加非零关键帧时，调用方应同时添加时间 0 的基础姿态。

程序化演员的摆臂摆腿只是走位预演：按当前水平移动区间和距离求值，静止区间、第一帧之前和到达之后回到站姿；重复或倒序采样得到相同画面。站姿脚底位于地面原点。它没有足部 IK、地面碰撞或真实步态；需要接触精度时应使用适当的角色动画与渲染器。

摄影机 from/to 在镜头时长内线性移动；target/targetEnd 同理。follow 指向实体稳定 ID，启用后看向实体原点上方 1.1 米。摄影机滚转、任意多段相机曲线和物理镜头模型尚未实现。GLB 默认播放第一个烘焙动画，当前没有片段选择与动作重定向。

## 操作

`POST /api/commands` 接收 requestId、baseRevision、label、operations。操作包括 project.update、entity.add/update/remove、shot.add/update/remove、key.set/remove、note.add/remove。

每次读取工程得到 revision。编辑时提交该版本；409 表示需要重新读取、理解变化并重新提出操作。不自动重试覆盖。删除对象清空相关跟拍、轨道并解除批注对象引用；删除镜头同时移除其批注。所有操作先在副本执行并验证，成功后一次提交。

requestId 在最近 50 次已接收事务内幂等，相同 ID 与不同内容拒绝。重复请求返回第一次结果，其 revision 可能低于当前版本，因此客户端不可让本地版本倒退。撤销/重做恢复内容但 revision 继续递增。

## 外部片场包

`hengdian-pack/1` 为纯数据包，字段：id、name、description、version（x.y.z）、author、license、project。project 是有效的 hengdian/1 工程，允许选择三种基础环境之一并组合任意支持的实体、GLB 和镜头。包不执行脚本。

`GET /api/packs` 列出内置与安装的版本；`POST /api/packs` 使用 `{ "pack": ... }` 安装；`POST /api/packs/:id/instantiate` 使用 `{ "baseRevision": 0, "version": "1.0.0" }` 载入。外部包如果有多个版本，必须明确版本。相同包版本不能换内容；依赖 GLB 必须先上传。载入工程保存包 ID、版本、清单哈希。

示例见 [桌面产品包](../examples/tabletop.pack.json)。发布者应准确声明模型来源和许可，许可字段是声明而非自动权利认证。模型应为自包含 GLB 2.0；当前不支持需要 Draco/KTX2 等额外解码器的模型。

## 制作交接包

ZIP 包含 project.hengdian.json、motion.mp4、三张参考关键帧、逐帧 camera.json、引用 GLB、manifest.json。开启控制通道后追加同时间采样的 depth/ 与 id/ PNG 序列。

深度为视空间距离的线性 8-bit 灰度，near=0.05、far=200，255 为远平面及背景；它是轻量参考，不适合精密测距。对象 ID 为 RGB 编码整数，0 为背景/布景；manifest 给出 ID 到实体的映射。透明材质在几何控制通道按不透明表面处理。RGB 保持正常材质。模型动画在各通道使用相同时间。

manifest 包含帧数、实际时长、来源工程版本、坐标单位、资产声明、每个输入文件的 SHA-256；不把生成服务的输入兼容性自动等同于控制效果。ZIP 导入在恢复工程前上传所带 GLB。完整控制通道最多 720 帧，避免首版内存打包超出合理范围。

可运行 `npx tsx tools/verify-shooting-pack.ts path/to/pack.zip` 核验交接包。校验器检查文件哈希、实际 MP4 帧数与帧率、逐帧摄影机和工程求值、PNG 通道及对象 ID 映射；需要 FFprobe（可用 `FFPROBE_PATH` 指定）。这些检查不替代构图、遮挡、动作与故事连续性的画面复核。

## Articulated actors and procedural sets

Additive fields keep existing `hengdian/1` documents readable. An `actor` entity may contain `actor: {pose, action, speed, phase}`. Missing `actor` retains the legacy figure; new figures receive a neutral rig. `pose` contains a metre `rootOffset` and a full map of 17 joint XYZ Euler angles in degrees. Joint-specific constraints are discoverable in `/api/catalog.jointDefinitions`; speed is 0–4 cycles/second and phase is 0–1 cycle. These are explicit FK controls, not a physics rig.

`shot.poseTracks[entityId]` contains sorted unique `{time,pose}` keys. A nonempty pose track overrides the entire procedural action for that shot and holds at its endpoints. Pose interpolation is linear within joint limits; unrestricted root angles take the shorter path. Entity transform tracks remain independent, so a walking cycle does not move the actor across the stage by itself.

Transactions add or replace a pose key with `pose.set {shotId,entityId,key}`, and remove one with `pose.remove {shotId,entityId,time}`. Both enforce actor locks; keys must remain within the shot. Removing/converting a rigged actor clears dangling pose tracks. Invalid edits fail atomically. The UI saves the currently evaluated pose, so a key captures what is visible at that instant.

Setpieces use `kind: "setpiece"` and a supported `modelId`; each is one independently editable entity. `environment: "empty"` provides a neutral floor for modular scenes. Model IDs, dimensions, anchors, source and license are catalog metadata, documented in [Asset Library](ASSET-LIBRARY.md). Scene and assembly factories create fresh IDs; reusable assemblies do not create permanent group parents.

`GET /api/catalog` includes `assets`, `assemblies`, `sceneTemplates`, `posePresets` and `jointDefinitions`. `POST /api/scenes/:id/instantiate` takes `{baseRevision}` and replaces the project. `POST /api/assemblies/:id/instantiate` takes `{baseRevision,requestId,position?}` and appends an atomic group; identical request arguments replay idempotently within the Store receipt window. Conflicts require rereading.

The handoff manifest records `hengdian-humanoid/1` and `hengdian-setpieces/1` runtime provenance plus referenced model IDs. Procedural geometry is recreated by the compatible application and is not currently converted into standalone meshes in the ZIP. The project preserves exact pose and model data; future incompatible rig or geometry changes require explicit version migration.

## Semantic parts and appearance images

Optional entity `parts`, entity `referenceIds`, and project `references` add [parts and appearance binding](PARTS.md) to the existing schema. A part groups disjoint actual mesh child-index paths; duplicate node names are harmless. Each path can belong to one part. Reference IDs must exist; deletion clears bindings, and geometry replacement clears stale part definitions. The server validates actual paths before saving. Semantic identity is `(entityId,partId)`, and snapshot manifest maps it to lossless RGB integer values.

Exports with selected parts contain `part-id/` plus per-part `masks/` frame sequences, original `references/` image assets and `references.json` role/binding data. Files share camera/time/resolution; visible-surface occlusion is preserved. Images are content addressed, and their exact original bytes must accompany complete saved projects. See [verification](showcase/PARTS-VERIFICATION.md) for real runtime, host and restore evidence.
