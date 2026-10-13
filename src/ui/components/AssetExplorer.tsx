import { useMemo, useState } from 'react';
import {
  assetLibrary,
  assemblies,
  sceneTemplates,
  newSetpiece,
  instantiateAssembly,
  createSceneTemplate,
} from '../../core/library';
import type { Entity, Project } from '../../core/schema';
import type { Command, Perform } from '../types';
import { useI18n, type MessageKey } from '../i18n';
import { api } from '../api';
import { Icon } from '../Icons';

type AssetExplorerProps = {
  project: Project;
  busy: boolean;
  command: Command;
  perform: Perform;
  onAdded: (entities: Entity[]) => void;
  onReplaced: () => void;
};
const categoryLabels = {
  rural: '乡村',
  urban: '城市',
  landmark: '地标',
  building: '建筑',
  street: '街道设施',
  nature: '植被',
  classroom: '教室',
  hospital: '医疗',
  furniture: '室内家具',
} as const satisfies Record<string, MessageKey>;
export function AssetExplorer({
  project,
  busy,
  command,
  perform,
  onAdded,
  onReplaced,
}: AssetExplorerProps) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [section, setSection] = useState<'models' | 'templates' | 'assemblies'>('models');
  const language = locale === 'en' ? 'en' : 'zh';
  const catalog =
    section === 'models' ? assetLibrary : section === 'templates' ? sceneTemplates : assemblies;
  const categories = useMemo(() => [...new Set(catalog.map((asset) => asset.category))], [catalog]);
  const entries = catalog.filter((asset) => {
    const searchable = [
      asset.name.zh,
      asset.name.en,
      asset.description.zh,
      asset.description.en,
      ...('tags' in asset ? asset.tags : []),
    ]
      .join(' ')
      .toLowerCase();
    return (
      (category === 'all' || asset.category === category) &&
      searchable.includes(query.trim().toLowerCase())
    );
  });
  const add = (id: string) => {
    if (section === 'templates') {
      const template = sceneTemplates.find((entry) => entry.id === id)!;
      if (
        !window.confirm(
          t('载入「{p0}」将替换当前工程，可撤销恢复。继续？', { p0: template.name[language] }),
        )
      )
        return;
      const next = createSceneTemplate(id);
      // A new template can start with localized defaults; existing projects are never rewritten.
      next.name = template.name[language];
      void perform(() =>
        api<Project>('import', { project: next, baseRevision: project.revision }),
      ).then((saved) => {
        if (saved) onReplaced();
      });
      return;
    }
    const entities =
      section === 'models'
        ? [newSetpiece(id as Parameters<typeof newSetpiece>[0])]
        : instantiateAssembly(id, [0, 0, 0]);
    for (const entity of entities) {
      const item = assetLibrary.find((asset) => asset.id === entity.modelId);
      if (item) entity.name = item.name[language];
    }
    void command(
      entities.map((entity) => ({ type: 'entity.add' as const, entity })),
      t(section === 'models' ? '加入场景' : '追加组合布景'),
      project.revision,
    ).then((saved) => {
      if (saved) onAdded(entities);
    });
  };
  return (
    <section className="asset-explorer" aria-label={t('模型资产')}>
      <div className="section-heading">
        <span>{t('资源包')}</span>
        <span>
          {assetLibrary.length} + {sceneTemplates.length}
        </span>
      </div>
      <div className="asset-sections" role="tablist" aria-label={t('资源分类')}>
        {(['models', 'templates', 'assemblies'] as const).map((value, index) => (
          <button
            key={value}
            role="tab"
            aria-selected={section === value}
            className={section === value ? 'selected' : ''}
            onClick={() => {
              setSection(value);
              setCategory('all');
            }}
          >
            {[t('模型资产'), t('场景模板'), t('组合布景')][index]}
          </button>
        ))}
      </div>
      <input
        type="search"
        aria-label={t('搜索资源')}
        placeholder={t('搜索名称或标签…')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        aria-label={t('资源分类')}
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      >
        <option value="all">{t('全部分类')}</option>
        {categories.map((value) => (
          <option key={value} value={value}>
            {categoryLabels[value] ? t(categoryLabels[value]) : value}
          </option>
        ))}
      </select>
      <p className="asset-summary">{t('{count} 项资源', { count: entries.length })}</p>
      {section !== 'models' && (
        <p className="helper">
          {t(
            section === 'templates'
              ? '一键建立完整空间，替换当前工程并可撤销。'
              : '追加到当前片场，不替换已有对象。',
          )}
        </p>
      )}
      <div className="extended-asset-grid">
        {entries.map((asset) => (
          <button
            key={asset.id}
            disabled={busy}
            className={'extended-asset-card category-' + asset.category}
            onClick={() => add(asset.id)}
            title={asset.description[language]}
          >
            <div
              className="asset-card-art"
              style={
                {
                  '--asset-color': 'color' in asset ? asset.color : '#a3b283',
                } as React.CSSProperties
              }
            >
              <Icon
                name={
                  section === 'templates' ? 'layers' : section === 'assemblies' ? 'folder' : 'cube'
                }
                size={27}
              />
              <small>{asset.category.toUpperCase()}</small>
            </div>
            <strong>{asset.name[language]}</strong>
            <span>{asset.description[language]}</span>
            <Icon name="plus" size={12} />
          </button>
        ))}
      </div>
      {!entries.length && <p className="empty">{t('暂无匹配资源')}</p>}
    </section>
  );
}
