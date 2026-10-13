import express from 'express';
import { createHash } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Store } from './store';
import { Exports } from './exporter';
import { PackRegistry, packSchema } from './packs';
import { lockWorkspace } from './lock';
import { preview } from './preview';
import { storeGlb } from './assets';
import { packs, props, recipes, createProject } from '../src/core/catalog';
import {
  assetLibrary,
  assemblies,
  sceneTemplates,
  createSceneTemplate,
  instantiateAssembly,
} from '../src/core/library';
import { posePresets, jointDefinitions } from '../src/core/actor';
import { projectSchema, operationSchema, environmentSchema, vec3 } from '../src/core/schema';
import { inspect, Conflict } from '../src/core/project';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4317);
const data = resolve(process.env.HENGDIAN_DATA || join(root, '.hengdian'));
const assets = join(data, 'assets');
mkdirSync(assets, { recursive: true });
lockWorkspace(data);
const store = new Store(data);
const app = express();
const exporter = new Exports(join(data, 'exports'), assets, `http://127.0.0.1:${port}`);
const registry = new PackRegistry(join(data, 'packs'));
const streams = new Set<express.Response>();
app.use((req, res, next) => {
  const host = req.headers.host?.split(':')[0];
  if (!['127.0.0.1', 'localhost'].includes(host ?? '')) {
    res.status(403).json({ error: 'Local connections only' });
    return;
  }
  const origin = req.headers.origin;
  if (origin && !['http://127.0.0.1:' + port, 'http://localhost:' + port].includes(origin)) {
    res.status(403).json({ error: 'Cross-origin requests are not allowed' });
    return;
  }
  next();
});
app.post('/api/assets', express.raw({ type: 'model/gltf-binary', limit: '50mb' }), (req, res) => {
  if (!Buffer.isBuffer(req.body)) throw Error('Content-Type must be model/gltf-binary');
  res.json({ asset: storeGlb(req.body, assets) });
});
app.use(express.json({ limit: '8mb' }));
const checkAssets = (p: ReturnType<typeof projectSchema.parse>) => {
  for (const e of p.entities)
    if (e.asset && !existsSync(join(assets, e.asset)))
      throw Error(`缺失模型资产 ${e.asset}，请导入完整工程包`);
};
const publish = () => {
  for (const res of streams)
    res.write(`data: ${JSON.stringify({ revision: store.project.revision })}\n\n`);
};
app.get('/api/project', (_, res) => res.json(store.project));
app.get('/api/catalog', (_, res) =>
  res.json({
    packs,
    props,
    recipes,
    assets: assetLibrary,
    assemblies,
    sceneTemplates,
    posePresets,
    jointDefinitions,
  }),
);
app.get('/api/schema', (_, res) =>
  res.json({
    project: z.toJSONSchema(projectSchema),
    operation: z.toJSONSchema(operationSchema),
    pack: z.toJSONSchema(packSchema),
  }),
);
app.get('/api/inspect', (_, res) => res.json(inspect(store.project)));
app.get('/api/packs', (_, res) => res.json(registry.list()));
app.post('/api/packs', (req, res) => {
  const pack = packSchema.parse(req.body.pack);
  checkAssets(pack.project);
  registry.install(pack);
  res.json({ id: pack.id, version: pack.version, sha256: registry.digest(pack) });
});
app.post('/api/packs/:id/instantiate', (req, res) => {
  const p = registry.instantiate(req.params.id, req.body.version);
  checkAssets(p);
  res.json(store.replace(p, z.number().int().parse(req.body.baseRevision), '载入片场包'));
  publish();
});
app.post('/api/scenes/:id/instantiate', (req, res) => {
  const input = z.object({ baseRevision: z.number().int().nonnegative() }).strict().parse(req.body);
  const definition = sceneTemplates.find((item) => item.id === req.params.id);
  if (!definition) throw Error('Unknown scene template');
  res.json(
    store.replace(createSceneTemplate(definition.id), input.baseRevision, 'Load scene template'),
  );
  publish();
});
app.post('/api/assemblies/:id/instantiate', (req, res) => {
  const input = z
    .object({
      baseRevision: z.number().int().nonnegative(),
      requestId: z.string(),
      position: vec3.default([0, 0, 0]),
    })
    .strict()
    .parse(req.body);
  const definition = assemblies.find((item) => item.id === req.params.id);
  if (!definition) throw Error('Unknown assembly');
  const entities = instantiateAssembly(definition.id, input.position).map((entity, index) => ({
    ...entity,
    id:
      'assembly-' +
      createHash('sha256')
        .update(input.requestId + ':' + index)
        .digest('hex')
        .slice(0, 32),
  }));
  res.json(
    store.transact({
      baseRevision: input.baseRevision,
      requestId: input.requestId,
      label: 'Add assembly',
      operations: entities.map((entity) => ({ type: 'entity.add', entity })),
    }),
  );
  publish();
});
app.get('/api/history', (_, res) => res.json(store.history()));
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();
  res.write(': connected\n\n');
  streams.add(res);
  const timer = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => {
    streams.delete(res);
    clearInterval(timer);
  });
});
app.post('/api/commands', (req, res) => {
  for (const op of req.body.operations ?? []) {
    const asset =
      op.type === 'entity.add'
        ? op.entity?.asset
        : op.type === 'entity.update'
          ? op.changes?.asset
          : null;
    if (asset && (!/^[a-f0-9]{64}\.glb$/.test(asset) || !existsSync(join(assets, asset))))
      throw Error('模型资产不存在');
  }
  res.json(store.transact(req.body));
  publish();
});
app.post('/api/import', (req, res) => {
  const p = projectSchema.parse(req.body.project);
  checkAssets(p);
  res.json(store.replace(p, z.number().int().parse(req.body.baseRevision)));
  publish();
});
app.post('/api/new', (req, res) => {
  const environment = environmentSchema.parse(req.body.environment);
  res.json(
    store.replace(
      createProject(environment),
      z.number().int().parse(req.body.baseRevision),
      '更换片场',
    ),
  );
  publish();
});
app.post('/api/history/:direction', (req, res) => {
  const direction = z.enum(['undo', 'redo']).parse(req.params.direction);
  res.json(store.travel(direction, z.number().int().parse(req.body.baseRevision)));
  publish();
});
app.get('/api/assets/:file', (req, res) => {
  if (!/^[a-f0-9]{64}\.glb$/.test(req.params.file)) {
    res.sendStatus(400);
    return;
  }
  // The workspace defaults to .hengdian; only this hash-validated asset is exposed.
  res.sendFile(join(assets, req.params.file), { dotfiles: 'allow' });
});
app.post('/api/preview', async (req, res) => {
  const input = z
    .object({ shotId: z.string(), time: z.number().finite().nonnegative().default(0) })
    .parse(req.body);
  res.json(await preview(store.project, input.shotId, input.time, `http://127.0.0.1:${port}`));
});
app.get('/api/exports', (_, res) => res.json(exporter.list()));
app.post('/api/exports', (req, res) => {
  const input = z
    .object({
      baseRevision: z.number().int(),
      shotId: z.string(),
      size: z.union([z.literal(640), z.literal(1280)]).default(1280),
      controls: z.boolean().default(false),
    })
    .parse(req.body);
  const p = store.project;
  if (p.revision !== input.baseRevision) throw new Conflict('工程已更新，请刷新后导出');
  res.status(202).json(exporter.start(p, input.shotId, input.size, input.controls));
});
app.post('/api/exports/:id/cancel', (req, res) => res.json(exporter.cancel(req.params.id)));
app.get('/api/exports/:id/download', (req, res) => {
  const j = exporter.jobs.get(req.params.id);
  if (j?.status !== 'complete' || !j.file) {
    res.status(404).json({ error: '尚无已完成文件' });
    return;
  }
  res.download(join(exporter.dir, j.file), 'hengdian-' + j.id.slice(0, 8) + '.zip', {
    dotfiles: 'allow',
  });
});
app.use('/api', (_, res) => res.status(404).json({ error: 'Unknown API route' }));
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  res.status(error.status || 400).json({
    error:
      error instanceof z.ZodError
        ? error.issues.map((i) => i.message).join('; ')
        : error.message || '请求失败',
  }),
);
const server = createHttpServer(app);
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(root, 'dist')));
  app.get('/{*path}', (_, res) => res.sendFile(join(root, 'dist/index.html')));
} else {
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
server.listen(port, '127.0.0.1', () => console.log(`Cyber Hengdian → http://127.0.0.1:${port}`));
server.on('error', (e) => {
  console.error(e.message);
  process.exit(1);
});
