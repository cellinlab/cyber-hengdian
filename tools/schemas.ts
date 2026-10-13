import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { projectSchema, transactionSchema } from '../src/core/schema';
import { packSchema } from '../server/packs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'schemas');
const check = process.argv.includes('--check');
if (!check) mkdirSync(root, { recursive: true });
for (const [name, schema] of Object.entries({
  project: projectSchema,
  transaction: transactionSchema,
  pack: packSchema,
})) {
  const path = resolve(root, name + '.schema.json');
  const content =
    JSON.stringify(
      { $id: `urn:cyber-hengdian:${name}:1`, ...z.toJSONSchema(schema, { reused: 'ref' }) },
      null,
      2,
    ) + '\n';
  if (check) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content)
      throw Error(`Schema drift: run npm run schema (${name})`);
  } else writeFileSync(path, content);
}
console.log(
  check
    ? 'Published schemas match the runtime.'
    : 'Schemas generated. Runtime cross-reference validation remains authoritative.',
);
