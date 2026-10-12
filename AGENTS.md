# Vibe Coding / BIP 项目规则

先读 `README.md`、`template.config.json` 和 `specs/VISION.md`。本仓库有两种状态：`stage: template` 是可复制模板；`stage: project` 是已初始化项目。不要把空规格当成已确定的需求。

## 初始化与后续开发

用户要「用模板做 XX / 初始化项目」时，使用 `.agents/skills/init-bip-project/SKILL.md`。普通功能开发按已有项目规格执行，不重复初始化；仅审查请求不改文件。其他 AI 若不发现 Skill，也可直接读取该文件。

- README 的 `bip:project` 标记内、项目规格、项目代码、截图、技术栈与运行命令可按实际项目替换。
- `owner: cell` 时，README 的 `bip:creator` 标记内及配置 `cell` 区默认保留；联系与赞助图片不改成项目素材。项目初始化不能顺手改作者介绍、收款码或版权。用户明确更新作者资料时才同步配置与资产。
- 用户明确以其他作者身份使用时，把 `owner` 改为 `custom`，替换作者、联系与赞助区，避免把 Cell 的二维码当成新作者的。未知联系方式留待补充，不虚构。
- `LICENSE` 原 MIT 版权与许可声明按许可要求保留。可增加新作者的版权行；作者推广内容不属于许可证要求。
- 保留两对 README 区域标记，便于后续只更新目标区域。用户给定的身份和边界优先于默认配置。

不预设框架、云厂商或数据库；从最小可运行交付选择技术栈。记录真实实现、验证结果与限制，BIP 记录可选。不要从模板继承不存在的部署、客户、收入或产品承诺。

## 检查与交付

初始化时填写配置的 `project.name`、`project.summary`，置 `stage: project`；确认 README 与规格一致，清除 `{{PROJECT_...}}` 占位符。运行 `python3 scripts/check_template.py --project`，再运行项目实际需要的构建或测试。模板维护使用默认检查及 `python3 -m unittest discover -s tests -v`。

检查脚本只读：作者资产哈希可发现意外替换，但不是安全边界；Markdown 链接检查不验证外站或扫码结果。二维码只能使用真实文件，保留比例和识别边界。凭据放被忽略的本机配置，公开仓库不写私有 Context、密钥或本机路径。

初始化本身不包含发布、部署、推送或修改仓库权限。交付时说明实际修改、验证和剩余问题，按用户本轮授权处理 Git。
