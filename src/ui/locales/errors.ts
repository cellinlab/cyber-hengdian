/** Local service errors. Keep original details for unknown third-party errors. */
export const errorMessages: Record<string, string> = {
  '工程已更新，请重新读取': 'The project changed. Read the current revision before editing.',
  '工程已更新，请刷新后导出': 'The project changed. Refresh before exporting.',
  'requestId 已用于其他内容': 'This requestId was already used for different content.',
  没有可恢复的历史: 'There is no history to restore.',
  对象不存在: 'Object not found.',
  镜头不存在: 'Shot not found.',
  对象已锁定: 'The object is locked.',
  至少保留一个镜头: 'Keep at least one shot.',
  任务不存在: 'Export job not found.',
  已有导出任务进行中: 'An export is already in progress.',
  '首版完整控制通道最多 720 帧，请缩短镜头或降低帧率':
    'Control channels support up to 720 frames. Shorten the shot or lower the frame rate.',
  '需要有效的自包含 GLB 2.0 文件（最多 50 MB）':
    'Provide a valid self-contained GLB 2.0 file (up to 50 MB).',
  '无效 GLB JSON 区块': 'Invalid GLB JSON chunk.',
  '请先把外部图片和缓冲区嵌入 GLB': 'Embed external images and buffers into the GLB first.',
  '模型包含当前运行器不支持的必需扩展；请导出未压缩 GLB':
    'This model requires unsupported extensions. Export an uncompressed GLB.',
  不能覆盖内置片场: 'Built-in sets cannot be overwritten.',
  '相同资源包版本内容不同，请升级版本号':
    'This pack version already has different content. Increase the version number.',
  内置片场版本不匹配: 'Built-in set version mismatch.',
  请选择唯一片场版本: 'Select one specific set version.',
  模型资产不存在: 'Model asset not found.',
  预览时间超出镜头: 'Preview time is outside the shot.',
  '预览队列已满（最多 4 张），请等待已有预览完成':
    'The preview queue is full (4 images). Wait for current previews to finish.',
};
