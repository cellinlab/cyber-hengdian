import { z } from 'zod';
import type { Project } from './schema';
export const partIdentifier = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine((v) => !['__proto__', 'prototype', 'constructor'].includes(v), 'Reserved identifier');
export const referenceIdsSchema = z
  .array(partIdentifier)
  .max(64)
  .refine((v) => new Set(v).size === v.length, 'Duplicate reference binding');
export const partSchema = z
  .object({
    id: partIdentifier,
    name: z.string().min(1).max(160),
    members: z
      .array(
        z
          .string()
          .max(160)
          .regex(/^\d+(\/\d+)*$/),
      )
      .min(1)
      .max(256)
      .refine((v) => new Set(v).size === v.length, 'Duplicate mesh selector'),
    referenceIds: referenceIdsSchema.optional(),
    note: z.string().max(2000).optional(),
  })
  .strict();
export const appearanceReferenceSchema = z
  .object({
    id: partIdentifier,
    name: z.string().min(1).max(160),
    asset: z.string().regex(/^[a-f0-9]{64}\.(png|jpg|webp)$/),
    purpose: z.literal('appearance'),
    description: z.string().max(2000),
    source: z.string().max(500).optional(),
    license: z.string().max(160).optional(),
  })
  .strict();
export type Part = z.infer<typeof partSchema>;
export type AppearanceReference = z.infer<typeof appearanceReferenceSchema>;
export const partSelectionSchema = z
  .object({ entityId: partIdentifier, partId: partIdentifier })
  .strict();
export type PartSelection = z.infer<typeof partSelectionSchema>;
export function getPartMap(project: Pick<Project, 'entities'>) {
  const used = new Set<number>();
  return project.entities
    .flatMap((e) =>
      (e.parts ?? []).map((p) => ({
        entityId: e.id,
        partId: p.id,
        name: p.name,
        referenceIds: p.referenceIds ?? [],
        ...(p.note !== undefined ? { note: p.note } : {}),
      })),
    )
    .sort((a, b) =>
      a.entityId < b.entityId
        ? -1
        : a.entityId > b.entityId
          ? 1
          : a.partId < b.partId
            ? -1
            : a.partId > b.partId
              ? 1
              : 0,
    )
    .map((p) => {
      // Stable identity hash; channels stay visible while zero remains the background.
      let hash = 2166136261;
      for (const char of `${p.entityId}/${p.partId}`)
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
      let value =
        ((80 + (((hash >>> 16) & 255) % 176)) << 16) |
        ((80 + (((hash >>> 8) & 255) % 176)) << 8) |
        (80 + ((hash & 255) % 176));
      while (used.has(value) || value === 0) value = (value + 1) & 0xffffff;
      used.add(value);
      return { ...p, value, hex: '#' + value.toString(16).padStart(6, '0') };
    });
}
export const truckParts: Part[] = [
  { id: 'cab', name: '车头 · Cab', members: ['0/0', '0/1', '0/2', '0/3', '0/4', '0/5'] },
  { id: 'cargo', name: '车厢 · Cargo', members: ['1/0', '1/1', '1/2'] },
  { id: 'wheels', name: '车轮 · Wheels', members: ['2/0', '2/1', '2/2', '2/3', '2/4', '2/5'] },
];
