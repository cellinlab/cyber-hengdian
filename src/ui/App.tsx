import { useI18n, LanguageSelector, localizeError } from './i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { unzipSync, strFromU8 } from 'fflate';
import { packs, newEntity } from '../core/catalog';
import { evaluate } from '../core/project';
import {
  uid,
  projectSchema,
  type Project,
  type Entity,
  type Operation,
  type Transform,
  type Shot,
} from '../core/schema';
import { api } from './api';
import { Viewport } from './Viewport';
import { Button } from './components/Controls';
import { LibraryPanel } from './components/LibraryPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { Timeline } from './components/Timeline';
import { AppDialogs } from './components/AppDialogs';
import type { History, PackInfo, Job, Modal } from './types';
export function App() {
  const { t, catalogText, locale } = useI18n();
  const [project, setProject] = useState<Project | null>(null),
    projectRef = useRef<Project | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [shotId, setShotId] = useState(''),
    [selection, setSelection] = useState<string | null>(null),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<'stage' | 'camera'>('camera'),
    [tool, setTool] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [snap, setSnap] = useState(0);
  const [partSelection, setPartSelection] = useState<string | null>(null);
  const [displayPass, setDisplayPass] = useState<'beauty' | 'highlight' | 'part-id' | 'mask'>(
    'beauty',
  );
  useEffect(() => {
    if (
      !project?.entities.find((e) => e.id === selection)?.parts?.some((p) => p.id === partSelection)
    ) {
      setPartSelection(null);
      setDisplayPass('beauty');
    }
  }, [project, selection, partSelection]);
  const [tab, setTab] = useState<'assets' | 'objects'>('assets'),
    [mobilePanel, setMobilePanel] = useState<'assets' | 'inspect' | null>(null);
  const [modal, setModal] = useState<Modal>(null),
    [error, setError] = useState(''),
    [status, setStatus] = useState('正在连接'),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<History>({ canUndo: false, canRedo: false });
  const [installedPacks, setInstalledPacks] = useState<PackInfo[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]),
    [exportSize, setExportSize] = useState<640 | 1280>(1280),
    [controls, setControls] = useState(false),
    [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null),
    modelRef = useRef<HTMLInputElement>(null),
    replaceModelRef = useRef<HTMLInputElement>(null);
  const accept = useCallback((p: Project) => {
    if (projectRef.current && p.revision < projectRef.current.revision) return;
    projectRef.current = p;
    setProject(p);
    setShotId((id) => (p.shots.some((s) => s.id === id) ? id : p.shots[0].id));
    setSelection((id) => (p.entities.some((e) => e.id === id) ? id : null));
    setStatus('已保存到本地');
    void api<History>('history')
      .then(setHistory)
      .catch(() => {});
    void api<PackInfo[]>('packs')
      .then((p) => setInstalledPacks(p.filter((x) => !x.builtin)))
      .catch(() => {});
  }, []);
  const refresh = useCallback(async () => {
    accept(await api<Project>('project'));
  }, [accept]);
  useEffect(() => {
    void refresh().catch((e) => {
      setError(e.message);
      setStatus('连接失败');
    });
    const events = new EventSource('/api/events');
    events.onmessage = () =>
      void refresh().catch((e) => {
        setStatus('同步中断');
        setError(e.message);
      });
    events.onerror = () => setStatus('连接中断 · 正在重连');
    events.onopen = () => setStatus('已连接本地服务');
    return () => events.close();
  }, [refresh]);
  const perform = async (action: () => Promise<Project>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatus('正在保存…');
    try {
      accept(await action());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('修改未保存');
      try {
        await refresh();
      } catch {
        /* keep the actionable original error */
      }
      setStatus('修改未应用');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const command = (
    operations: Operation[],
    label: string,
    revision = projectRef.current!.revision,
  ) =>
    perform(() =>
      api<Project>('commands', { requestId: uid(), baseRevision: revision, label, operations }),
    );
  const shot = project?.shots.find((s) => s.id === shotId) ?? project?.shots[0];
  const entity = project?.entities.find((e) => e.id === selection);
  const sampled =
    project && shot
      ? evaluate(project, shot, time).entities.find((e) => e.id === selection)
      : undefined;
  useEffect(() => {
    if (shot) setTime((t) => Math.min(t, shot.duration));
  }, [shot?.duration, shotId]);
  useEffect(() => {
    if (!playing || !shot) return;
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const dt = (now - previous) / 1000;
      previous = now;
      setTime((t) => {
        const next = t + dt;
        if (next >= shot.duration) {
          setPlaying(false);
          return shot.duration;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, shot?.id, shot?.duration]);
  useEffect(() => {
    if (modal !== 'export') return;
    const poll = () =>
      void api<Job[]>('exports')
        .then(setJobs)
        .catch((e) => setError(e.message));
    poll();
    const timer = setInterval(poll, 1200);
    return () => clearInterval(timer);
  }, [modal]);
  const transform = (id: string, value: Transform, revision: number) => {
    if (!project || !shot) return;
    const target = project.entities.find((e) => e.id === id);
    if (!target) return;
    const hasKeys = !!shot.tracks[id]?.length;
    const ops: Operation[] = [];
    if (time > 0 || hasKeys) {
      if (!hasKeys && time > 0)
        ops.push({
          type: 'key.set',
          shotId: shot.id,
          entityId: id,
          key: { ...target.transform, time: 0 },
        });
      ops.push({
        type: 'key.set',
        shotId: shot.id,
        entityId: id,
        key: {
          ...value,
          time: Math.min(
            shot.duration,
            Math.round(time * Number(project.fps)) / Number(project.fps),
          ),
        },
      });
    } else ops.push({ type: 'entity.update', id, changes: { transform: value } });
    void command(ops, t('调整 ') + target.name, revision);
  };
  const editShot = (changes: Partial<Omit<Shot, 'id' | 'tracks'>>) => {
    if (shot) void command([{ type: 'shot.update', id: shot.id, changes }], t('修改镜头'));
  };
  const selectShot = (id: string) => {
    setShotId(id);
    setTime(0);
    setPlaying(false);
  };
  const addObject = (kind: Entity['kind']) => {
    const e = newEntity(kind);
    e.name = catalogText(e.name);
    void command([{ type: 'entity.add', entity: e }], t('加入 ') + e.name).then(() => {
      if (projectRef.current?.entities.some((x) => x.id === e.id)) {
        setSelection(e.id);
        setTab('objects');
        setMode('stage');
      }
    });
  };
  const duplicate = () => {
    if (!entity) return;
    const copy = structuredClone(entity);
    copy.id = uid();
    copy.name += t(' 副本');
    copy.locked = false;
    copy.transform = structuredClone(sampled?.transform ?? entity.transform);
    copy.transform.position[0] += 0.7;
    void command([{ type: 'entity.add', entity: copy }], t('复制对象')).then(() =>
      setSelection(copy.id),
    );
  };
  const uploadAsset = async (bytes: Uint8Array | File) => {
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'model/gltf-binary' },
      body: bytes instanceof File ? bytes : new Blob([bytes as Uint8Array<ArrayBuffer>]),
    });
    const data = await res.json();
    if (!res.ok) throw Error(data.error || t('模型上传失败'));
    return data.asset as string;
  };
  const importProject = async (file: File) => {
    if (
      !project ||
      !window.confirm(t('导入会替换当前工程。已有修改已保存，导入后可用撤销恢复。继续导入？'))
    )
      return;
    const revision = project.revision;
    await perform(async () => {
      let p: Project;
      if (file.name.toLowerCase().endsWith('.zip')) {
        const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
        const json = files['project.hengdian.json'];
        if (!json) throw Error(t('工程包中缺少 project.hengdian.json'));
        p = projectSchema.parse(JSON.parse(strFromU8(json)));
        for (const asset of new Set(p.entities.map((e) => e.asset).filter(Boolean))) {
          const bytes = files['assets/' + asset];
          if (!bytes) throw Error(t('工程包缺少模型：') + asset);
          if ((await uploadAsset(bytes)) !== asset) throw Error(t('模型内容与工程引用不一致'));
        }
        for (const reference of p.references ?? []) {
          const bytes = files['references/' + reference.asset];
          if (!bytes) throw Error(t('工程包缺少参考图：') + reference.asset);
          const mime = reference.asset.endsWith('.png')
            ? 'image/png'
            : reference.asset.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
          const response = await fetch('/api/references', {
            method: 'POST',
            headers: { 'Content-Type': mime },
            body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
          });
          const uploaded = await response.json();
          if (!response.ok) throw Error(uploaded.error || t('参考图上传失败'));
          if (uploaded.asset !== reference.asset) throw Error(t('参考图内容与工程引用不一致'));
        }
      } else {
        const parsed = JSON.parse(await file.text());
        if (parsed.schemaVersion === 'hengdian-pack/1') {
          const installed = await api<{ id: string; version: string }>('packs', { pack: parsed });
          return api<Project>(`packs/${encodeURIComponent(installed.id)}/instantiate`, {
            baseRevision: revision,
            version: installed.version,
          });
        }
        p = projectSchema.parse(parsed);
      }
      return api<Project>('import', { project: p, baseRevision: revision });
    });
    setTime(0);
    setPlaying(false);
  };
  const importModel = async (file: File, replaceId?: string) => {
    if (!project) return;
    const revision = project.revision;
    await perform(async () => {
      const asset = await uploadAsset(file);
      const e: Entity = {
        ...newEntity('glb'),
        name: file.name.replace(/\.glb$/i, '').slice(0, 160) || t('导入模型'),
        asset,
        source: file.name,
      };
      const result = await api<Project>('commands', {
        requestId: uid(),
        baseRevision: revision,
        label: t('导入模型'),
        operations: [
          replaceId
            ? {
                type: 'entity.update',
                id: replaceId,
                changes: { kind: 'glb', asset, source: file.name, license: '' },
              }
            : { type: 'entity.add', entity: e },
        ],
      });
      setSelection(replaceId ?? e.id);
      setTab('objects');
      setMode('stage');
      return result;
    });
  };
  if (!project || !shot)
    return (
      <main className="boot">
        <div className="brand-mark">H</div>
        <h1>{t('赛博横店')}</h1>
        <LanguageSelector />
        <p>{localizeError(error) || t('准备你的下一场拍摄…')}</p>
        {error && (
          <Button icon="rotate" onClick={() => void refresh().catch((e) => setError(e.message))}>
            {t('重新连接')}
          </Button>
        )}
      </main>
    );
  const selectedKeys = selection ? (shot.tracks[selection] ?? []) : [];
  const setTransform = (change: Partial<Transform>) => {
    if (sampled) transform(sampled.id, { ...sampled.transform, ...change }, project.revision);
  };
  const currentPack = packs.find((p) => p.id === project.environment) ?? { name: t('自定义片场') };
  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="/" aria-label={t('赛博横店首页')}>
          <span className="brand-mark">H</span>
          <span>
            {t('赛博横店')}
            <small>{locale === 'en' ? 'OPEN VIRTUAL PRODUCTION' : 'CYBER HENGDIAN'}</small>
          </span>
        </a>
        <span className="top-divider" />
        <button className="project-title" onClick={() => setModal('project')}>
          <span>{project.name}</span>
          <small>
            {t('本地工程')}
            <span>⌄</span>
          </small>
        </button>
        <div className="save-state" aria-live="polite">
          <span className={busy ? 'saving-dot' : 'live-dot'} />
          {catalogText(status)}
          <span className="revision">r{project.revision}</span>
        </div>
        <nav className="top-actions">
          <Button
            icon="undo"
            aria-label={t('撤销')}
            title={t('撤销')}
            disabled={!history.canUndo || busy}
            onClick={() =>
              void perform(() => api<Project>('history/undo', { baseRevision: project.revision }))
            }
          />
          <Button
            icon="redo"
            aria-label={t('重做')}
            title={t('重做')}
            disabled={!history.canRedo || busy}
            onClick={() =>
              void perform(() => api<Project>('history/redo', { baseRevision: project.revision }))
            }
          />
          <span className="top-divider" />
          <Button icon="link" aria-label={t('连接 Agent')} onClick={() => setModal('connect')}>
            <span className="hide-small">{t('连接 Agent')}</span>
          </Button>
          <Button
            className="primary"
            icon="download"
            aria-label={t('导出拍摄包')}
            onClick={() => setModal('export')}
          >
            {t('导出')}
            <span className="hide-small">{t('拍摄包')}</span>
          </Button>
          <LanguageSelector />
        </nav>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <span>{localizeError(error)}</span>
          <Button icon="close" aria-label={t('关闭错误提示')} onClick={() => setError('')} />
        </div>
      )}
      <div className="mobile-tabs">
        <Button
          icon="layers"
          active={mobilePanel === 'assets'}
          onClick={() => setMobilePanel(mobilePanel === 'assets' ? null : 'assets')}
        >
          {t('资源')}
        </Button>
        <span>{t('导演工作台')}</span>
        <Button
          icon="move"
          active={mobilePanel === 'inspect'}
          onClick={() => setMobilePanel(mobilePanel === 'inspect' ? null : 'inspect')}
        >
          {t('检查器')}
        </Button>
      </div>
      <div className="workbody">
        <LibraryPanel
          {...{
            project,
            mobilePanel,
            tab,
            setTab,
            currentPack,
            installedPacks,
            busy,
            perform,
            command,
            setTime,
            setPlaying,
            addObject,
            modelRef,
            fileRef,
            selection,
            setSelection,
            setMobilePanel,
          }}
        />{' '}
        <section className="stage-area" aria-label={t('导演画面')}>
          <div className="stage-toolbar">
            <div className="segmented">
              <Button icon="camera" active={mode === 'camera'} onClick={() => setMode('camera')}>
                {t('摄影机')}
              </Button>
              <Button icon="cube" active={mode === 'stage'} onClick={() => setMode('stage')}>
                {t('自由布置')}
              </Button>
            </div>
            <div className="stage-toolset">
              {(['translate', 'rotate', 'scale'] as const).map((toolName, i) => (
                <Button
                  key={toolName}
                  icon={(['move', 'rotate', 'scale'] as const)[i]}
                  active={mode === 'stage' && tool === toolName}
                  title={[t('移动'), t('旋转'), t('缩放')][i]}
                  aria-label={[t('移动对象'), t('旋转对象'), t('缩放对象')][i]}
                  onClick={() => {
                    setTool(toolName);
                    setMode('stage');
                  }}
                />
              ))}
            </div>
            <select
              className="snap-selector"
              aria-label={t('网格吸附')}
              title={t('网格吸附')}
              value={snap}
              onChange={(event) => setSnap(Number(event.target.value))}
            >
              <option value={0}>{t('不吸附')}</option>
              <option value={0.1}>0.1 m</option>
              <option value={0.5}>0.5 m</option>
              <option value={1}>1 m</option>
            </select>
            <Button
              className="notes-button"
              icon="note"
              aria-label={t('批注')}
              onClick={() => setModal('notes')}
            >
              {t('批注')}
              <span>{project.notes.length}</span>
            </Button>
          </div>
          <Viewport
            onThumbnails={(images, revision) => {
              if (revision === projectRef.current?.revision) setThumbnails(images);
            }}
            project={project}
            shot={shot}
            time={time}
            selection={selection}
            mode={mode}
            tool={tool}
            snap={snap}
            displayPass={displayPass}
            partSelection={partSelection}
            onSelect={(id) => {
              setSelection(id);
              if (id) setTab('objects');
            }}
            onTransform={transform}
            onCapture={(position, target) =>
              editShot({ camera: { ...shot.camera, from: position, target } })
            }
          />
          <div className="stage-caption">
            <span>
              <i /> {catalogText(currentPack.name)} <span className="muted">/</span> {shot.name}
            </span>
            <span>
              {selection ? t('已选择 {p0}', { p0: entity?.name ?? '' }) : t('先选对象，再编排动作')}
            </span>
          </div>
        </section>
        <InspectorPanel
          {...{
            project,
            shot,
            entity,
            sampled,
            mobilePanel,
            setSelection,
            command,
            replaceModelRef,
            busy,
            duplicate,
            time,
            selectedKeys,
            setTransform,
            setTime,
            setPlaying,
            editShot,
            partSelection,
            setPartSelection,
            displayPass,
            setDisplayPass,
          }}
        />
      </div>
      <Timeline
        {...{
          project,
          shot,
          entity,
          time,
          playing,
          setPlaying,
          setTime,
          setModal,
          selectShot,
          setSelection,
          selectedKeys,
          thumbnails,
        }}
      />
      <input
        ref={fileRef}
        className="hidden-input"
        type="file"
        accept=".json,.zip"
        aria-label={t('导入工程文件')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importProject(f);
          e.target.value = '';
        }}
      />
      <input
        ref={modelRef}
        className="hidden-input"
        type="file"
        accept=".glb"
        aria-label={t('导入 GLB 模型')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importModel(f);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceModelRef}
        className="hidden-input"
        type="file"
        accept=".glb"
        aria-label={t('替换 GLB 模型')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && selection) void importModel(f, selection);
          e.target.value = '';
        }}
      />
      <AppDialogs
        {...{
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
        }}
      />{' '}
    </main>
  );
}
