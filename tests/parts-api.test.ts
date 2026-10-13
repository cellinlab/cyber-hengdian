import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { createProject } from '../src/core/catalog';
import { newSetpiece } from '../src/core/library';
import type { Project, Operation } from '../src/core/schema';
const data = mkdtempSync(join(tmpdir(), '.hengdian-parts-http-'));
let child: ChildProcess;
let base: string;
let png: Buffer;
let asset: string;
const post = (path: string, body: unknown) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const get = async (): Promise<Project> => (await fetch(base + '/api/project')).json();
const edit = (p: Project, operations: Operation[], requestId = crypto.randomUUID()) => ({
  baseRevision: p.revision,
  requestId,
  label: 'Parts HTTP verification',
  operations,
});
beforeAll(async () => {
  const port = await new Promise<number>((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as any).port;
      s.close(() => resolve(p));
    });
  });
  base = `http://127.0.0.1:${port}`;
  let diagnostic = '';
  child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: resolve('.'),
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), HENGDIAN_DATA: data },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (b) => (diagnostic += b.toString()));
  child.stderr?.on('data', (b) => (diagnostic += b.toString()));
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/project')).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null) throw Error(diagnostic);
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw Error(diagnostic);
  png = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#2468bc' } })
    .png()
    .toBuffer();
  const response = await fetch(base + '/api/references', {
    method: 'POST',
    headers: { 'content-type': 'image/png' },
    body: Uint8Array.from(png).buffer,
  });
  expect(response.ok).toBe(true);
  ({ asset } = await response.json());
  const initial = await get();
  const p = createProject('empty');
  p.entities = [newSetpiece('truck')];
  p.entities[0].id = 'http-truck';
  expect((await post('/api/import', { project: p, baseRevision: initial.revision })).ok).toBe(true);
});
afterAll(async () => {
  if (child && child.exitCode === null)
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.kill('SIGTERM');
    });
  rmSync(data, { recursive: true, force: true });
});
describe('actual parts/reference HTTP pipeline', () => {
  it('registers a decoded image and binds a truck part atomically, serving original bytes', async () => {
    const p = await get();
    const reference = {
      id: 'paint',
      name: 'Cab paint',
      asset,
      purpose: 'appearance' as const,
      description: 'Blue painted cab',
    };
    const part = { ...p.entities[0].parts![0], referenceIds: ['paint'] };
    const result = await post(
      '/api/commands',
      edit(p, [
        { type: 'reference.add', reference },
        { type: 'part.set', entityId: 'http-truck', part },
      ]),
    );
    expect(result.ok).toBe(true);
    const saved = await get();
    expect(saved.entities[0].parts!.find((e) => e.id === 'cab')!.referenceIds).toEqual(['paint']);
    expect(saved.references).toEqual([reference]);
    expect(
      JSON.parse(readFileSync(join(data, 'workspace.json'), 'utf8')).project.references,
    ).toEqual([reference]);
    const response = await fetch(base + '/api/references/' + asset);
    expect(response.ok).toBe(true);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
  });
  it('returns all actual mesh selectors and rejects an invalid selector without a revision change', async () => {
    const p = await get();
    const result = await post('/api/nodes', { entityId: 'http-truck' });
    expect(result.ok).toBe(true);
    const snapshot = await result.json();
    expect(snapshot.revision).toBe(p.revision);
    expect(snapshot.nodes).toHaveLength(15);
    expect(snapshot.nodes.map((n: any) => n.key).sort()).toEqual(
      p.entities[0].parts!.flatMap((part) => part.members).sort(),
    );
    const invalid = await post(
      '/api/commands',
      edit(p, [
        {
          type: 'part.set',
          entityId: 'http-truck',
          part: { id: 'wrong', name: 'Missing geometry', members: ['99/0'] },
        },
      ]),
    );
    expect(invalid.ok).toBe(false);
    expect((await invalid.json()).error).toContain('Unknown mesh selector');
    expect(await get()).toEqual(p);
  });
  it('rejects missing reference assets, corrupt images and MIME mismatch', async () => {
    const p = await get();
    const missing = await post(
      '/api/commands',
      edit(p, [
        {
          type: 'reference.add',
          reference: {
            id: 'missing',
            name: 'Missing',
            asset: 'f'.repeat(64) + '.png',
            purpose: 'appearance',
            description: '',
          },
        },
      ]),
    );
    expect(missing.ok).toBe(false);
    expect(await get()).toEqual(p);
    for (const [mime, body] of [
      ['image/jpeg', png],
      ['image/png', Buffer.from('corrupt')],
      ['text/plain', png],
    ] as const) {
      const response = await fetch(base + '/api/references', {
        method: 'POST',
        headers: { 'content-type': mime },
        body: Uint8Array.from(body).buffer,
      });
      expect(response.ok).toBe(false);
    }
  });
  it('rejects unknown and duplicate export part selections before starting jobs', async () => {
    const p = await get();
    const before = await (await fetch(base + '/api/exports')).json();
    const selection = { entityId: 'http-truck', partId: 'cab' };
    for (const parts of [[{ ...selection, partId: 'missing' }], [selection, selection]]) {
      const response = await post('/api/exports', {
        baseRevision: p.revision,
        shotId: p.shots[0].id,
        size: 640,
        parts,
      });
      expect(response.ok).toBe(false);
    }
    expect(await (await fetch(base + '/api/exports')).json()).toEqual(before);
  });
  it('replays an identical part request receipt and rejects conflicting reuse/stale edits', async () => {
    const p = await get();
    const part = {
      ...p.entities[0].parts!.find((p) => p.id === 'cab')!,
      note: 'Verified semantic part',
    };
    const body = edit(p, [{ type: 'part.set', entityId: 'http-truck', part }]);
    const first = await post('/api/commands', body);
    expect(first.ok).toBe(true);
    const result = await first.json();
    const replay = await post('/api/commands', body);
    expect(replay.ok).toBe(true);
    expect(await replay.json()).toEqual(result);
    expect((await get()).revision).toBe(result.revision);
    const changed = await post('/api/commands', {
      ...body,
      operations: [{ type: 'part.set', entityId: 'http-truck', part: { ...part, note: 'Other' } }],
    });
    expect(changed.status).toBe(409);
    const stale = await post(
      '/api/commands',
      edit(p, [{ type: 'part.remove', entityId: 'http-truck', partId: 'cab' }]),
    );
    expect(stale.status).toBe(409);
    expect(await get()).toEqual(result);
  });
});
