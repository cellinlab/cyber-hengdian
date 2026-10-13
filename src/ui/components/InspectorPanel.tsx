import { Euler, Quaternion } from 'three';
import { props } from '../../core/catalog';
import type { Project, Entity, Shot, Key, Transform, Operation } from '../../core/schema';
import type { Set, InputRef, Command } from '../types';
import { Icon } from '../Icons';
import { Button, Field, Vector } from './Controls';
import { pad } from '../format';

type InspectorPanelProps = {
  project: Project;
  shot: Shot;
  entity: Entity | undefined;
  sampled: Entity | undefined;
  mobilePanel: 'assets' | 'inspect' | null;
  setSelection: Set<string | null>;
  command: Command;
  replaceModelRef: InputRef;
  busy: boolean;
  duplicate: () => void;
  time: number;
  selectedKeys: Key[];
  setTransform: (change: Partial<Transform>) => void;
  setTime: Set<number>;
  setPlaying: Set<boolean>;
  editShot: (changes: Partial<Omit<Shot, 'id' | 'tracks'>>) => void;
};
export function InspectorPanel({
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
}: InspectorPanelProps) {
  const rotation = sampled
    ? new Euler().setFromQuaternion(new Quaternion(...sampled.transform.rotation), 'XYZ')
    : null;
  return (
    <aside
      className={'inspector ' + (mobilePanel === 'inspect' ? 'mobile-open' : '')}
      aria-label="检查器"
    >
      <div className="inspector-head">
        <span>{entity ? '对象属性' : '镜头设置'}</span>
        {entity ? (
          <Button icon="close" aria-label="取消选择对象" onClick={() => setSelection(null)} />
        ) : (
          <Icon name="camera" />
        )}
      </div>
      <div className="panel-scroll">
        {entity && sampled ? (
          <>
            <div className="selected-object">
              <span className="object-emblem" style={{ color: entity.color }}>
                <Icon name="cube" size={28} />
              </span>
              <div>
                <strong>{entity.name}</strong>
                <small>{entity.kind.toUpperCase()} / 场内对象</small>
              </div>
            </div>
            <Field
              label="对象名称"
              value={entity.name}
              onCommit={(name) =>
                void command(
                  [{ type: 'entity.update', id: entity.id, changes: { name } }],
                  '命名对象',
                )
              }
            />
            <label className="field">
              <span>替换主体，保留镜头关系</span>
              <select
                aria-label="替换对象类型"
                disabled={busy}
                value={entity.kind}
                onChange={(e) => {
                  if (e.target.value === 'glb') {
                    replaceModelRef.current?.click();
                    return;
                  }
                  void command(
                    [
                      {
                        type: 'entity.update',
                        id: entity.id,
                        changes: { kind: e.target.value as Entity['kind'], asset: null },
                      },
                    ],
                    '替换主体',
                  );
                }}
              >
                {props.map((p) => (
                  <option key={p.kind} value={p.kind}>
                    {p.name}
                  </option>
                ))}
                <option value="glb">导入 GLB 模型…</option>
              </select>
            </label>
            {entity.kind === 'glb' && (
              <Button
                className="wide"
                icon="upload"
                onClick={() => replaceModelRef.current?.click()}
              >
                替换模型文件
              </Button>
            )}
            <div className="object-actions">
              <Button icon="copy" onClick={duplicate} disabled={busy}>
                复制
              </Button>
              <Button
                icon={entity.locked ? 'lock' : 'unlock'}
                active={entity.locked}
                disabled={busy}
                onClick={() =>
                  void command(
                    [
                      {
                        type: 'entity.update',
                        id: entity.id,
                        changes: { locked: !entity.locked },
                      },
                    ],
                    '锁定状态',
                  )
                }
              >
                {entity.locked ? '已锁定' : '锁定'}
              </Button>
              <Button
                icon="trash"
                aria-label="删除对象"
                disabled={busy}
                onClick={() => void command([{ type: 'entity.remove', id: entity.id }], '删除对象')}
              />
            </div>
            <div className="section-heading">
              <span>空间变换</span>
              <span>{time > 0 || selectedKeys.length ? '镜头关键帧' : '基础姿态'}</span>
            </div>
            <Vector
              label="位置"
              value={sampled.transform.position}
              disabled={entity.locked || busy}
              onCommit={(position) => setTransform({ position })}
            />
            <Vector
              label="旋转 °"
              value={[
                (rotation!.x * 180) / Math.PI,
                (rotation!.y * 180) / Math.PI,
                (rotation!.z * 180) / Math.PI,
              ]}
              disabled={entity.locked || busy}
              onCommit={(v) =>
                setTransform({
                  rotation: new Quaternion()
                    .setFromEuler(
                      new Euler(
                        ...(v.map((x) => (x * Math.PI) / 180) as [number, number, number]),
                        'XYZ',
                      ),
                    )
                    .toArray(),
                })
              }
            />
            <Vector
              label="缩放"
              value={sampled.transform.scale}
              disabled={entity.locked || busy}
              onCommit={(scale) => setTransform({ scale })}
            />
            <label className="color-field">
              <span>主体颜色</span>
              <input
                type="color"
                aria-label="主体颜色"
                value={entity.color}
                disabled={busy}
                onChange={(e) =>
                  void command(
                    [
                      {
                        type: 'entity.update',
                        id: entity.id,
                        changes: { color: e.target.value },
                      },
                    ],
                    '修改颜色',
                  )
                }
              />
              <code>{entity.color.toUpperCase()}</code>
            </label>
            <p className="helper">
              {entity.locked
                ? '对象已锁定，解锁后可调整姿态。'
                : time > 0 || selectedKeys.length
                  ? '此时修改姿态会写入当前镜头关键帧。'
                  : '零秒且没有轨道时，修改共享的基础姿态。'}
            </p>
            <div className="section-heading">
              <span>当前镜头动作</span>
              <span>{selectedKeys.length} 个关键帧</span>
            </div>
            <Button
              className="wide"
              icon="key"
              disabled={entity.locked || busy}
              onClick={() => {
                const ops: Operation[] = [];
                if (time > 0 && !selectedKeys.length)
                  ops.push({
                    type: 'key.set',
                    shotId: shot.id,
                    entityId: entity.id,
                    key: { ...entity.transform, time: 0 },
                  });
                ops.push({
                  type: 'key.set',
                  shotId: shot.id,
                  entityId: entity.id,
                  key: {
                    ...sampled.transform,
                    time: Math.min(
                      shot.duration,
                      Math.round(time * Number(project.fps)) / Number(project.fps),
                    ),
                  },
                });
                void command(ops, '设置关键帧');
              }}
            >
              在 {time.toFixed(2)} 秒设关键帧
            </Button>
            <div className="key-list">
              {selectedKeys.map((k) => (
                <div key={k.time}>
                  <button
                    onClick={() => {
                      setTime(k.time);
                      setPlaying(false);
                    }}
                  >
                    <Icon name="key" size={12} />
                    {k.time.toFixed(2)}s
                  </button>
                  <Button
                    icon="trash"
                    aria-label={`删除 ${k.time} 秒关键帧`}
                    onClick={() =>
                      void command(
                        [
                          {
                            type: 'key.remove',
                            shotId: shot.id,
                            entityId: entity.id,
                            time: k.time,
                          },
                        ],
                        '删除关键帧',
                      )
                    }
                  />
                </div>
              ))}
            </div>
            {entity.kind === 'glb' && (
              <>
                <Field
                  label="资产来源"
                  value={entity.source ?? ''}
                  onCommit={(source) =>
                    void command(
                      [{ type: 'entity.update', id: entity.id, changes: { source } }],
                      '填写资产来源',
                    )
                  }
                />
                <Field
                  label="资产许可"
                  value={entity.license ?? ''}
                  onCommit={(license) =>
                    void command(
                      [{ type: 'entity.update', id: entity.id, changes: { license } }],
                      '填写资产许可',
                    )
                  }
                />
                <p className="helper">
                  来源：{entity.source || '未填写'}
                  <br />
                  许可：{entity.license || '未声明，请确认使用权限'}
                  <br />
                  保留模型原始材质。
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <div className="shot-number">
              SHOT <strong>{pad(project.shots.findIndex((s) => s.id === shot.id) + 1)}</strong>
              <span>{shot.duration.toFixed(1)} SEC</span>
            </div>
            <Field label="镜头名称" value={shot.name} onCommit={(name) => editShot({ name })} />
            <div className="field-pair">
              <Field
                label="时长 / 秒"
                value={shot.duration}
                type="number"
                min={0.5}
                max={30}
                step={0.5}
                onCommit={(v) => editShot({ duration: Number(v) })}
              />
              <Field
                label="视角 / FOV"
                value={shot.camera.fov}
                type="number"
                min={10}
                max={100}
                onCommit={(v) => editShot({ camera: { ...shot.camera, fov: Number(v) } })}
              />
            </div>
            <label className="field">
              <span>跟随主体</span>
              <select
                aria-label="跟随主体"
                value={shot.camera.follow ?? ''}
                onChange={(e) =>
                  editShot({ camera: { ...shot.camera, follow: e.target.value || null } })
                }
              >
                <option value="">固定观察目标</option>
                {project.entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="section-heading">
              <span>摄影机路径</span>
              <span>米 / XYZ</span>
            </div>
            <Vector
              label="起点"
              value={shot.camera.from}
              onCommit={(from) => editShot({ camera: { ...shot.camera, from } })}
            />
            <Vector
              label="终点"
              value={shot.camera.to}
              onCommit={(to) => editShot({ camera: { ...shot.camera, to } })}
            />
            {!shot.camera.follow && (
              <>
                <Vector
                  label="起始目标"
                  value={shot.camera.target}
                  onCommit={(target) => editShot({ camera: { ...shot.camera, target } })}
                />
                <Vector
                  label="结束目标"
                  value={shot.camera.targetEnd}
                  onCommit={(targetEnd) => editShot({ camera: { ...shot.camera, targetEnd } })}
                />
              </>
            )}
            <Field
              label="拍摄意图"
              value={shot.intent}
              onCommit={(intent) => editShot({ intent })}
            />
            <p className="helper">在自由布置中找到构图，点击画面里的「将此视角设为镜头起点」。</p>
            <Button
              className="wide subtle-danger"
              icon="trash"
              disabled={project.shots.length <= 1 || busy}
              onClick={() => void command([{ type: 'shot.remove', id: shot.id }], '删除镜头')}
            >
              删除此镜头
            </Button>
          </>
        )}
      </div>
      <div className="inspector-footer">
        <span className="live-dot" /> 所有修改写入同一工程
      </div>
    </aside>
  );
}
