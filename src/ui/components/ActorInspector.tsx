import { useEffect, useRef, useState } from 'react';
import {
  actorSchema,
  jointDefinitions,
  posePresets,
  neutralPose,
  sampleActor,
  type Pose,
  type JointId,
} from '../../core/actor';
import type { Entity, Project, Shot, Operation, Vec3 } from '../../core/schema';
import type { Command } from '../types';
import { useI18n } from '../i18n';
import { Button, Field, Vector } from './Controls';

type ActorInspectorProps = {
  entity: Entity;
  sampled: Entity;
  project: Project;
  shot: Shot;
  time: number;
  busy: boolean;
  command: Command;
  onSeek: (time: number) => void;
};
/** Joint editing shares the same revisioned operation path as every other edit. */
export function ActorInspector({
  entity,
  sampled,
  project,
  shot,
  time,
  busy,
  command,
  onSeek,
}: ActorInspectorProps) {
  const { t, locale } = useI18n();
  const dragRevision = useRef<number | null>(null);
  const [jointId, setJointId] = useState<JointId>('head');
  const definition = jointDefinitions.find((joint) => joint.id === jointId)!;
  const keys = shot.poseTracks?.[entity.id] ?? [];
  const disabled = busy || entity.locked;
  const frameTime = Math.min(
    shot.duration,
    Math.round(time * Number(project.fps)) / Number(project.fps),
  );
  const pose = sampled.actor?.pose;
  const [angles, setAngles] = useState<Vec3>([0, 0, 0]);
  useEffect(() => {
    if (pose) setAngles([...pose.joints[jointId]]);
  }, [pose, jointId]);
  const jointName = locale === 'en' ? definition.englishName : definition.label;
  const commitPose = (next: Pose, forceKey = false, revision = project.revision) => {
    if (!entity.actor || disabled) return;
    const ops: Operation[] = [];
    // Editing a sampled action must freeze that visible pose in a track;
    // writing it into the base pose would apply the procedural action twice.
    if (forceKey || time > 0 || keys.length || entity.actor.action !== 'none') {
      if (!keys.length && frameTime > 0)
        ops.push({
          type: 'pose.set',
          shotId: shot.id,
          entityId: entity.id,
          key: { time: 0, pose: sampleActor(entity.actor, 0) },
        });
      ops.push({
        type: 'pose.set',
        shotId: shot.id,
        entityId: entity.id,
        key: { time: frameTime, pose: next },
      });
    } else
      ops.push({
        type: 'entity.update',
        id: entity.id,
        changes: { actor: { ...entity.actor, pose: next } },
      });
    void command(ops, t('修改演员姿态'), revision);
  };
  const commitJoint = (axis: number, value: number, revision = project.revision) => {
    if (!pose || !Number.isFinite(value)) return;
    const next = structuredClone(pose);
    next.joints[jointId][axis] = Math.max(
      definition.min[axis],
      Math.min(definition.max[axis], value),
    );
    commitPose(next, false, revision);
  };
  return (
    <section className="actor-inspector" aria-label={t('关节演员')}>
      <div className="section-heading">
        <span>{t('关节演员')}</span>
        <span>{entity.actor ? 'RIG / V1' : 'LEGACY'}</span>
      </div>
      {!entity.actor || !pose ? (
        <>
          <p className="helper">{t('旧演员保持原外观；启用后使用可摆姿势的人体模型。')}</p>
          <Button
            className="wide"
            disabled={disabled}
            onClick={() =>
              void command(
                [
                  {
                    type: 'entity.update',
                    id: entity.id,
                    changes: { actor: actorSchema.parse({}) },
                  },
                ],
                t('启用关节控制'),
              )
            }
          >
            {t('启用关节控制')}
          </Button>
        </>
      ) : (
        <>
          <label className="field">
            <span>{t('姿势预设')}</span>
            <select
              aria-label={t('姿势预设')}
              disabled={disabled}
              value=""
              onChange={(event) => {
                const preset = posePresets.find((p) => p.id === event.target.value);
                if (preset) commitPose(structuredClone(preset.pose));
              }}
            >
              <option value="">{t('选择一个姿势')}</option>
              {posePresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {locale === 'en' ? p.englishName : p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('程序动作')}</span>
            <select
              aria-label={t('程序动作')}
              value={entity.actor.action}
              disabled={disabled}
              onChange={(event) =>
                void command(
                  [
                    {
                      type: 'entity.update',
                      id: entity.id,
                      changes: {
                        actor: {
                          ...entity.actor!,
                          action: event.target.value as NonNullable<Entity['actor']>['action'],
                        },
                      },
                    },
                  ],
                  t('修改演员动作'),
                )
              }
            >
              {(['none', 'walk', 'run', 'wave', 'talk', 'idle'] as const).map((action, index) => (
                <option key={action} value={action}>
                  {[t('无动作'), t('行走'), t('跑步'), t('挥手'), t('说话'), t('待机')][index]}
                </option>
              ))}
            </select>
          </label>
          <div className="field-pair">
            <Field
              label={t('动作速度')}
              type="number"
              min={0}
              max={4}
              step={0.1}
              value={entity.actor.speed}
              disabled={disabled}
              onCommit={(value) =>
                void command(
                  [
                    {
                      type: 'entity.update',
                      id: entity.id,
                      changes: { actor: { ...entity.actor!, speed: Number(value) } },
                    },
                  ],
                  t('修改演员动作'),
                )
              }
            />
            <Field
              label={t('动作相位')}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={entity.actor.phase}
              disabled={disabled}
              onCommit={(value) =>
                void command(
                  [
                    {
                      type: 'entity.update',
                      id: entity.id,
                      changes: { actor: { ...entity.actor!, phase: Number(value) } },
                    },
                  ],
                  t('修改演员动作'),
                )
              }
            />
          </div>
          {keys.length > 0 && (
            <p className="helper pose-track-notice">
              {t('姿态轨道覆盖程序动作；删除全部姿态关键帧后恢复程序动作。')}
            </p>
          )}
          <label className="field">
            <span>{t('选择关节')}</span>
            <select
              aria-label={t('选择关节')}
              value={jointId}
              onChange={(event) => setJointId(event.target.value as JointId)}
            >
              {jointDefinitions.map((joint) => (
                <option key={joint.id} value={joint.id}>
                  {locale === 'en' ? joint.englishName : joint.label}
                </option>
              ))}
            </select>
          </label>
          <div className="joint-controls" aria-label={t('关节角度')}>
            {angles.map((angle, axis) => (
              <div className="joint-axis" key={axis}>
                <label>{'XYZ'[axis]}</label>
                <input
                  type="range"
                  aria-label={t('{joint} {axis} 角度', { joint: jointName, axis: 'XYZ'[axis] })}
                  disabled={disabled || definition.min[axis] === definition.max[axis]}
                  min={definition.min[axis]}
                  max={definition.max[axis]}
                  step={1}
                  value={angle}
                  onChange={(event) =>
                    setAngles(
                      (previous) =>
                        previous.map((x, i) =>
                          i === axis ? Number(event.target.value) : x,
                        ) as Vec3,
                    )
                  }
                  onPointerDown={() => {
                    dragRevision.current = project.revision;
                    onSeek(time);
                  }}
                  onPointerUp={(event) => {
                    commitJoint(
                      axis,
                      Number(event.currentTarget.value),
                      dragRevision.current ?? project.revision,
                    );
                    dragRevision.current = null;
                  }}
                  onKeyUp={(event) => {
                    if (
                      [
                        'ArrowLeft',
                        'ArrowRight',
                        'ArrowUp',
                        'ArrowDown',
                        'Home',
                        'End',
                        'PageUp',
                        'PageDown',
                      ].includes(event.key)
                    )
                      commitJoint(axis, Number(event.currentTarget.value));
                  }}
                />
                <Field
                  label={t('{joint} {axis} 角度', { joint: jointName, axis: 'XYZ'[axis] })}
                  value={angle}
                  type="number"
                  step={1}
                  min={definition.min[axis]}
                  max={definition.max[axis]}
                  disabled={disabled}
                  onCommit={(value) => commitJoint(axis, Number(value))}
                />
              </div>
            ))}
          </div>
          <Vector
            label={t('身体偏移')}
            value={pose.rootOffset}
            disabled={disabled}
            onCommit={(rootOffset) => commitPose({ ...structuredClone(pose), rootOffset })}
          />
          <Button className="wide" disabled={disabled} onClick={() => commitPose(neutralPose())}>
            {t('恢复中立姿势')}
          </Button>
          <p className="helper">
            {t('零秒且无动作、无轨道时编辑基础姿势；否则保存当前可见姿态为镜头关键帧。')}
          </p>
          <Button
            className="wide"
            icon="key"
            disabled={disabled}
            onClick={() => commitPose(structuredClone(pose), true)}
          >
            {t('保存姿态关键帧')}
          </Button>
          {keys.length > 0 && (
            <div className="pose-key-list" aria-label={t('姿态关键帧')}>
              {keys.map((key) => (
                <div key={key.time}>
                  <button onClick={() => onSeek(key.time)}>{key.time.toFixed(2)}s</button>
                  <Button
                    title={t('应用到当前时刻')}
                    aria-label={t('应用到当前时刻') + ' ' + key.time.toFixed(2) + 's'}
                    icon="copy"
                    disabled={disabled}
                    onClick={() => commitPose(structuredClone(key.pose), true)}
                  />
                  <Button
                    title={t('删除姿态关键帧')}
                    aria-label={t('删除姿态关键帧') + ' ' + key.time.toFixed(2) + 's'}
                    icon="trash"
                    disabled={disabled}
                    onClick={() =>
                      void command(
                        [
                          {
                            type: 'pose.remove',
                            shotId: shot.id,
                            entityId: entity.id,
                            time: key.time,
                          },
                        ],
                        t('删除姿态关键帧'),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
