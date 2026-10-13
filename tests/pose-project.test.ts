import { describe, expect, it } from 'vitest';
import { createProject, newEntity } from '../src/core/catalog';
import { neutralPose, posePresets } from '../src/core/actor';
import { applyTransaction, evaluate } from '../src/core/project';
import { projectSchema, type Project, type Operation } from '../src/core/schema';
const change = (p: Project, operations: Operation[]) =>
  applyTransaction(p, {
    requestId: crypto.randomUUID(),
    baseRevision: p.revision,
    label: 'Pose integration',
    operations,
  });
const setup = () => {
  const p = createProject();
  const e = p.entities[0];
  e.actor!.action = 'wave';
  return { p, e, shot: p.shots[0] };
};
describe('actor pose project integration', () => {
  it('holds legacy actors unchanged and supports explicit rig upgrade', () => {
    const { p, e } = setup();
    delete e.actor;
    const old = projectSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(evaluate(old, old.shots[0], 2).entities[0].actor).toBeUndefined();
    const upgraded = change(old, [
      { type: 'entity.update', id: e.id, changes: { actor: newEntity('actor').actor } },
    ]);
    expect(upgraded.entities[0].actor?.pose).toEqual(neutralPose());
  });
  it('interpolates shot-specific pose and seeks independently of frame order', () => {
    const { p, e, shot } = setup();
    const end = neutralPose();
    end.joints.head[1] = 50;
    const next = change(p, [
      { type: 'pose.set', shotId: shot.id, entityId: e.id, key: { time: 0, pose: neutralPose() } },
      { type: 'pose.set', shotId: shot.id, entityId: e.id, key: { time: 4, pose: end } },
    ]);
    const before = JSON.stringify(next);
    expect(evaluate(next, next.shots[0], 2).entities[0].actor!.pose.joints.head[1]).toBe(25);
    evaluate(next, next.shots[0], 5);
    expect(evaluate(next, next.shots[0], 1).entities[0].actor!.pose.joints.head[1]).toBe(12.5);
    expect(
      evaluate(next, next.shots[1], 1).entities[0].actor!.pose.joints.leftShoulder[2],
    ).not.toBe(0);
    expect(JSON.stringify(next)).toBe(before);
    expect(projectSchema.parse(JSON.parse(before))).toEqual(next);
  });
  it('rejects out-of-range poses and out-of-shot keys atomically', () => {
    const { p, e, shot } = setup();
    const bad = neutralPose();
    bad.joints.leftKnee[1] = 15;
    for (const key of [
      { time: 0, pose: bad },
      { time: shot.duration + 1, pose: neutralPose() },
    ]) {
      expect(() =>
        change(p, [
          { type: 'project.update', name: 'Should roll back' },
          { type: 'pose.set', shotId: shot.id, entityId: e.id, key },
        ]),
      ).toThrow();
      expect(p.revision).toBe(0);
      expect(p.name).not.toBe('Should roll back');
    }
  });
  it('rejects non-actor pose tracks and changes to locked actors', () => {
    const { p, e, shot } = setup();
    const op: Operation = {
      type: 'pose.set',
      shotId: shot.id,
      entityId: e.id,
      key: { time: 0, pose: neutralPose() },
    };
    e.locked = true;
    expect(() => change(p, [op])).toThrow('对象已锁定');
    expect(() =>
      change(p, [
        {
          type: 'entity.update',
          id: e.id,
          changes: { actor: { ...e.actor!, pose: posePresets[1].pose } },
        },
      ]),
    ).toThrow();
    expect(() => change(p, [{ ...op, entityId: p.entities[2].id }])).toThrow('rigged actor');
  });
  it('cleans pose tracks when deleting or replacing an actor and rejects shortened shots', () => {
    const { p, e, shot } = setup();
    const next = change(p, [
      { type: 'pose.set', shotId: shot.id, entityId: e.id, key: { time: 4, pose: neutralPose() } },
    ]);
    expect(() =>
      change(next, [{ type: 'shot.update', id: shot.id, changes: { duration: 2 } }]),
    ).toThrow();
    const converted = change(next, [{ type: 'entity.update', id: e.id, changes: { kind: 'box' } }]);
    expect(converted.entities[0].actor).toBeUndefined();
    expect(converted.shots[0].poseTracks?.[e.id]).toBeUndefined();
    const removed = change(next, [{ type: 'entity.remove', id: e.id }]);
    expect(removed.shots[0].poseTracks?.[e.id]).toBeUndefined();
  });
});
