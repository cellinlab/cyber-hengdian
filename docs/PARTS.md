# 部件与外观参考 / Parts and appearance references

选择对象，在检查器打开“部件与参考”。三部件卡车在模型库中，可直接开始；导入的 GLB 也能用同一流程标记部件。

## 标记与检查

点击“读取网格节点”，勾选实际网格并命名部件，保存。节点使用模型层级的子索引路径；即使两个节点同名，也能分别选择。每个网格只能属于一个部件。同一个部件可包含多个网格，例如四个轮胎和轮毂归为“车轮”。这属于手动语义分组，不能自动把单个未拆分网格分成车头与车厢。

卡车包含车头、车厢、车轮三组，共15个网格。选择部件后可切换正常画面、高亮、彩色部件ID和黑白遮罩。未标记几何在ID通道为黑色；遮挡物在遮罩里也为黑色，仍遮住后面的白色部件。导出的是可见表面，不补全被挡住的轮廓。

部件身份由对象ID与部件ID共同组成，名称可修改。复制对象产生新的对象身份，保留部件选择路径。更换模型资产或对象类型会清除原来不再适用的部件定义；已有姿态和对象ID规则保持兼容。

## 绑定外观参考

选择一个部件，填写外观描述、来源和许可，再上传 PNG、JPEG 或 WebP（最大10MB、静态图片、最多约1600万像素）。服务实际解码后按原始字节哈希保存。注册与绑定通过一次版本化事务完成。也可以把已有参考图绑定到其他部件或整个对象。

图片说明外观、服装、颜色与材质；白模与遮罩说明空间、运动及部件边界。下游模型必须实际支持对应输入才能使用区域遮罩，不能把所有参考图都当作强制几何约束。上传图片和生成成片是不同步骤。

删除参考记录会解除所有绑定；图片文件按内容寻址留在本地，以便撤销或恢复旧工程。仅删除一个部件不会删除其他部件共用的参考图。

## 导出与恢复

导出弹窗在“部件遮罩序列”中勾选需要的部件。每次最多16个、最多720帧。工程与RGB视频始终包含；深度/对象ID另按原选项启用。部件模式增加：

- `part-id/000000.png` 等无损24-bit RGB整数ID帧。
- `masks/<entityId>/<partId>/000000.png` 等严格黑白遮罩。
- `references/<hash>.png|jpg|webp` 原始外观图。
- `references.json` 图片用途、对象/部件绑定和部件备注。
- manifest 中的部件颜色/整数映射、遮罩选择、帧路径和参考图元数据。

这些通道与RGB按相同摄影机、时间和分辨率求值。不能把有损MP4/JPEG当作原始ID数据，也不应根据截图采样反推精确ID。参考图不因导出而自动重绘或修改。

在其他本地工作空间导入 ZIP，UI 检查图片文件、内容哈希并上传资产，然后恢复工程。缺失或错配图片会报错，不替换当前工程。内置卡车依赖兼容的程序化运行时重建；外部GLB会包含在拍摄包中。

## API、CLI 与 MCP

数据格式是原 `hengdian/1` 的可选字段扩展：

```ts
entity.parts = [{ id, name, members: ['0/0', '0/1'], referenceIds: ['image-id'], note: 'Red cab' }];
entity.referenceIds = ['whole-object-image'];
project.references = [{ id, name, asset: '<sha256>.png', purpose: 'appearance', description, source, license }];
```

用 `part.set` 保存或替换部件，`part.remove` 删除部件；`reference.add` 注册上传图，`reference.remove` 删除记录；`entity.update` 更新整个对象的 `referenceIds`。部件编辑遵守对象锁定和 revision 冲突检查。无效网格路径在保存前由真实运行时拒绝。

- `POST /api/nodes {entityId}`：返回实际网格路径与所观察到的 revision。
- `POST /api/references`：按 image/png、image/jpeg 或 image/webp 上传原始字节。
- `POST /api/preview {shotId,time,pass,selection?}`：pass 可用 `rgb`、`part-id`、`mask`、`highlight`；selection 是 `{entityId,partId}`。
- `POST /api/exports {...,parts?:[{entityId,partId}]}`：创建异步拍摄包任务，完成后才能下载。

```sh
npm run cli -- nodes ENTITY_ID
npm run cli -- upload-reference /absolute/path/appearance.png
npm run cli -- preview --shot SHOT_ID --pass mask --entity ENTITY_ID --part PART_ID --out cab.png
npm run cli -- export SHOT_ID --base-revision 5 --controls --parts selections.json
```

MCP 使用 `inspect_meshes`、`upload_reference`、`apply_operations`、`preview_shot` 和 `create_export`。上传本机图片须提供明确的绝对路径；上传返回值只是资产信息，绑定仍需公开事务。详见 [Agent 指南](AGENTS.md)。

## 边界

透明、景深与运动模糊尚不参与覆盖计算；控制通道把几何作为不透明表面处理。没有 Cryptomatte EXR、自动面片分割或下游生成服务直连。稳定身份颜色采用哈希及碰撞处理，manifest始终是该快照的权威对应关系。最重要的验收是遮罩与ID的逐像素对应、实际遮挡和导入恢复，而不是文件数量。
