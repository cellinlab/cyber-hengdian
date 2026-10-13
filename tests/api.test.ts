import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { identity, type Project } from '../src/core/schema';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Match the default hidden workspace. Non-hidden temp paths masked 404s from sendFile.
const data = mkdtempSync(join(tmpdir(), '.hengdian-http-'));
let processUnderTest: ChildProcess | undefined;
let base: string;
let output = '';

async function start() {
  const port = await new Promise<number>((resolve, reject) => {
    const socket = createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = (socket.address() as { port: number }).port;
      socket.close(() => resolve(port));
    });
  });
  base = `http://127.0.0.1:${port}`;
  processUnderTest = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), HENGDIAN_DATA: data },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  output = '';
  processUnderTest.stdout?.on('data', (chunk) => {
    output += String(chunk);
  });
  processUnderTest.stderr?.on('data', (chunk) => {
    output += String(chunk);
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base + '/api/project')).ok) return;
    } catch {
      /* wait for listener */
    }
    if (processUnderTest.exitCode !== null) throw new Error(`Test server exited: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Test server did not start: ${output}`);
}
async function stop() {
  if (!processUnderTest || processUnderTest.exitCode !== null) return;
  const child = processUnderTest;
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
  });
  processUnderTest = undefined;
}
const getProject = async (): Promise<Project> => (await fetch(base + '/api/project')).json();
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const edit = (p: Project, name: string, requestId = crypto.randomUUID()) => ({
  requestId,
  baseRevision: p.revision,
  label: 'HTTP contract',
  operations: [{ type: 'project.update', name }],
});
function jsonGlb(json: unknown) {
  const text = JSON.stringify(json);
  const chunk = Buffer.from(text.padEnd(Math.ceil(Buffer.byteLength(text) / 4) * 4, ' '));
  const buffer = Buffer.alloc(20 + chunk.length);
  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(chunk.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  chunk.copy(buffer, 20);
  return buffer;
}

beforeAll(start);
afterAll(async () => {
  await stop();
  rmSync(data, { recursive: true, force: true });
});

describe('real local HTTP service', () => {
  it('refuses a second writer on a different port while the workspace is owned', async () => {
    const before = await getProject();
    const second = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'production', PORT: '0', HENGDIAN_DATA: data },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let diagnostic = '';
    second.stdout?.on('data', (chunk) => {
      diagnostic += String(chunk);
    });
    second.stderr?.on('data', (chunk) => {
      diagnostic += String(chunk);
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(() => {
        second.kill('SIGTERM');
        reject(new Error('Second workspace writer was not rejected'));
      }, 10_000);
      second.once('exit', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
      second.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    expect(code).not.toBe(0);
    expect(diagnostic).toContain('该工作空间已由另一个服务打开');
    expect(await getProject()).toEqual(before);
  });

  it('exposes a usable project, catalog and machine-readable schemas', async () => {
    expect((await getProject()).schemaVersion).toBe('hengdian/1');
    const catalog = await (await fetch(base + '/api/catalog')).json();
    expect(catalog.packs).toHaveLength(3);
    expect(catalog.recipes).toHaveLength(9);
    const response = await fetch(base + '/api/schema');
    expect(response.status).toBe(200);
    expect((await response.json()).project.properties.schemaVersion).toBeDefined();
  });

  it('returns 409 for stale edits, supports exact retry, and rejects conflicting request IDs', async () => {
    const before = await getProject();
    const request = edit(before, 'Human edit');
    const accepted = await post('/api/commands', request);
    expect(accepted.status).toBe(200);
    const committed = await accepted.json();
    const retry = await post('/api/commands', request);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(committed);
    expect((await post('/api/commands', edit(before, 'Stale agent'))).status).toBe(409);
    expect(
      (
        await post('/api/commands', {
          ...request,
          operations: [{ type: 'project.update', name: 'Other payload' }],
        })
      ).status,
    ).toBe(409);
    expect(await getProject()).toEqual(committed);
  });

  it('does not publish partial state from a failed batch', async () => {
    const before = await getProject();
    const response = await post('/api/commands', {
      ...edit(before, 'Must roll back'),
      operations: [
        { type: 'project.update', name: 'Must roll back' },
        { type: 'entity.remove', id: 'not-there' },
      ],
    });
    expect(response.status).toBe(400);
    expect(await getProject()).toEqual(before);
  });

  it('rejects hostile origins before any mutation, while accepting the local app origin', async () => {
    const before = await getProject();
    expect(
      (
        await post('/api/commands', edit(before, 'Foreign site'), {
          Origin: 'https://foreign.example',
        })
      ).status,
    ).toBe(403);
    expect(await getProject()).toEqual(before);
    expect(
      (await post('/api/commands', edit(before, 'Same origin'), { Origin: base })).status,
    ).toBe(200);
  });

  it('rejects imports with missing assets or unsupported schema versions without replacing work', async () => {
    const before = await getProject();
    const missing = structuredClone(before);
    missing.entities.push({
      id: 'missing-model',
      name: 'Unavailable GLB',
      kind: 'glb',
      color: '#aabbcc',
      transform: identity(),
      locked: false,
      asset: 'a'.repeat(64) + '.glb',
    });
    const response = await post('/api/import', { baseRevision: before.revision, project: missing });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('缺失模型资产');
    expect(
      (
        await post('/api/import', {
          baseRevision: before.revision,
          project: { ...before, schemaVersion: 'hengdian/999' },
        })
      ).status,
    ).toBe(400);
    expect(await getProject()).toEqual(before);
  });

  it('rejects malformed GLB uploads and broken references', async () => {
    const upload = await fetch(base + '/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'model/gltf-binary' },
      body: Buffer.from('not a GLB'),
    });
    expect(upload.status).toBe(400);
    const before = await getProject();
    const broken = structuredClone(before);
    broken.shots[0].camera.follow = 'missing';
    expect(
      (await post('/api/import', { baseRevision: before.revision, project: broken })).status,
    ).toBe(400);
    expect(await getProject()).toEqual(before);
  });

  it('stores a self-contained GLB by content hash and rejects external-resource GLBs', async () => {
    const bytes = jsonGlb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }] });
    const upload = () =>
      fetch(base + '/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'model/gltf-binary' },
        body: bytes,
      });
    const first = await upload();
    expect(first.status).toBe(200);
    const { asset } = await first.json();
    expect(asset).toMatch(/^[a-f0-9]{64}\.glb$/);
    expect(await (await upload()).json()).toEqual({ asset });
    expect(Buffer.from(await (await fetch(base + '/api/assets/' + asset)).arrayBuffer())).toEqual(
      bytes,
    );
    const external = await fetch(base + '/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'model/gltf-binary' },
      body: jsonGlb({
        asset: { version: '2.0' },
        buffers: [{ uri: 'https://example.com/private.bin', byteLength: 4 }],
      }),
    });
    expect(external.status).toBe(400);
  });

  it('rejects stale export requests before starting work', async () => {
    const before = await getProject();
    expect(
      (
        await post('/api/exports', {
          baseRevision: before.revision - 1,
          shotId: before.shots[0].id,
          size: 640,
        })
      ).status,
    ).toBe(409);
    expect(await (await fetch(base + '/api/exports')).json()).toEqual([]);
  });

  it('restores project, receipts and undo history after a real process restart', async () => {
    const before = await getProject();
    const request = edit(before, 'Survives restart');
    const committed = await (await post('/api/commands', request)).json();
    await stop();
    await start();
    expect(await getProject()).toEqual(committed);
    expect(await (await post('/api/commands', request)).json()).toEqual(committed);
    const undo = await post('/api/history/undo', { baseRevision: committed.revision });
    expect(undo.status).toBe(200);
    const undone = await undo.json();
    expect(undone.name).toBe(before.name);
    expect(undone.revision).toBe(committed.revision + 1);
    const redo = await post('/api/history/redo', { baseRevision: undone.revision });
    const redone = await redo.json();
    expect(redone.name).toBe(committed.name);
    expect(redone.revision).toBe(undone.revision + 1);
  });

  it('downloads a real completed shooting pack from a hidden workspace', async () => {
    const before = await getProject();
    const updated = await post('/api/commands', {
      ...edit(before, 'Short export'),
      operations: [{ type: 'shot.update', id: before.shots[0].id, changes: { duration: 0.5 } }],
    });
    expect(updated.status).toBe(200);
    const project = await updated.json();
    const response = await post('/api/exports', {
      baseRevision: project.revision,
      shotId: project.shots[0].id,
      size: 640,
      controls: false,
    });
    expect(response.status).toBe(202);
    let job = await response.json();
    const deadline = Date.now() + 25000;
    while (['queued', 'running'].includes(job.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      job = (await (await fetch(base + '/api/exports')).json()).find(
        (j: { id: string }) => j.id === job.id,
      );
    }
    expect(job.status, job.error).toBe('complete');
    const downloaded = await fetch(base + '/api/exports/' + job.id + '/download');
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-disposition')).toContain('attachment');
    const bytes = Buffer.from(await downloaded.arrayBuffer());
    expect(bytes).toEqual(readFileSync(join(data, 'exports', job.file)));
    const files = unzipSync(bytes);
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    expect(manifest.frameCount).toBe(12);
    expect(manifest.revision).toBe(project.revision);
    expect(files['motion.mp4'].length).toBeGreaterThan(1000);
  }, 30000);
});
