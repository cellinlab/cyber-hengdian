import { useI18n, localizeError } from '../i18n';
import type { RefObject } from 'react';
import { recipes, newShot } from '../../core/catalog';
import { uid, type Project, type Entity, type Shot } from '../../core/schema';
import type { Set, InputRef, Command, Modal, Job } from '../types';
import { api, download } from '../api';
import { Icon } from '../Icons';
import { Button, Field, ModalShell } from './Controls';
import { pad } from '../format';

type AppDialogsProps = {
  modal: Modal;
  setModal: Set<Modal>;
  project: Project;
  shot: Shot;
  entity: Entity | undefined;
  time: number;
  selection: string | null;
  command: Command;
  fileRef: InputRef;
  busy: boolean;
  projectRef: RefObject<Project | null>;
  selectShot: (id: string) => void;
  setSelection: Set<string | null>;
  setTime: Set<number>;
  note: string;
  setNote: Set<string>;
  exportSize: 640 | 1280;
  setExportSize: Set<640 | 1280>;
  controls: boolean;
  setControls: Set<boolean>;
  jobs: Job[];
  setJobs: Set<Job[]>;
  setError: Set<string>;
};
export function AppDialogs({
  modal,
  setModal,
  project,
  shot,
  entity,
  time,
  selection,
  command,
  fileRef,
  busy,
  projectRef,
  selectShot,
  setSelection,
  setTime,
  note,
  setNote,
  exportSize,
  setExportSize,
  controls,
  setControls,
  jobs,
  setJobs,
  setError,
}: AppDialogsProps) {
  const { t, catalogText } = useI18n();
  return (
    <>
      {' '}
      {modal === 'project' && (
        <ModalShell title={t('工程设置')} kicker="PROJECT" onClose={() => setModal(null)}>
          <Field
            label={t('工程名称')}
            value={project.name}
            onCommit={(name) => void command([{ type: 'project.update', name }], t('命名工程'))}
          />
          <div className="field-pair">
            <label className="field">
              <span>{t('画幅')}</span>
              <select
                aria-label={t('画幅')}
                value={project.aspect}
                onChange={(e) =>
                  void command(
                    [{ type: 'project.update', aspect: e.target.value as Project['aspect'] }],
                    t('修改画幅'),
                  )
                }
              >
                <option>16:9</option>
                <option>9:16</option>
                <option>1:1</option>
              </select>
            </label>
            <label className="field">
              <span>{t('帧率')}</span>
              <select
                aria-label={t('帧率')}
                value={project.fps}
                onChange={(e) =>
                  void command(
                    [{ type: 'project.update', fps: e.target.value as Project['fps'] }],
                    t('修改帧率'),
                  )
                }
              >
                <option>24</option>
                <option>30</option>
                <option>60</option>
              </select>
            </label>
          </div>
          <p className="helper">
            {t('工程实时保存在本机。JSON 保存可编辑数据；包含模型的完整迁移请导出拍摄包。')}
          </p>
          <div className="modal-actions">
            <Button icon="upload" onClick={() => fileRef.current?.click()}>
              {t('导入 JSON / ZIP')}
            </Button>
            <Button
              icon="download"
              onClick={() => download('project.hengdian.json', JSON.stringify(project, null, 2))}
            >
              {t('下载工程 JSON')}
            </Button>
          </div>
        </ModalShell>
      )}
      {modal === 'recipes' && (
        <ModalShell
          title={t('下一个镜头，怎样讲？')}
          kicker="SHOT RECIPES"
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            {t('配方给你一个起点。每个位置、目标和时长都可以继续调整。')}
          </p>
          <div className="recipe-grid">
            {recipes.map((r, i) => (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => {
                  const s = newShot(r.id, entity?.transform.position ?? [0, 0, 0]);
                  s.name = catalogText(s.name);
                  s.intent = catalogText(s.intent);
                  void command([{ type: 'shot.add', shot: s }], t('添加镜头')).then(() => {
                    if (projectRef.current?.shots.some((x) => x.id === s.id)) {
                      selectShot(s.id);
                      setSelection(null);
                      setModal(null);
                    }
                  });
                }}
              >
                <span>
                  {pad(i + 1)} <Icon name="camera" />
                </span>
                <strong>{catalogText(r.name)}</strong>
                <small>{catalogText(r.note)}</small>
                <Icon name="plus" size={14} />
              </button>
            ))}
          </div>
        </ModalShell>
      )}
      {modal === 'connect' && (
        <ModalShell
          title={t('让 Agent 加入片场')}
          kicker="ONE PROJECT. MANY DIRECTORS."
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            {t(
              '人和 Agent 操作同一份工程。服务通过版本检查保护修改，任何宿主都不拥有第二份场景真源。',
            )}
          </p>
          <div className="connection-status">
            <span className="live-dot" />
            <span>{t('本地工程服务')}</span>
            <code>{location.origin}</code>
          </div>
          <h3>{t('通过 MCP 接入')}</h3>
          <p className="helper">
            {t(
              '在支持 stdio MCP 的客户端中配置以下启动命令。将路径替换为本机仓库绝对路径，并保持导演台服务运行。',
            )}
          </p>
          <pre>
            {JSON.stringify(
              {
                command: 'npm',
                args: ['--silent', '--prefix', '/absolute/path/cyber-hengdian', 'run', 'mcp', '--'],
                env: { HENGDIAN_URL: location.origin },
              },
              null,
              2,
            )}
          </pre>
          <h3>{t('也可以直接使用 CLI')}</h3>
          <pre>npm run cli -- inspect</pre>
          <p className="helper">
            {t(
              'Codex / DeepSeek Harness 的配置入口各不相同，请参考仓库接入文档。显示此说明不代表已连接或已完成真实宿主测试。视觉输入能力由宿主与模型决定。',
            )}
          </p>
        </ModalShell>
      )}
      {modal === 'notes' && (
        <ModalShell
          title={t('把想法留在这一刻')}
          kicker="DIRECTOR’S NOTES"
          onClose={() => setModal(null)}
        >
          <div className="note-context">
            <Icon name="camera" />
            {shot.name}
            <span>{time.toFixed(2)}s</span>
            {entity && <span>{entity.name}</span>}
          </div>
          <textarea
            aria-label={t('批注内容')}
            placeholder={t('这里停顿一下，让观众先看到主角的反应…')}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            className="primary wide"
            icon="plus"
            disabled={!note.trim() || busy}
            onClick={() =>
              void command(
                [
                  {
                    type: 'note.add',
                    note: {
                      id: uid(),
                      shotId: shot.id,
                      entityId: selection,
                      time,
                      text: note.trim(),
                    },
                  },
                ],
                t('添加批注'),
              ).then((saved) => {
                if (saved) setNote('');
              })
            }
          >
            {t('保存到当前时刻')}
          </Button>
          <div className="notes-list">
            {project.notes.length ? (
              project.notes.map((n) => (
                <article key={n.id}>
                  <header>
                    <button
                      onClick={() => {
                        selectShot(n.shotId);
                        setTime(n.time);
                        setSelection(n.entityId);
                        setModal(null);
                      }}
                    >
                      {project.shots.find((s) => s.id === n.shotId)?.name} · {n.time.toFixed(2)}s
                    </button>
                    <Button
                      icon="trash"
                      aria-label={t('删除批注')}
                      onClick={() =>
                        void command([{ type: 'note.remove', id: n.id }], t('删除批注'))
                      }
                    />
                  </header>
                  <p>{n.text}</p>
                </article>
              ))
            ) : (
              <p className="empty">{t('批注会带着镜头、对象和时间一起保存。')}</p>
            )}
          </div>
        </ModalShell>
      )}
      {modal === 'export' && (
        <ModalShell
          title={t('把这个镜头带走')}
          kicker="PRODUCTION HANDOFF"
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            {t('逐帧渲染当前镜头。拍摄包包含 MP4、关键画面、摄影机数据和可重开的完整工程。')}
          </p>
          <div className="export-summary">
            <Icon name="film" size={26} />
            <div>
              <strong>{shot.name}</strong>
              <small>
                {shot.duration.toFixed(1)} {t('秒 ·')}
                {project.fps} FPS · {project.aspect} · r{project.revision}
              </small>
            </div>
          </div>
          <label className="field">
            <span>{t('画面长边')}</span>
            <select
              aria-label={t('导出分辨率')}
              value={exportSize}
              onChange={(e) => setExportSize(Number(e.target.value) as 640 | 1280)}
            >
              <option value={1280}>{t('1280 px · 制作参考')}</option>
              <option value={640}>{t('640 px · 快速检查')}</option>
            </select>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={controls}
              onChange={(e) => setControls(e.target.checked)}
            />
            <span>
              {t('附加深度和对象 ID 序列')}
              <small>{t('用于明确支持这些输入的工作流，会增加体积与耗时。')}</small>
            </span>
          </label>
          <Button
            className="primary wide"
            icon="download"
            disabled={busy || jobs.some((j) => j.status === 'running' || j.status === 'queued')}
            onClick={async () => {
              setError('');
              try {
                const j = await api<Job>('exports', {
                  baseRevision: project.revision,
                  shotId: shot.id,
                  size: exportSize,
                  controls,
                });
                setJobs((old) => [j, ...old]);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            {t('开始导出拍摄包')}
          </Button>
          <p className="helper">
            {t(
              '需要本机 Chrome / Chromium 和 FFmpeg。导出使用开始时的工程快照，期间可以继续编辑。',
            )}
          </p>
          <div className="export-jobs">
            {jobs.map((j) => (
              <article key={j.id}>
                <div>
                  <strong>
                    {project.shots.find((s) => s.id === j.shotId)?.name ?? t('历史镜头')}
                  </strong>
                  <span>
                    {
                      (
                        {
                          queued: t('排队中'),
                          running: t('逐帧渲染中'),
                          complete: t('已完成'),
                          failed: t('导出失败'),
                          cancelled: t('已取消'),
                        } as const
                      )[j.status]
                    }{' '}
                    · r{j.revision}
                  </span>
                </div>
                {(j.status === 'running' || j.status === 'queued') && (
                  <>
                    <progress aria-label={t('导出进度')} max={100} value={j.progress} />
                    <Button
                      onClick={async () => {
                        try {
                          await api(`exports/${j.id}/cancel`, {});
                          setJobs(await api<Job[]>('exports'));
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      {t('取消')}
                    </Button>
                  </>
                )}
                {j.status === 'complete' && (
                  <a className="download-link" href={`/api/exports/${j.id}/download`}>
                    <Icon name="download" /> {t('下载 ZIP')}
                  </a>
                )}
                {j.error && <p className="job-error">{localizeError(j.error)}</p>}
              </article>
            ))}
          </div>
        </ModalShell>
      )}
    </>
  );
}
