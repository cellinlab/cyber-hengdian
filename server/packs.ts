import { z } from 'zod';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { projectSchema, type Project } from '../src/core/schema';
import { packs, createProject } from '../src/core/catalog';
export const packSchema = z
  .object({
    schemaVersion: z.literal('hengdian-pack/1'),
    id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    name: z.string().min(1).max(100),
    description: z.string().max(1000),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    author: z.string().min(1).max(160),
    license: z.string().min(1).max(160),
    project: projectSchema,
  })
  .strict();
export type Pack = z.infer<typeof packSchema>;
export class PackRegistry {
  constructor(public dir: string) {
    mkdirSync(dir, { recursive: true });
  }
  list() {
    return [
      ...packs.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        version: p.version,
        author: 'Cell',
        license: p.license,
        builtin: true,
      })),
      ...readdirSync(this.dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          const p = packSchema.parse(JSON.parse(readFileSync(join(this.dir, f), 'utf8')));
          const { project, ...meta } = p;
          return { ...meta, builtin: false };
        }),
    ];
  }
  install(input: unknown) {
    const p = packSchema.parse(input);
    if (packs.some((b) => b.id === p.id)) throw Error('不能覆盖内置片场');
    const file = join(this.dir, `${p.id}@${p.version}.json`);
    const bytes = JSON.stringify(p, null, 2);
    if (existsSync(file)) {
      if (readFileSync(file, 'utf8') !== bytes) throw Error('相同资源包版本内容不同，请升级版本号');
      return p;
    }
    writeFileSync(file, bytes, { flag: 'wx' });
    return p;
  }
  instantiate(id: string, version?: string): Project {
    const builtin = packs.find((p) => p.id === id);
    if (builtin) {
      if (version && version !== builtin.version) throw Error('内置片场版本不匹配');
      return createProject(id as Project['environment']);
    }
    const all = this.list().filter((p) => p.id === id && (!version || p.version === version));
    if (all.length !== 1) throw Error('请选择唯一片场版本');
    const p = packSchema.parse(
      JSON.parse(readFileSync(join(this.dir, `${id}@${all[0].version}.json`), 'utf8')),
    );
    return {
      ...p.project,
      id: crypto.randomUUID(),
      revision: 0,
      resourcePack: { id: p.id, version: p.version, sha256: this.digest(p) },
    };
  }
  digest(input: Pack) {
    return createHash('sha256')
      .update(JSON.stringify(packSchema.parse(input)))
      .digest('hex');
  }
}
