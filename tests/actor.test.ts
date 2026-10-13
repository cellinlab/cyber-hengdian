import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  actorSchema,
  actorTupleSchemas,
  jointDefinitions,
  neutralPose,
  posePresets,
  poseSchema,
  sampleActor,
} from '../src/core/actor';
import { createActor, updateActor } from '../src/runtime/actor';

const preset = (id: string) => structuredClone(posePresets.find((p) => p.id === id)!.pose);
const world = (actor: THREE.Group, name: string) =>
  actor.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());

describe('actor pose data and deterministic sampling', () => {
  it('defaults to a complete neutral actor, rejects unknown joints and impossible hinge rotations', () => {
    const actor = actorSchema.parse({});
    expect(actor.action).toBe('none');
    expect(Object.keys(actor.pose.joints)).toHaveLength(17);
    expect(actor.pose).toEqual(neutralPose());
    expect(poseSchema.safeParse({ joints: { tail: [0, 0, 0] } }).success).toBe(false);
    expect(poseSchema.safeParse({ joints: { leftKnee: [-1, 0, 0] } }).success).toBe(false);
    expect(poseSchema.safeParse({ joints: { leftKnee: [45, 10, 0] } }).success).toBe(false);
    expect(poseSchema.safeParse({ rootOffset: [0, Infinity, 0] }).success).toBe(false);
    expect(actorTupleSchemas).toHaveLength(18);
  });

  it('has valid original presets including poses requiring a lowered pelvis', () => {
    for (const entry of posePresets) expect(poseSchema.safeParse(entry.pose).success).toBe(true);
    for (const id of ['sit', 'kneel', 'crouch']) expect(preset(id).rootOffset[1]).toBeLessThan(0);
    const a = actorSchema.parse({});
    a.pose.joints.head[0] = 20;
    expect(actorSchema.parse({}).pose.joints.head).toEqual([0, 0, 0]);
  });

  it('samples out of order without mutation and keeps every joint within its limits', () => {
    for (const action of ['none', 'walk', 'run', 'wave', 'talk', 'idle']) {
      const actor = actorSchema.parse({ action });
      const before = structuredClone(actor);
      const expected = sampleActor(actor, 0.27);
      sampleActor(actor, 9.5);
      sampleActor(actor, 0.01);
      expect(sampleActor(actor, 0.27)).toEqual(expected);
      expect(actor).toEqual(before);
      for (let i = 0; i < 40; i++)
        expect(poseSchema.safeParse(sampleActor(actor, i / 20)).success).toBe(true);
    }
  });

  it('moves knees/elbows independently and speed zero freezes the selected cycle phase', () => {
    const actor = actorSchema.parse({ action: 'walk' });
    const p = sampleActor(actor, 0.25);
    expect(p.joints.leftHip[0]).toBeLessThan(0);
    expect(p.joints.rightHip[0]).toBeGreaterThan(0);
    expect(p.joints.rightKnee[0]).toBeGreaterThan(p.joints.leftKnee[0]);
    const frozen = actorSchema.parse({ action: 'run', speed: 0, phase: 0.25 });
    expect(sampleActor(frozen, 0)).toEqual(sampleActor(frozen, 87));
  });

  it('lets explicit pose keys override action, interpolates angles/height, and holds endpoints', () => {
    const actor = actorSchema.parse({ action: 'run' });
    const keys = [
      { time: 1, pose: preset('stand') },
      { time: 3, pose: preset('sit') },
    ];
    const middle = sampleActor(actor, 2, keys);
    expect(middle.joints.leftHip[0]).toBe(-45);
    expect(middle.joints.leftKnee[0]).toBe(45);
    expect(middle.rootOffset[1]).toBeCloseTo(-0.215);
    expect(sampleActor(actor, 0, keys)).toEqual(keys[0].pose);
    expect(sampleActor(actor, 99, keys)).toEqual(keys[1].pose);
    middle.joints.leftHip[0] = 0;
    expect(keys[1].pose.joints.leftHip[0]).toBe(-90);
    expect(() => sampleActor(actor, 0, [keys[1], keys[0]])).toThrow(/increasing/);
    expect(() => sampleActor(actor, NaN)).toThrow(/finite/);
  });

  it('takes the short arc for root rotation but respects constrained joint intervals', () => {
    const a = neutralPose(),
      b = neutralPose();
    a.joints.root[1] = 170;
    b.joints.root[1] = -170;
    a.joints.head[1] = 60;
    b.joints.head[1] = -60;
    const result = sampleActor(actorSchema.parse({}), 0.5, [
      { time: 0, pose: a },
      { time: 1, pose: b },
    ]);
    expect(Math.abs(result.joints.root[1])).toBe(180);
    expect(result.joints.head[1]).toBe(0);
  });
});

describe('articulated runtime rig', () => {
  it('connects all joints with visible face, hands and feet and grounds neutral feet', () => {
    const actor = createActor('#7491c2');
    for (const j of jointDefinitions) expect(actor.getObjectByName(`joint:${j.id}`)).toBeDefined();
    for (const name of ['nose', 'eye:1', 'pupil:-1', 'left-hand', 'right-foot'])
      expect(actor.getObjectByName(name)).toBeInstanceOf(THREE.Mesh);
    for (const side of ['left', 'right']) {
      const bounds = new THREE.Box3().setFromObject(actor.getObjectByName(`${side}-foot`)!);
      expect(bounds.min.y).toBeCloseTo(0, 6);
    }
  });

  it('bending the elbow moves only the forearm/hand subtree and resets on backward seeking', () => {
    const actor = createActor('#7491c2');
    const shoulder = world(actor, 'joint:rightShoulder');
    const elbow = world(actor, 'joint:rightElbow');
    const wrist = world(actor, 'joint:rightWrist');
    const pose = neutralPose();
    pose.joints.rightElbow[0] = -90;
    updateActor(actor, pose);
    expect(world(actor, 'joint:rightShoulder').distanceTo(shoulder)).toBe(0);
    expect(world(actor, 'joint:rightElbow').distanceTo(elbow)).toBe(0);
    expect(world(actor, 'joint:rightWrist').z).toBeCloseTo(wrist.z + 0.27);
    expect(world(actor, 'joint:rightWrist').y).toBeCloseTo(elbow.y);
    updateActor(actor, neutralPose());
    expect(world(actor, 'joint:rightWrist').distanceTo(wrist)).toBeLessThan(1e-10);
  });

  it('sitting lowers the pelvis while feet remain on the same ground plane', () => {
    const actor = createActor('#7491c2');
    updateActor(actor, preset('sit'));
    expect(world(actor, 'joint:pelvis').y).toBeCloseTo(0.51);
    expect(world(actor, 'joint:leftKnee').z).toBeCloseTo(0.43);
    for (const side of ['left', 'right']) {
      const bounds = new THREE.Box3().setFromObject(actor.getObjectByName(`${side}-foot`)!);
      expect(bounds.min.y).toBeCloseTo(0, 6);
    }
  });

  it('keeps kneeling and crouching support geometry above the floor', () => {
    const actor = createActor('#7491c2');
    for (const id of ['kneel', 'crouch']) {
      updateActor(actor, preset(id));
      for (const name of ['left-foot', 'right-foot', 'left-knee', 'right-knee']) {
        const bounds = new THREE.Box3().setFromObject(actor.getObjectByName(name)!);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it('retains entity world placement and never accumulates articulation transforms', () => {
    const actor = createActor('#7491c2');
    actor.position.set(2, 0.3, -1);
    actor.rotation.y = 0.5;
    const a = preset('reach'),
      b = preset('kneel');
    updateActor(actor, a);
    const hand = world(actor, 'right-hand');
    updateActor(actor, b);
    updateActor(actor, a);
    expect(world(actor, 'right-hand').distanceTo(hand)).toBeLessThan(1e-10);
    expect(actor.position.toArray()).toEqual([2, 0.3, -1]);
    expect(actor.rotation.y).toBe(0.5);
  });
});
