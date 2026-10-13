# 开放工程与片场包

真源定义在 `src/core/schema.ts`，服务的 `GET /api/schema` 返回机器可读 JSON Schema。当前 schemaVersion 是 `hengdian/1`；不支持的版本显式拒绝。

## 坐标与时间

右手系，Y 轴向上，距离单位为米。基础对象枢轴在地面中心，GLB 保留源文件枢轴/单位/朝向，不猜测归一化。位置为 XYZ，旋转为归一化四元数 XYZW，缩放为三个正数。镜头局部时间以秒计，帧号对应 frame / fps。导出帧数 round(duration × fps)，不额外包含结束帧。

对象是共享空间中的实体；镜头 tracks 是局部覆盖。无关键帧时使用对象基础姿态；首帧之前保持首关键帧、末帧之后保持末关键帧。位置和缩放线性插值，四元数走最短弧球面插值。初次添加非零关键帧时，调用方应同时添加时间 0 的基础姿态。

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
