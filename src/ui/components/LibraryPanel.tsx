import { packs, props } from '../../core/catalog';
import type { Project, Entity } from '../../core/schema';
import type { Set, InputRef, Perform, PackInfo } from '../types';
import { api } from '../api';
import { Icon } from '../Icons';
import { Button } from './Controls';

type LibraryPanelProps = {
  project: Project;
  mobilePanel: 'assets' | 'inspect' | null;
  tab: 'assets' | 'objects';
  setTab: Set<'assets' | 'objects'>;
  currentPack: { name: string };
  installedPacks: PackInfo[];
  busy: boolean;
  perform: Perform;
  setTime: Set<number>;
  setPlaying: Set<boolean>;
  addObject: (kind: Entity['kind']) => void;
  modelRef: InputRef;
  fileRef: InputRef;
  selection: string | null;
  setSelection: Set<string | null>;
  setMobilePanel: Set<'assets' | 'inspect' | null>;
};
export function LibraryPanel({
  project,
  mobilePanel,
  tab,
  setTab,
  currentPack,
  installedPacks,
  busy,
  perform,
  setTime,
  setPlaying,
  addObject,
  modelRef,
  fileRef,
  selection,
  setSelection,
  setMobilePanel,
}: LibraryPanelProps) {
  return (
    <aside
      className={'library ' + (mobilePanel === 'assets' ? 'mobile-open' : '')}
      aria-label="片场资源"
    >
      <div className="panel-tabs">
        <button className={tab === 'assets' ? 'selected' : ''} onClick={() => setTab('assets')}>
          资源库
        </button>
        <button className={tab === 'objects' ? 'selected' : ''} onClick={() => setTab('objects')}>
          场内对象 <span>{project.entities.length}</span>
        </button>
      </div>
      <div className="panel-scroll">
        {tab === 'assets' ? (
          <>
            <div className="section-heading">
              <span>选择片场</span>
              <span>03</span>
            </div>
            <div className="pack-list">
              {packs.map((p, i) => (
                <button
                  key={p.id}
                  className={'pack-card ' + (p.id === project.environment ? 'selected' : '')}
                  onClick={() => {
                    if (p.id === project.environment) return;
                    if (
                      window.confirm(
                        `切换到「${p.name}」会载入一套新工程。当前工程可用撤销恢复。继续？`,
                      )
                    )
                      void perform(() =>
                        api<Project>('new', {
                          environment: p.id,
                          baseRevision: project.revision,
                        }),
                      ).then(() => {
                        setTime(0);
                        setPlaying(false);
                      });
                  }}
                >
                  <div className={'pack-art art-' + p.id}>
                    <i />
                    <i />
                    <i />
                    <span>0{i + 1}</span>
                  </div>
                  <div className="pack-copy">
                    <strong>{p.name}</strong>
                    <small>{p.subtitle}</small>
                  </div>
                  {p.id === project.environment && <Icon name="check" size={14} />}
                </button>
              ))}
            </div>
            {installedPacks.length > 0 && (
              <>
                <div className="section-heading">
                  <span>已安装片场</span>
                  <span>{installedPacks.length}</span>
                </div>
                <div className="installed-packs">
                  {installedPacks.map((p) => (
                    <button
                      key={p.id + '@' + p.version}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`载入「${p.name}」将替换当前工程，可撤销恢复。继续？`))
                          void perform(() =>
                            api<Project>(`packs/${encodeURIComponent(p.id)}/instantiate`, {
                              baseRevision: project.revision,
                              version: p.version,
                            }),
                          ).then(() => {
                            setTime(0);
                            setPlaying(false);
                          });
                      }}
                    >
                      <Icon name="folder" />
                      <span>
                        {p.name}
                        <small>
                          {p.author} · v{p.version} · {p.license}
                        </small>
                      </span>
                      <Icon name="chevron" size={12} />
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="section-heading">
              <span>加入场景</span>
              <span>08</span>
            </div>
            <div className="prop-grid">
              {props.map((p) => (
                <button key={p.kind} disabled={busy} onClick={() => addObject(p.kind)}>
                  <span className={'prop-glyph glyph-' + p.kind} style={{ color: p.color }}>
                    <Icon
                      name={
                        p.kind === 'actor'
                          ? 'move'
                          : p.kind === 'product'
                            ? 'cube'
                            : p.kind === 'plant'
                              ? 'layers'
                              : 'cube'
                      }
                      size={22}
                    />
                  </span>
                  {p.name}
                  <Icon name="plus" size={12} />
                </button>
              ))}
            </div>
            <button
              className="import-model"
              onClick={() => modelRef.current?.click()}
              disabled={busy}
            >
              <Icon name="upload" />
              <span>
                导入 3D 模型<small>自包含 GLB · 最大 50 MB</small>
              </span>
            </button>
            <button
              className="import-model"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <Icon name="folder" />
              <span>
                导入片场包<small>开放资源包 JSON / 工程 ZIP</small>
              </span>
            </button>
            <div className="library-footnote">
              <span className="eyebrow">OPEN SETS / V1</span>
              <p>搭一次片场，让不同的人和 AI 接着拍。</p>
              <small>内置资源包 1.0.0 · MIT</small>
            </div>
          </>
        ) : (
          <>
            <div className="section-heading">
              <span>{currentPack.name}</span>
              <Button icon="plus" aria-label="打开资源库" onClick={() => setTab('assets')} />
            </div>
            <div className="object-list">
              {project.entities.map((e) => (
                <button
                  key={e.id}
                  className={selection === e.id ? 'selected' : ''}
                  onClick={() => {
                    setSelection(e.id);
                    setMobilePanel(null);
                  }}
                >
                  <span className="object-swatch" style={{ background: e.color }} />
                  <span>
                    {e.name}
                    <small>{e.kind.toUpperCase()}</small>
                  </span>
                  <Icon name={e.locked ? 'lock' : 'cube'} size={14} />
                </button>
              ))}
            </div>
            {!project.entities.length && (
              <p className="empty">这里还是空的。去资源库加入第一个主角。</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
