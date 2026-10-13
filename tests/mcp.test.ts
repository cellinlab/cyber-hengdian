import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Project } from '../src/core/schema';

const root = resolve(import.meta.dirname, '..');
let service: ChildProcess;
let client: Client;
let transport: StdioClientTransport;
let dataDir: string;
let base: string;
let logs = '';
const exec = promisify(execFile);
const cli = (...args: string[]) =>
  exec(process.execPath, ['--import', 'tsx', resolve(root, 'tools/cli.ts'), ...args], {
    cwd: root,
    env: { ...process.env, HENGDIAN_URL: base },
    timeout: 15000,
  });
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No port');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
function textData(result: Awaited<ReturnType<Client['callTool']>>): any {
  const content = result.content as { type: string; text?: string }[];
  return JSON.parse(content.find((c) => c.type === 'text')!.text!);
}
beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'hengdian-mcp-'));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  service = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    // Render current source through Vite; a clean checkout has no dist yet.
    env: { ...process.env, PORT: String(port), HENGDIAN_DATA: dataDir, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  service.stdout?.on('data', (chunk) => {
    logs += chunk.toString();
  });
  service.stderr?.on('data', (chunk) => {
    logs += chunk.toString();
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (service.exitCode !== null) throw Error('Service exited: ' + logs);
    try {
      if ((await fetch(base + '/api/project')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw Error('Service did not start: ' + logs);
  transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', resolve(root, 'tools/mcp.ts')],
    cwd: root,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
      ),
      HENGDIAN_URL: base,
    },
    stderr: 'pipe',
  });
  client = new Client({ name: 'hengdian-integration-test', version: '1.0.0' });
  await client.connect(transport);
}, 20000);
afterAll(async () => {
  await client?.close();
  if (service && service.exitCode === null) {
    const exited = new Promise<void>((resolve) => service.once('exit', () => resolve()));
    service.kill('SIGTERM');
    await exited;
  }
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

describe('real HTTP service through MCP stdio', () => {
  it('discovers typed tools and exposes authoritative project resource', async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'read_project',
        'list_catalog',
        'get_schema',
        'apply_operations',
        'inspect_project',
        'create_export',
        'list_exports',
        'cancel_export',
        'list_packs',
        'use_pack',
        'preview_shot',
      ]),
    );
    const edit = tools.tools.find((t) => t.name === 'apply_operations')!;
    expect(edit.inputSchema.required).toEqual(
      expect.arrayContaining(['requestId', 'baseRevision', 'label', 'operations']),
    );
    // Codex parses `items` as one schema, not draft-7's tuple array. Validate
    // the actual wire schema so SDK/Zod changes cannot silently hide editing.
    const numericTuples: number[] = [];
    function checkItems(value: unknown) {
      if (!value || typeof value !== 'object') return;
      const schema = value as Record<string, any>;
      if ('items' in schema) {
        expect(Array.isArray(schema.items)).toBe(false);
        expect(schema.items).toBeTypeOf('object');
        if (schema.items.type === 'number' && schema.minItems === schema.maxItems) {
          numericTuples.push(schema.minItems);
        }
      }
      for (const child of Object.values(value)) checkItems(child);
    }
    checkItems(edit.inputSchema);
    expect(numericTuples).toContain(3);
    expect(numericTuples).toContain(4);
    const resources = await client.listResources();
    expect(resources.resources[0].uri).toBe('hengdian://project');
    const resource = await client.readResource({ uri: 'hengdian://project' });
    const resourceText = resource.contents[0] as { text: string };
    expect(JSON.parse(resourceText.text)).toEqual(
      await (await fetch(base + '/api/project')).json(),
    );
    const catalog = textData(await client.callTool({ name: 'list_catalog', arguments: {} }));
    expect(catalog.packs).toHaveLength(3);
    const schema = textData(await client.callTool({ name: 'get_schema', arguments: {} }));
    expect(schema.project.properties.schemaVersion.const).toBe('hengdian/1');
  });

  it('returns only the requested schema without changing the default response', async () => {
    const all = textData(await client.callTool({ name: 'get_schema', arguments: {} }));
    for (const scope of ['project', 'operation', 'pack']) {
      const selected = await client.callTool({ name: 'get_schema', arguments: { scope } });
      expect(selected.isError).not.toBe(true);
      expect(textData(selected)).toEqual({ [scope]: all[scope] });
      expect(selected.structuredContent).toEqual({ data: { [scope]: all[scope] } });
    }
    const invalid = await client.callTool({ name: 'get_schema', arguments: { scope: 'unknown' } });
    expect(invalid.isError).toBe(true);
  });

  it('preserves tuple, quaternion and scale validation with the host-compatible schema', async () => {
    const project = textData(
      await client.callTool({ name: 'read_project', arguments: {} }),
    ) as Project;
    for (const transform of [
      { position: [0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      { position: [0, 0, 0], rotation: [0, 0, 0, 2], scale: [1, 1, 1] },
      { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [0, 1, 1] },
    ]) {
      const invalidTransform = await client.callTool({
        name: 'apply_operations',
        arguments: {
          requestId: 'invalid-transform',
          label: 'Invalid transform must not persist',
          baseRevision: project.revision,
          operations: [
            { type: 'entity.update', id: project.entities[0].id, changes: { transform } },
          ],
        },
      });
      expect(invalidTransform.isError).toBe(true);
    }
    expect(await (await fetch(base + '/api/project')).json()).toEqual(project);
  });

  it('delivers an actual PNG and framing metadata together without changing the project', async () => {
    const project = textData(
      await client.callTool({ name: 'read_project', arguments: {} }),
    ) as Project;
    const shot = project.shots[0];
    const result = await client.callTool({
      name: 'preview_shot',
      arguments: { shotId: shot.id, time: shot.duration / 2 },
    });
    expect(result.isError).not.toBe(true);
    const content = result.content as { type: string; data?: string; mimeType?: string }[];
    const image = content.find((item) => item.type === 'image');
    expect(image?.mimeType).toBe('image/png');
    const png = Buffer.from(image!.data!, 'base64');
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const metadata = textData(result);
    expect(png.readUInt32BE(16)).toBe(metadata.width);
    expect(png.readUInt32BE(20)).toBe(metadata.height);
    expect(metadata).toMatchObject({
      revision: project.revision,
      shotId: shot.id,
      time: shot.duration / 2,
    });
    expect(metadata.framing.map((entry: { id: string }) => entry.id).sort()).toEqual(
      project.entities.map((entity) => entity.id).sort(),
    );
    for (const entry of metadata.framing) {
      expect(typeof entry.intersectsFrame).toBe('boolean');
      expect(
        Object.values(entry.screenBounds).every(
          (value) => typeof value === 'number' && Number.isFinite(value),
        ),
      ).toBe(true);
      expect(entry.note).toContain('occlusion');
    }
    expect(result.structuredContent).toEqual(metadata);
    expect(metadata).not.toHaveProperty('image');
    expect(await (await fetch(base + '/api/project')).json()).toEqual(project);
  }, 45000);

  it('queues parallel start/middle/end previews and returns each requested time and snapshot', async () => {
    const project = textData(
      await client.callTool({ name: 'read_project', arguments: {} }),
    ) as Project;
    const shot = project.shots[0];
    const times = [0, shot.duration / 2, shot.duration - 1 / Number(project.fps)];
    const results = await Promise.all(
      times.map((time) =>
        client.callTool({ name: 'preview_shot', arguments: { shotId: shot.id, time } }),
      ),
    );
    for (let i = 0; i < results.length; i++) {
      expect(results[i].isError).not.toBe(true);
      expect(textData(results[i])).toMatchObject({
        revision: project.revision,
        shotId: shot.id,
        time: times[i],
      });
      expect((results[i].content as { type: string }[]).some((c) => c.type === 'image')).toBe(true);
    }
  }, 45000);

  it('edits the shared project, replays safely, rejects stale writes and malformed operations', async () => {
    const project = textData(
      await client.callTool({ name: 'read_project', arguments: {} }),
    ) as Project;
    const tx = {
      requestId: 'mcp-test-rename',
      baseRevision: project.revision,
      label: 'MCP integration rename',
      operations: [{ type: 'project.update', name: 'Shared MCP edit' }],
    };
    const applied = await client.callTool({ name: 'apply_operations', arguments: tx });
    expect(applied.isError).not.toBe(true);
    const saved = (await (await fetch(base + '/api/project')).json()) as Project;
    expect(saved.name).toBe('Shared MCP edit');
    expect(saved.revision).toBe(project.revision + 1);
    const replay = await client.callTool({ name: 'apply_operations', arguments: tx });
    expect(replay.isError).not.toBe(true);
    expect((await (await fetch(base + '/api/project')).json()).revision).toBe(saved.revision);
    const conflict = await client.callTool({
      name: 'apply_operations',
      arguments: { ...tx, requestId: 'stale-mcp-edit' },
    });
    expect(conflict.isError).toBe(true);
    expect(textData(conflict).status).toBe(409);
    const invalid = await client.callTool({
      name: 'apply_operations',
      arguments: {
        ...tx,
        requestId: 'bad-mcp-edit',
        baseRevision: saved.revision,
        operations: [{ type: 'execute.javascript', code: 'no' }],
      },
    });
    expect(invalid.isError).toBe(true);
    const inspection = textData(await client.callTool({ name: 'inspect_project', arguments: {} }));
    expect(inspection.revision).toBe(saved.revision);
  });

  it('discovers scene and rig capabilities, appends assemblies idempotently and directs a pose', async () => {
    const catalog = textData(await client.callTool({ name: 'list_catalog', arguments: {} }));
    expect(catalog.assets).toHaveLength(31);
    expect(catalog.sceneTemplates).toHaveLength(5);
    expect(catalog.jointDefinitions).toHaveLength(17);
    const before = textData(
      await client.callTool({ name: 'read_project', arguments: {} }),
    ) as Project;
    const loaded = await client.callTool({
      name: 'use_scene_template',
      arguments: { id: 'classroom', baseRevision: before.revision },
    });
    expect(loaded.isError).not.toBe(true);
    const classroom = textData(loaded) as Project;
    expect(classroom.environment).toBe('empty');
    const args = {
      id: 'hospital-bay',
      baseRevision: classroom.revision,
      requestId: 'assembly-integration',
      position: [10, 0, 0],
    };
    const appended = await client.callTool({ name: 'add_assembly', arguments: args });
    expect(appended.isError).not.toBe(true);
    const replay = await client.callTool({ name: 'add_assembly', arguments: args });
    expect(replay.isError).not.toBe(true);
    expect(textData(replay)).toEqual(textData(appended));
    const current = textData(appended) as Project;
    expect(current.entities.length).toBeGreaterThan(classroom.entities.length);
    const actor = current.entities.find((e) => e.actor)!;
    const posed = await client.callTool({
      name: 'apply_operations',
      arguments: {
        requestId: 'pose-integration',
        baseRevision: current.revision,
        label: 'Direct actor',
        operations: [
          {
            type: 'pose.set',
            shotId: current.shots[0].id,
            entityId: actor.id,
            key: { time: 0, pose: catalog.posePresets.find((p: any) => p.id === 'point').pose },
          },
        ],
      },
    });
    expect(posed.isError).not.toBe(true);
    expect(textData(posed).shots[0].poseTracks[actor.id][0].pose).toEqual(
      catalog.posePresets.find((p: any) => p.id === 'point').pose,
    );
    const stale = await client.callTool({
      name: 'use_scene_template',
      arguments: { id: 'hospital', baseRevision: before.revision },
    });
    expect(stale.isError).toBe(true);
    expect(textData(stale).status).toBe(409);
  });

  it('returns export validation and missing-job errors rather than invented success', async () => {
    const project = textData(
      await client.callTool({ name: 'read_project', arguments: {} }),
    ) as Project;
    const rejected = await client.callTool({
      name: 'create_export',
      arguments: { baseRevision: project.revision, shotId: 'missing', size: 640, controls: false },
    });
    expect(rejected.isError).toBe(true);
    const preview = await client.callTool({
      name: 'preview_shot',
      arguments: { shotId: 'missing', time: 0 },
    });
    expect(preview.isError).toBe(true);
    expect(textData(preview).status).toBe(400);
    expect(textData(preview).error).toContain('镜头不存在');
    const cancel = await client.callTool({ name: 'cancel_export', arguments: { id: 'missing' } });
    expect(cancel.isError).toBe(true);
    const jobs = textData(await client.callTool({ name: 'list_exports', arguments: {} }));
    expect(jobs).toEqual([]);
  });
});

describe('CLI shared-state integration', () => {
  it('reads, saves without overwriting, applies explicit transactions and returns nonzero conflicts', async () => {
    expect((await cli('--help')).stdout).toContain('base-revision');
    expect(JSON.parse((await cli('status')).stdout).valid).toBe(true);
    expect(JSON.parse((await cli('catalog')).stdout).recipes).toHaveLength(9);
    expect(JSON.parse((await cli('schema')).stdout).pack.properties.schemaVersion.const).toBe(
      'hengdian-pack/1',
    );
    const p = JSON.parse((await cli('project')).stdout) as Project;
    const file = join(dataDir, 'cli-project.json');
    await cli('project', '--out', file);
    expect(JSON.parse(await readFile(file, 'utf8')).revision).toBe(p.revision);
    await expect(cli('project', '--out', file)).rejects.toMatchObject({ code: 1 });
    const transaction = join(dataDir, 'cli-transaction.json');
    await writeFile(
      transaction,
      JSON.stringify({
        requestId: 'cli-rename',
        baseRevision: p.revision,
        label: 'CLI rename',
        operations: [{ type: 'project.update', name: 'CLI shared edit' }],
      }),
    );
    await cli('apply', transaction);
    expect(textData(await client.callTool({ name: 'read_project', arguments: {} })).name).toBe(
      'CLI shared edit',
    );
    await expect(cli('new', 'studio')).rejects.toMatchObject({ code: 1 });
    await expect(cli('new', 'studio', '--base-revision', String(p.revision))).rejects.toMatchObject(
      { code: 1 },
    );
    await expect(cli('not-a-command')).rejects.toMatchObject({ code: 1 });
  });
});

describe('external pack client round trip', () => {
  it('installs versions through CLI and requires an explicit choice through MCP', async () => {
    const p = textData(await client.callTool({ name: 'read_project', arguments: {} })) as Project;
    const file = join(dataDir, 'test-pack.json');
    const pack = {
      schemaVersion: 'hengdian-pack/1',
      id: 'mcp-test-pack',
      name: 'Test pack',
      description: 'Protocol fixture',
      version: '1.0.0',
      author: 'Test',
      license: 'MIT',
      project: p,
    };
    await writeFile(file, JSON.stringify(pack));
    await cli('install-pack', file);
    await writeFile(file, JSON.stringify({ ...pack, version: '2.0.0' }));
    await cli('install-pack', file);
    expect(
      JSON.parse((await cli('packs')).stdout).filter((pack: any) => pack.id === 'mcp-test-pack'),
    ).toHaveLength(2);
    const result = await client.callTool({
      name: 'use_pack',
      arguments: { id: pack.id, baseRevision: p.revision },
    });
    expect(result.isError).toBe(true);
    const chosen = await client.callTool({
      name: 'use_pack',
      arguments: { id: pack.id, baseRevision: p.revision, version: '1.0.0' },
    });
    expect(chosen.isError).not.toBe(true);
    expect(textData(chosen).resourcePack.version).toBe('1.0.0');
    const next = textData(chosen).revision;
    const output = JSON.parse(
      (await cli('use-pack', pack.id, '--base-revision', String(next), '--version', '2.0.0'))
        .stdout,
    );
    expect(output.resourcePack.version).toBe('2.0.0');
  });
});
