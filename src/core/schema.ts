import { z } from 'zod';
import { actorSchema, poseKeySchema } from './actor';
import { partSchema, appearanceReferenceSchema, referenceIdsSchema } from './parts';
import { modelIds } from './model-ids';
export const environmentSchema = z.enum(['courtyard', 'studio', 'exterior', 'empty']);
const finite = z.number().finite();
export const vec3 = z.tuple([finite, finite, finite]);
export const quat = z
  .tuple([finite, finite, finite, finite])
  .refine((q) => Math.abs(Math.hypot(...q) - 1) < 0.001, 'Quaternion must be normalized');
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine((v) => !['__proto__', 'prototype', 'constructor'].includes(v), 'Reserved identifier');
const text = z.string().min(1).max(160);
export const transformSchema = z
  .object({
    position: vec3,
    rotation: quat,
    scale: vec3.refine((v) => v.every((x) => x > 0 && x <= 1000), 'Scale must be positive'),
  })
  .strict();
export const entitySchema = z
  .object({
    id,
    name: text,
    kind: z.enum([
      'actor',
      'box',
      'sphere',
      'cylinder',
      'plant',
      'chair',
      'table',
      'product',
      'glb',
      'setpiece',
    ]),
    color: z.string().regex(/^#[\da-fA-F]{6}$/),
    transform: transformSchema,
    locked: z.boolean(),
    parts: z.array(partSchema).min(1).max(64).optional(),
    referenceIds: referenceIdsSchema.optional(),
    actor: actorSchema.optional(),
    modelId: z.enum(modelIds).optional(),
    asset: z
      .string()
      .regex(/^[a-f0-9]{64}\.glb$/)
      .optional(),
    source: z.string().max(500).optional(),
    license: z.string().max(160).optional(),
  })
  .strict()
  .refine((e) => e.kind !== 'glb' || !!e.asset, 'GLB requires an asset')
  .refine((e) => e.kind !== 'setpiece' || !!e.modelId, 'Setpiece requires a modelId')
  .refine((e) => !e.modelId || e.kind === 'setpiece', 'modelId is only valid for setpieces')
  .refine((e) => !e.actor || e.kind === 'actor', 'Actor rig is only valid for actors');
export const keySchema = transformSchema.extend({ time: finite.min(0).max(120) }).strict();
export const cameraSchema = z
  .object({
    from: vec3,
    to: vec3,
    target: vec3,
    targetEnd: vec3,
    fov: finite.min(10).max(100),
    follow: id.nullable(),
  })
  .strict();
export const shotSchema = z
  .object({
    id,
    name: text,
    duration: finite.min(0.5).max(30),
    camera: cameraSchema,
    tracks: z.record(z.string(), z.array(keySchema).max(200)),
    intent: z.string().max(2000),
    poseTracks: z.record(z.string(), z.array(poseKeySchema).max(200)).optional(),
  })
  .strict();
export const noteSchema = z
  .object({
    id,
    shotId: id,
    entityId: id.nullable(),
    time: finite.min(0),
    text: z.string().min(1).max(2000),
  })
  .strict();
export const projectSchema = z
  .object({
    schemaVersion: z.literal('hengdian/1'),
    id,
    name: text,
    revision: z.number().int().nonnegative(),
    fps: z.enum(['24', '30', '60']),
    aspect: z.enum(['16:9', '9:16', '1:1']),
    environment: environmentSchema,
    packVersion: z.literal('1.0.0'),
    resourcePack: z
      .object({ id: z.string(), version: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .optional(),
    entities: z.array(entitySchema).max(300),
    shots: z.array(shotSchema).min(1).max(100),
    notes: z.array(noteSchema).max(1000),
    references: z.array(appearanceReferenceSchema).max(256).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const ids = new Set(p.entities.map((e) => e.id));
    const shots = new Map(p.shots.map((s) => [s.id, s]));
    if (
      ids.size !== p.entities.length ||
      shots.size !== p.shots.length ||
      new Set(p.notes.map((n) => n.id)).size !== p.notes.length
    )
      fail('Duplicate IDs');
    const references = new Set((p.references ?? []).map((r) => r.id));
    if (references.size !== (p.references ?? []).length) fail('Duplicate reference IDs');
    for (const e of p.entities) {
      if (new Set((e.parts ?? []).map((part) => part.id)).size !== (e.parts ?? []).length)
        fail('Duplicate part IDs');
      const members = (e.parts ?? []).flatMap((part) => part.members);
      if (new Set(members).size !== members.length) fail('Mesh selector belongs to multiple parts');
      for (const ref of [
        ...(e.referenceIds ?? []),
        ...(e.parts ?? []).flatMap((part) => part.referenceIds ?? []),
      ])
        if (!references.has(ref)) fail('Unknown appearance reference');
    }
    for (const s of p.shots) {
      if (s.camera.follow && !ids.has(s.camera.follow)) fail('Unknown camera target');
      for (const [entity, keys] of Object.entries(s.poseTracks ?? {})) {
        const target = p.entities.find((e) => e.id === entity);
        if (!target?.actor || target.kind !== 'actor') fail('Pose track requires a rigged actor');
        if (keys.some((k, i) => k.time > s.duration || (i > 0 && k.time <= keys[i - 1].time)))
          fail('Pose keys must be sorted, unique and within shot');
      }
      for (const [entity, keys] of Object.entries(s.tracks)) {
        if (!ids.has(entity)) fail('Unknown track target');
        if (keys.some((k, i) => k.time > s.duration || (i > 0 && k.time <= keys[i - 1].time)))
          fail('Keys must be sorted, unique and within shot');
      }
    }
    for (const n of p.notes)
      if (
        !shots.has(n.shotId) ||
        (n.entityId && !ids.has(n.entityId)) ||
        n.time > shots.get(n.shotId)!.duration
      )
        fail('Invalid annotation reference or time');
  });
export const operationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('project.update'),
    name: text.optional(),
    aspect: z.enum(['16:9', '9:16', '1:1']).optional(),
    fps: z.enum(['24', '30', '60']).optional(),
  }),
  z.object({ type: z.literal('entity.add'), entity: entitySchema }),
  z.object({
    type: z.literal('entity.update'),
    id,
    changes: z
      .object({
        kind: z
          .enum([
            'actor',
            'box',
            'sphere',
            'cylinder',
            'plant',
            'chair',
            'table',
            'product',
            'glb',
            'setpiece',
          ])
          .optional(),
        asset: z
          .string()
          .regex(/^[a-f0-9]{64}\.glb$/)
          .nullable()
          .optional(),
        source: z.string().max(500).optional(),
        license: z.string().max(160).optional(),
        referenceIds: referenceIdsSchema.optional(),
        name: text.optional(),
        color: z
          .string()
          .regex(/^#[\da-fA-F]{6}$/)
          .optional(),
        transform: transformSchema.optional(),
        locked: z.boolean().optional(),
        actor: actorSchema.nullable().optional(),
        modelId: z.enum(modelIds).nullable().optional(),
      })
      .strict(),
  }),
  z.object({ type: z.literal('entity.remove'), id }),
  z.object({ type: z.literal('shot.add'), shot: shotSchema }),
  z.object({
    type: z.literal('shot.update'),
    id,
    changes: shotSchema.omit({ id: true, tracks: true, poseTracks: true }).partial().strict(),
  }),
  z.object({ type: z.literal('shot.remove'), id }),
  z.object({ type: z.literal('key.set'), shotId: id, entityId: id, key: keySchema }),
  z.object({ type: z.literal('key.remove'), shotId: id, entityId: id, time: finite }),
  z.object({ type: z.literal('pose.set'), shotId: id, entityId: id, key: poseKeySchema }),
  z.object({ type: z.literal('pose.remove'), shotId: id, entityId: id, time: finite }),
  z.object({ type: z.literal('part.set'), entityId: id, part: partSchema }),
  z.object({ type: z.literal('part.remove'), entityId: id, partId: id }),
  z.object({ type: z.literal('reference.add'), reference: appearanceReferenceSchema }),
  z.object({ type: z.literal('reference.remove'), id }),
  z.object({ type: z.literal('note.add'), note: noteSchema }),
  z.object({ type: z.literal('note.remove'), id }),
]);
export const transactionSchema = z
  .object({
    requestId: id,
    baseRevision: z.number().int().nonnegative(),
    label: text,
    operations: z.array(operationSchema).min(1).max(200),
  })
  .strict();
export type Project = z.infer<typeof projectSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type Shot = z.infer<typeof shotSchema>;
export type Transform = z.infer<typeof transformSchema>;
export type Key = z.infer<typeof keySchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Vec3 = z.infer<typeof vec3>;
export const uid = () => crypto.randomUUID();
export const identity = (position: Vec3 = [0, 0, 0]): Transform => ({
  position,
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});
