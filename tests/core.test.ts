import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProject } from '../src/core/catalog';
import { applyTransaction, Conflict, evaluate, interpolate } from '../src/core/project';
import {
  identity,
  projectSchema,
  type Operation,
  type Project,
  type Transaction,
} from '../src/core/schema';
import { Store } from '../server/store';
import { PackRegistry, type Pack } from '../server/packs';

const dirs: string[] = [];
const tempStore = () => {
  const dir = mkdtempSync(join(tmpdir(), 'hengdian-core-'));
  dirs.push(dir);
  return { dir, store: new Store(dir) };
};
const tx = (p: Project, operations: Operation[], requestId = crypto.randomUUID()): Transaction => ({
  requestId,
  baseRevision: p.revision,
  label: 'Contract test',
  operations,
});
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('editable project contracts', () => {
  it('preserves a full three-axis quaternion through JSON and interpolates the same orientation', () => {
    const p = createProject();
    const rotation = [0.2, -0.3, 0.4, Math.sqrt(0.71)] as [number, number, number, number];
    p.entities[0].transform.rotation = rotation;
    const restored = projectSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(restored.entities[0].transform.rotation).toEqual(rotation);
    const halfway = interpolate(identity(), restored.entities[0].transform, 0.5);
    const halfAngle = Math.acos(rotation[3]) / 2;
    expect(halfway.rotation[3]).toBeCloseTo(Math.cos(halfAngle), 12);
    expect(Math.hypot(...halfway.rotation)).toBeCloseTo(1, 12);
    for (let i = 0; i < 3; i++)
      expect(halfway.rotation[i]).toBeCloseTo(
        (rotation[i] * Math.sin(halfAngle)) / Math.sin(halfAngle * 2),
        12,
      );
    const opposite = {
      ...restored.entities[0].transform,
      rotation: rotation.map((x) => -x) as typeof rotation,
    };
    interpolate(restored.entities[0].transform, opposite, 0.5).rotation.forEach((component, i) =>
      expect(component).toBeCloseTo(rotation[i], 12),
    );
  });

  it('keeps following the same actor when a preceding entity is deleted', () => {
    const p = createProject();
    const followed = p.entities[1];
    p.shots[0].camera.follow = followed.id;
    const next = applyTransaction(p, tx(p, [{ type: 'entity.remove', id: p.entities[0].id }]));
    expect(next.shots[0].camera.follow).toBe(followed.id);
    expect(evaluate(next, next.shots[0], 0).camera.target).toEqual([
      followed.transform.position[0],
      followed.transform.position[1] + 1.1,
      followed.transform.position[2],
    ]);
  });

  it('removes dangling follow, animation and note references when their target is deleted', () => {
    const p = createProject();
    const entityId = p.entities[0].id;
    const shot = p.shots[0];
    shot.camera.follow = entityId;
    shot.tracks[entityId] = [{ ...identity(), time: 0 }];
    p.notes.push({ id: 'note', shotId: shot.id, entityId, time: 0, text: 'Look here' });
    const next = applyTransaction(p, tx(p, [{ type: 'entity.remove', id: entityId }]));
    expect(next.shots[0].camera.follow).toBeNull();
    expect(next.shots[0].tracks[entityId]).toBeUndefined();
    expect(next.notes[0].entityId).toBeNull();
    expect(() => projectSchema.parse(next)).not.toThrow();
  });

  it('isolates per-shot movement and does not accumulate sampling side effects', () => {
    const p = createProject();
    const e = p.entities[0];
    const next = applyTransaction(
      p,
      tx(p, [
        {
          type: 'key.set',
          shotId: p.shots[0].id,
          entityId: e.id,
          key: { ...identity([0, 0, 0]), time: 0 },
        },
        {
          type: 'key.set',
          shotId: p.shots[0].id,
          entityId: e.id,
          key: { ...identity([6, 0, 0]), time: 6 },
        },
      ]),
    );
    expect(evaluate(next, next.shots[0], 3).entities[0].transform.position).toEqual([3, 0, 0]);
    expect(evaluate(next, next.shots[1], 3).entities[0].transform).toEqual(e.transform);
    evaluate(next, next.shots[0], 5);
    expect(evaluate(next, next.shots[0], 1).entities[0].transform.position).toEqual([1, 0, 0]);
    expect(next.entities[0].transform).toEqual(e.transform);
    expect(next.shots[1].tracks).toEqual({});
  });

  it('replaces a subject model while retaining identity, follow and shot motion', () => {
    const p = createProject();
    const id = p.entities[0].id;
    p.shots[0].camera.follow = id;
    p.shots[0].tracks[id] = [{ ...identity([1, 2, 3]), time: 0 }];
    const replaced = applyTransaction(
      p,
      tx(p, [
        {
          type: 'entity.update',
          id,
          changes: {
            kind: 'glb',
            asset: 'b'.repeat(64) + '.glb',
            source: 'Model author',
            license: 'CC0-1.0',
          },
        },
      ]),
    );
    expect(replaced.entities[0].id).toBe(id);
    expect(replaced.shots[0].camera.follow).toBe(id);
    expect(replaced.shots[0].tracks[id]).toEqual(p.shots[0].tracks[id]);
    const primitive = applyTransaction(
      replaced,
      tx(replaced, [{ type: 'entity.update', id, changes: { kind: 'product' } }]),
    );
    expect(primitive.entities[0].asset).toBeUndefined();
    expect(primitive.entities[0].id).toBe(id);
    expect(() =>
      applyTransaction(
        primitive,
        tx(primitive, [{ type: 'entity.update', id, changes: { kind: 'glb' } }]),
      ),
    ).toThrow();
  });

  it('rejects a whole batch if a later edit fails', () => {
    const p = createProject();
    const original = structuredClone(p);
    expect(() =>
      applyTransaction(
        p,
        tx(p, [
          { type: 'project.update', name: 'Must not survive' },
          { type: 'entity.remove', id: 'missing' },
        ]),
      ),
    ).toThrow();
    expect(p).toEqual(original);
  });

  it('rejects stale edits rather than overwrite a newer user change', () => {
    const p = createProject();
    const updated = applyTransaction(p, tx(p, [{ type: 'project.update', name: 'Human edit' }]));
    expect(() =>
      applyTransaction(updated, tx(p, [{ type: 'project.update', name: 'Old agent snapshot' }])),
    ).toThrow(Conflict);
    expect(updated.name).toBe('Human edit');
  });

  it.each([
    'follow',
    'track',
    'note',
    'NaN',
    'zero-quaternion',
    'duplicate',
    'unsorted-keys',
  ] as const)('rejects invalid %s data', (kind) => {
    const p = createProject();
    if (kind === 'follow') p.shots[0].camera.follow = 'absent';
    if (kind === 'track') p.shots[0].tracks.absent = [{ ...identity(), time: 0 }];
    if (kind === 'note')
      p.notes.push({ id: 'bad-note', shotId: 'absent', entityId: null, time: 0, text: 'Bad' });
    if (kind === 'NaN') p.entities[0].transform.position[0] = NaN;
    if (kind === 'zero-quaternion') p.entities[0].transform.rotation = [0, 0, 0, 0];
    if (kind === 'duplicate') p.entities.push(structuredClone(p.entities[0]));
    if (kind === 'unsorted-keys')
      p.shots[0].tracks[p.entities[0].id] = [
        { ...identity(), time: 2 },
        { ...identity(), time: 1 },
      ];
    expect(projectSchema.safeParse(p).success).toBe(false);
  });
});

describe('versioned resource packs', () => {
  const registry = () => {
    const { dir } = tempStore();
    return new PackRegistry(join(dir, 'packs'));
  };
  const pack = (): Pack => ({
    schemaVersion: 'hengdian-pack/1',
    id: 'community-dialogue',
    version: '1.0.0',
    name: 'Dialogue',
    description: 'Two-person scene',
    author: 'Test contributor',
    license: 'CC0-1.0',
    project: createProject(),
  });

  it('instantiates a saved pack with immutable provenance and independent project identity', () => {
    const r = registry();
    const input = pack();
    const installed = r.install(input);
    const reloaded = new PackRegistry(r.dir);
    const a = reloaded.instantiate(input.id, input.version);
    const b = reloaded.instantiate(input.id, input.version);
    expect(a.id).not.toBe(input.project.id);
    expect(a.id).not.toBe(b.id);
    expect(a.resourcePack).toEqual({
      id: input.id,
      version: input.version,
      sha256: r.digest(installed),
    });
    a.entities[0].name = 'Local change';
    expect(reloaded.instantiate(input.id, input.version).entities[0].name).toBe(
      input.project.entities[0].name,
    );
  });

  it('allows exact reinstall but rejects changed content under the same version', () => {
    const r = registry();
    const input = pack();
    r.install(input);
    expect(() => r.install(input)).not.toThrow();
    expect(() => r.install({ ...input, description: 'Silent replacement' })).toThrow();
    expect(r.list().filter((item) => item.id === input.id)).toHaveLength(1);
  });

  it('requires explicit selection when multiple versions are installed', () => {
    const r = registry();
    const input = pack();
    r.install(input);
    r.install({ ...input, version: '2.0.0' });
    expect(() => r.instantiate(input.id)).toThrow();
    expect(r.instantiate(input.id, '1.0.0').resourcePack?.version).toBe('1.0.0');
    expect(() => r.instantiate(input.id, '9.9.9')).toThrow();
    expect(() => r.instantiate('courtyard', '9.9.9')).toThrow();
  });

  it('rejects invalid identities and code-like extra fields instead of executing a pack', () => {
    const r = registry();
    const input = pack();
    expect(() => r.install({ ...input, id: '../escape' })).toThrow();
    expect(() => r.install({ ...input, onLoad: 'process.exit(1)' })).toThrow();
    expect(() => r.install({ ...input, id: 'courtyard' })).toThrow();
  });
});

describe('durable editing', () => {
  it('persists edits, history and idempotent receipts across store restart', () => {
    const { dir, store } = tempStore();
    const original = store.project;
    const request = tx(original, [{ type: 'project.update', name: 'Saved work' }]);
    const committed = store.transact(request);
    const restarted = new Store(dir);
    expect(restarted.project).toEqual(committed);
    expect(restarted.transact(request)).toEqual(committed);
    expect(restarted.history().entries).toHaveLength(1);
    expect(restarted.travel('undo', committed.revision).name).toBe(original.name);
  });

  it('rejects request ID reuse with different content without changing disk or state', () => {
    const { dir, store } = tempStore();
    const request = tx(store.project, [{ type: 'project.update', name: 'One' }]);
    const committed = store.transact(request);
    expect(() =>
      store.transact({ ...request, operations: [{ type: 'project.update', name: 'Two' }] }),
    ).toThrow(Conflict);
    expect(new Store(dir).project).toEqual(committed);
  });

  it('keeps revisions increasing through undo, redo and a divergent edit', () => {
    const { store } = tempStore();
    const original = store.project;
    const first = store.transact(tx(original, [{ type: 'project.update', name: 'New name' }]));
    const undone = store.travel('undo', first.revision);
    const redone = store.travel('redo', undone.revision);
    expect([original.revision, first.revision, undone.revision, redone.revision]).toEqual([
      0, 1, 2, 3,
    ]);
    expect(undone.name).toBe(original.name);
    expect(redone.name).toBe('New name');
    const back = store.travel('undo', redone.revision);
    store.transact(tx(back, [{ type: 'project.update', name: 'Different direction' }]));
    expect(store.history().canRedo).toBe(false);
    expect(() => store.travel('undo', original.revision)).toThrow(Conflict);
  });

  it('leaves durable history untouched after a rejected batch', () => {
    const { dir, store } = tempStore();
    const original = store.project;
    expect(() =>
      store.transact(
        tx(original, [
          { type: 'project.update', name: 'Partial edit' },
          { type: 'entity.remove', id: 'missing' },
        ]),
      ),
    ).toThrow();
    expect(new Store(dir).project).toEqual(original);
    expect(store.history().canUndo).toBe(false);
  });

  it('does not report an in-memory edit when durable storage fails', () => {
    const { dir, store } = tempStore();
    const original = store.project;
    store.file = join(dir, 'does-not-exist', 'workspace.json');
    expect(() =>
      store.transact(tx(original, [{ type: 'project.update', name: 'Cannot persist' }])),
    ).toThrow();
    expect(store.project).toEqual(original);
    expect(new Store(dir).project).toEqual(original);
    expect(store.history().canUndo).toBe(false);
  });
});
