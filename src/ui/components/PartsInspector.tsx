import { useEffect, useRef, useState } from 'react';
import { uid, type Project, type Entity } from '../../core/schema';
import { useI18n, localizeError } from '../i18n';
import { api } from '../api';
import type { Command, Set } from '../types';
import { Button } from './Controls';

type Nodes = { revision: number; entityId: string; nodes: { key: string; name: string }[] };
type Pass = 'beauty' | 'highlight' | 'part-id' | 'mask';
export function PartsInspector({
  project,
  entity,
  command,
  busy,
  partSelection,
  setPartSelection,
  displayPass,
  setDisplayPass,
}: {
  project: Project;
  entity: Entity;
  command: Command;
  busy: boolean;
  partSelection: string | null;
  setPartSelection: Set<string | null>;
  displayPass: Pass;
  setDisplayPass: Set<Pass>;
}) {
  const { t } = useI18n();
  const [nodes, setNodes] = useState<Nodes | null>(null);
  const [nodesExpanded, setNodesExpanded] = useState(false);
  const [partNote, setPartNote] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [license, setLicense] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const currentEntity = useRef(entity.id);
  currentEntity.current = entity.id;
  const part = entity.parts?.find((p) => p.id === partSelection);
  const loadNodes = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api<Nodes>('nodes', { entityId: entity.id });
      if (currentEntity.current === result.entityId) {
        setNodes(result);
        setNodesExpanded(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setNodes(null);
    setMembers([]);
    setName('');
    setPartNote('');
    setNodesExpanded(false);
    setError('');
  }, [entity.id]);
  useEffect(() => {
    setMembers(part?.members ?? []);
    setName(part?.name ?? '');
    setPartNote(part?.note ?? '');
  }, [part?.id, part?.name, part?.note, JSON.stringify(part?.members)]);
  const bindings = part ? (part.referenceIds ?? []) : (entity.referenceIds ?? []);
  const references = project.references ?? [];
  const bind = async (ids: string[], revision = project.revision) =>
    command(
      part
        ? [{ type: 'part.set', entityId: entity.id, part: { ...part, referenceIds: ids } }]
        : [{ type: 'entity.update', id: entity.id, changes: { referenceIds: ids } }],
      t('绑定外观参考'),
      revision,
    );
  const upload = async (file: File) => {
    const entityId = entity.id,
      partId = part?.id;
    const revision = project.revision;
    setLoading(true);
    setError('');
    try {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      )
        throw Error(t('请选择 10 MB 以内的 PNG、JPEG 或 WebP'));
      const res = await fetch('/api/references', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || t('参考图上传失败'));
      const reference = {
        id: uid(),
        name: referenceName.trim() || file.name,
        asset: data.asset,
        purpose: 'appearance' as const,
        description,
        ...(source ? { source } : {}),
        ...(license ? { license } : {}),
      };
      const operations = [
        { type: 'reference.add' as const, reference },
        partId
          ? {
              type: 'part.set' as const,
              entityId,
              part: { ...part!, referenceIds: [...bindings, reference.id] },
            }
          : {
              type: 'entity.update' as const,
              id: entityId,
              changes: { referenceIds: [...bindings, reference.id] },
            },
      ];
      await command(operations, t('上传并绑定参考图'), revision);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="parts-inspector" aria-label={t('部件与参考')}>
      <div className="section-heading">
        <span>{t('部件与参考')}</span>
        <small>{entity.parts?.length ?? 0}</small>
      </div>
      <label className="field">
        <span>{t('选择部件')}</span>
        <select
          aria-label={t('选择部件')}
          value={partSelection ?? ''}
          onChange={(e) => {
            setPartSelection(e.target.value || null);
            if (!e.target.value) setDisplayPass('beauty');
          }}
        >
          <option value="">{t('整个对象 / 新部件')}</option>
          {(entity.parts ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('预览通道')}</span>
        <select
          aria-label={t('预览通道')}
          value={displayPass}
          onChange={(e) => setDisplayPass(e.target.value as Pass)}
        >
          <option value="beauty">{t('正常画面')}</option>
          <option value="part-id">{t('彩色部件 ID')}</option>
          <option value="highlight" disabled={!part}>
            {t('高亮选中部件')}
          </option>
          <option value="mask" disabled={!part}>
            {t('黑白部件遮罩')}
          </option>
        </select>
      </label>
      <Button className="wide" disabled={loading || busy} onClick={() => void loadNodes()}>
        {t('读取模型节点')}
      </Button>
      {nodes && (
        <Button className="wide" onClick={() => setNodesExpanded((value) => !value)}>
          {nodesExpanded ? t('收起部件编辑') : t('展开部件编辑')}
        </Button>
      )}
      {nodes && nodesExpanded && (
        <>
          <small className="helper">
            {t('节点快照 r{revision}', { revision: nodes.revision })}
          </small>
          {nodes.revision !== project.revision && (
            <p className="helper">{t('工程已改变，请重新读取节点再保存部件。')}</p>
          )}
          <label className="field">
            <span>{t('部件名称')}</span>
            <input
              aria-label={t('部件名称')}
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('部件约束说明')}</span>
            <textarea
              aria-label={t('部件约束说明')}
              value={partNote}
              maxLength={2000}
              onChange={(e) => setPartNote(e.target.value)}
              placeholder={t('例如：保持车头轮廓与窗户位置，只替换车漆')}
            />
          </label>
          <div className="part-node-list">
            {nodes.nodes.map((n) => {
              const owner = entity.parts?.find(
                (p) => p.id !== part?.id && p.members.includes(n.key),
              );
              return (
                <label key={n.key} className="part-node-row">
                  <input
                    type="checkbox"
                    aria-label={`${n.name} (${n.key})`}
                    checked={members.includes(n.key)}
                    disabled={!!owner || busy || entity.locked}
                    onChange={(e) =>
                      setMembers((old) =>
                        e.target.checked ? [...old, n.key] : old.filter((k) => k !== n.key),
                      )
                    }
                  />
                  <span>
                    {n.name || n.key}
                    <small>
                      {n.key}
                      {owner ? ` · ${owner.name}` : ''}
                    </small>
                  </span>
                </label>
              );
            })}
          </div>
          <Button
            className="wide"
            disabled={
              busy ||
              entity.locked ||
              !name.trim() ||
              !members.length ||
              nodes.revision !== project.revision
            }
            onClick={async () => {
              const id = part?.id ?? uid();
              if (
                await command(
                  [
                    {
                      type: 'part.set',
                      entityId: entity.id,
                      part: { ...(part ?? { id }), name: name.trim(), members, note: partNote },
                    },
                  ],
                  t('保存部件'),
                  nodes.revision,
                )
              ) {
                setPartSelection(id);
                setNodesExpanded(false);
              }
            }}
          >
            {t('保存部件')}
          </Button>
        </>
      )}
      {part && (
        <Button
          className="wide"
          disabled={busy || entity.locked}
          onClick={() =>
            void command(
              [{ type: 'part.remove', entityId: entity.id, partId: part.id }],
              t('删除部件'),
            )
          }
        >
          {t('删除部件')}
        </Button>
      )}
      <div className="section-heading">
        <span>{t('外观参考')}</span>
        <small>{part?.name ?? entity.name}</small>
      </div>
      <p className="helper">
        {t('白模提供空间与运动，参考图描述材质与外观。遮罩效果取决于下游模型支持。')}
      </p>
      {references.map((r) => (
        <div className="reference-row" key={r.id}>
          <img src={`/api/references/${r.asset}`} alt={r.name} />
          <label>
            <input
              type="checkbox"
              aria-label={t('绑定参考图 {name}', { name: r.name })}
              checked={bindings.includes(r.id)}
              disabled={busy || entity.locked}
              onChange={(e) =>
                void bind(
                  e.target.checked ? [...bindings, r.id] : bindings.filter((id) => id !== r.id),
                )
              }
            />
            {r.name}
          </label>
          <small>{r.description}</small>
          <Button
            disabled={busy}
            aria-label={t('删除参考图 {name}', { name: r.name })}
            onClick={() => {
              if (window.confirm(t('删除参考图将解除所有对象和部件的绑定。继续？')))
                void command([{ type: 'reference.remove', id: r.id }], t('删除参考图'));
            }}
          >
            {t('删除参考图')}
          </Button>
        </div>
      ))}
      <label className="field">
        <span>{t('参考名称（可选）')}</span>
        <input
          aria-label={t('参考名称（可选）')}
          maxLength={160}
          value={referenceName}
          onChange={(e) => setReferenceName(e.target.value)}
          placeholder={t('留空使用图片文件名')}
        />
      </label>
      <label className="field">
        <span>{t('外观描述')}</span>
        <textarea
          aria-label={t('外观描述')}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('例如：深蓝车头，真实金属与磨损')}
        />
      </label>
      <label className="field">
        <span>{t('参考来源')}</span>
        <input
          aria-label={t('参考来源')}
          maxLength={500}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </label>
      <label className="field">
        <span>{t('参考许可')}</span>
        <input
          aria-label={t('参考许可')}
          maxLength={160}
          value={license}
          onChange={(e) => setLicense(e.target.value)}
        />
      </label>
      <Button
        className="wide"
        disabled={busy || loading || entity.locked}
        onClick={() => fileRef.current?.click()}
      >
        {loading ? t('正在上传参考图…') : t('上传并绑定参考图')}
      </Button>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void upload(f);
        }}
      />
      {error && (
        <p role="alert" className="error">
          {localizeError(error)}
        </p>
      )}
    </section>
  );
}
