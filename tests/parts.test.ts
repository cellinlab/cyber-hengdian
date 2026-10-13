import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createProject } from '../src/core/catalog';
import { newSetpiece } from '../src/core/library';
import { projectSchema, type Operation, type Project } from '../src/core/schema';
import { applyTransaction, Conflict } from '../src/core/project';
import { getPartMap, partSchema, truckParts } from '../src/core/parts';
import { createSetpiece } from '../src/runtime/setpieces';
const ref = {
  id: 'blue',
  name: 'Blue paint',
  asset: `${'a'.repeat(64)}.png`,
  purpose: 'appearance' as const,
  description: 'Blue cab paint',
};
function project() {
  const p = createProject('empty');
  p.entities = [newSetpiece('truck')];
  return p;
}
function tx(p: Project, ...operations: Operation[]) {
  return applyTransaction(p, {
    requestId: 'test',
    baseRevision: p.revision,
    label: 'parts test',
    operations,
  });
}
describe('semantic parts and appearance references', () => {
  it('partitions every truck mesh exactly once using stable paths and meaningful groups', () => {
    const g = createSetpiece('truck', '#bbbbbb');
    expect(g.children.map((c) => c.name)).toEqual(['Cab', 'Cargo', 'Wheels']);
    const meshes: THREE.Mesh[] = [];
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o);
    });
    const selected = truckParts.flatMap((part) =>
      part.members.map((key) =>
        key.split('/').reduce<THREE.Object3D>((o, index) => o.children[Number(index)], g),
      ),
    );
    expect(selected.every((o) => o instanceof THREE.Mesh)).toBe(true);
    expect(new Set(selected).size).toBe(meshes.length);
    expect(meshes).toHaveLength(15);
    const bounds = new THREE.Box3().setFromObject(g);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(bounds.max.z).toBeGreaterThan(3);
  });
  it('binds references atomically, upserts a part, removes reference bindings and roundtrips', () => {
    const p = project(),
      id = p.entities[0].id;
    const bound = tx(
      p,
      { type: 'reference.add', reference: ref },
      { type: 'part.set', entityId: id, part: { ...truckParts[0], referenceIds: ['blue'] } },
      { type: 'entity.update', id, changes: { referenceIds: ['blue'] } },
    );
    expect(bound.entities[0].parts).toHaveLength(3);
    expect(projectSchema.parse(JSON.parse(JSON.stringify(bound)))).toEqual(bound);
    expect(getPartMap(bound).find((part) => part.partId === 'cab')!.referenceIds).toEqual(['blue']);
    const removed = tx(bound, { type: 'reference.remove', id: 'blue' });
    expect(removed.references).toEqual([]);
    expect(removed.entities[0].referenceIds).toEqual([]);
    expect(removed.entities[0].parts!.find((part) => part.id === 'cab')!.referenceIds).toEqual([]);
    expect(p.references).toBeUndefined();
  });
  it('rejects duplicate IDs, overlapping selectors, unknown references and unsafe selector syntax', () => {
    const p = project();
    p.entities[0].parts!.push({ ...truckParts[0], id: 'extra' });
    expect(projectSchema.safeParse(p).success).toBe(false);
    for (const member of ['../0', '0/a', '', '/0', '0//1'])
      expect(partSchema.safeParse({ ...truckParts[0], members: [member] }).success).toBe(false);
    const q = project();
    q.entities[0].parts![0].referenceIds = ['missing'];
    expect(projectSchema.safeParse(q).success).toBe(false);
    const r = project();
    r.entities[0].parts!.push({ ...truckParts[0] });
    expect(projectSchema.safeParse(r).success).toBe(false);
  });
  it('keeps clone selectors but assigns deterministic distinct part map identities', () => {
    const p = project();
    const clone = structuredClone(p.entities[0]);
    clone.id = 'other-truck';
    p.entities.push(clone);
    const map = getPartMap(p);
    expect(map).toHaveLength(6);
    expect(new Set(map.map((e) => e.value)).size).toBe(6);
    expect(getPartMap({ ...p, entities: p.entities.slice().reverse() })).toEqual(map);
    expect(map.every((e) => e.hex === '#' + e.value.toString(16).padStart(6, '0'))).toBe(true);
    expect(map.every((e) => e.value !== 0)).toBe(true);
  });
  it('enforces locks and rejects stale/invalid transactions without partial edits', () => {
    const p = project();
    p.entities[0].locked = true;
    const id = p.entities[0].id;
    expect(() => tx(p, { type: 'part.remove', entityId: id, partId: 'cab' })).toThrow('锁定');
    expect(() => tx(p, { type: 'part.set', entityId: id, part: truckParts[0] })).toThrow('锁定');
    expect(() => tx(p, { type: 'entity.update', id, changes: { referenceIds: ['blue'] } })).toThrow(
      '锁定',
    );
    expect(() =>
      applyTransaction(p, {
        requestId: 'old',
        label: 'old',
        baseRevision: 1,
        operations: [{ type: 'reference.add', reference: ref }],
      }),
    ).toThrow(Conflict);
    p.entities[0].locked = false;
    expect(() =>
      tx(
        p,
        { type: 'reference.add', reference: ref },
        { type: 'part.set', entityId: id, part: { ...truckParts[0], members: ['1/0'] } },
      ),
    ).toThrow();
    expect(p.references).toBeUndefined();
    expect(p.revision).toBe(0);
  });
  it('clears selectors when geometry changes and removes last part cleanly', () => {
    const p = project(),
      id = p.entities[0].id;
    expect(
      tx(p, { type: 'entity.update', id, changes: { modelId: 'cottage' } }).entities[0].parts,
    ).toBeUndefined();
    expect(
      tx(p, { type: 'entity.update', id, changes: { kind: 'box' } }).entities[0].parts,
    ).toBeUndefined();
    const removed = tx(
      p,
      ...truckParts.map((part) => ({
        type: 'part.remove' as const,
        entityId: id,
        partId: part.id,
      })),
    );
    expect(removed.entities[0].parts).toBeUndefined();
  });
});
