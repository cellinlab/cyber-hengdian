请在指定的赛博横店测试服务中用 MCP 完成三部件卡车的外观绑定交接。本次授权修改部件备注、添加并绑定参考图记录、渲染预览；不要改变对象布局、颜色、镜头、部件网格或删除任何对象。不要调用外部视频生成，不需要导出。

先 read_project、inspect_meshes(entityId=truck-case)，必要时get_schema只取operation。已有车头、车厢、车轮，车头已经绑定一张真实保存的AI生成外观图。复用它的asset内容哈希，为车厢和车轮各注册一条用途明确的外观参考记录，再分别绑定到对应部件。车厢参考银灰瓦楞金属材质；车轮参考黑色真实橡胶。两条记录可引用同一张原图，但用途必须不同。车轮参考只用于外观，保留白模三轴结构，不照搬参考图的两轴数量。为三个部件写清保持独立轮廓、只转译外观的note。保持既有车头绑定。

用一次原子事务写入，读取最新revision，不重试过期数据。随后 preview_shot 检查 truck-orbit 镜头1秒的 part-id 和 cab/cargo/wheels 的mask（selection填entityId和partId）。看真实图确认各部件分开、路灯遮挡是黑色而非白色补全。最后 read_project/inspect_project 回读，说明实际完成和当前遮罩不保证生成模型“锁死结构”的边界。
