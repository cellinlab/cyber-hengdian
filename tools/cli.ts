#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { transactionSchema } from '../src/core/schema';
import { request } from './client';

const help = `Cyber Hengdian — one service, shared project state
Usage: npm run cli -- COMMAND [arguments]
  status                         Inspect the live project
  catalog                        List stage packs, props, shot recipes
  schema                         Read project and operation JSON schemas
  project [--out FILE]            Read project JSON (exclusive file creation)
  apply FILE                     Apply a transaction JSON file
  new PACK --base-revision N
                                 Replace current project with courtyard/studio/exterior
  packs                          List built-in and installed stage packs
  install-pack FILE              Install a pack manifest (referenced GLBs must exist)
  use-pack ID --base-revision N [--version X.Y.Z]
                                 Instantiate a pack, replacing current project
  preview --shot ID [--time 0] --out FILE.png
                                 Render a real frame and save PNG without overwriting
  inspect                        Validate and summarize live project
  export SHOT --base-revision N [--size 640|1280] [--controls]
                                 Start a snapshot export; returns job, not completed media
  jobs                           List export jobs and actual status
  cancel JOB                     Cancel an export job
  --help                         Show this help
HENGDIAN_URL defaults to http://127.0.0.1:4317.
Apply requires requestId, baseRevision, label, operations. Read → edit → verify.
409 is a conflict: re-read and decide; never blindly retry with a new revision.
`;
function options(args: string[], allowed: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  while (args.length) {
    const key = args.shift()!;
    if (!allowed.includes(key) || key in out) throw Error(`Unknown or duplicate option: ${key}`);
    if (key === '--controls') out[key] = true;
    else { const value = args.shift(); if (!value || value.startsWith('--')) throw Error(`Missing value for ${key}`); out[key] = value; }
  }
  return out;
}
function revision(value: string | boolean | undefined): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw Error('--base-revision must be an explicit nonnegative integer');
  return Number(value);
}
function required(value: string | undefined, name: string): string { if (!value || value.startsWith('--')) throw Error(`Missing ${name}`); return value; }
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === '--help' || command === 'help' || !command) { process.stdout.write(help); return; }
  let result: unknown;
  switch (command) {
    case 'status': case 'inspect': case 'catalog': case 'schema': case 'jobs': {
      options(args, []);
      result = await request('/api/' + ({ status: 'inspect', inspect: 'inspect', catalog: 'catalog', schema: 'schema', jobs: 'exports' }[command])); break;
    }
    case 'project': {
      const opts = options(args, ['--out']); result = await request('/api/project');
      if (opts['--out']) { await writeFile(String(opts['--out']), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); result = { saved: opts['--out'] }; } break;
    }
    case 'apply': {
      const file = required(args.shift(), 'transaction file'); options(args, []);
      const tx = transactionSchema.parse(JSON.parse(await readFile(file, 'utf8')));
      result = await request('/api/commands', tx); break;
    }
    case 'new': {
      const environment = required(args.shift(), 'pack');
      if (!['courtyard', 'studio', 'exterior'].includes(environment)) throw Error('Unknown pack');
      const opts = options(args, ['--base-revision']);
      result = await request('/api/new', { environment, baseRevision: revision(opts['--base-revision']) }); break;
    }
    case 'packs': { options(args, []); result = await request('/api/packs'); break; }
    case 'install-pack': { const file = required(args.shift(), 'pack file'); options(args, []); result = await request('/api/packs', { pack: JSON.parse(await readFile(file, 'utf8')) }); break; }
    case 'use-pack': { const id = required(args.shift(), 'pack ID'); const opts = options(args, ['--base-revision', '--version']); if (opts['--version'] && !/^\d+\.\d+\.\d+$/.test(String(opts['--version']))) throw Error('--version must be X.Y.Z'); result = await request('/api/packs/' + encodeURIComponent(id) + '/instantiate', { baseRevision: revision(opts['--base-revision']), version: opts['--version'] }); break; }
    case 'preview': {
      const opts = options(args, ['--shot', '--time', '--out']);
      const shotId = required(typeof opts['--shot'] === 'string' ? opts['--shot'] : undefined, '--shot');
      const out = required(typeof opts['--out'] === 'string' ? opts['--out'] : undefined, '--out');
      const time = Number(opts['--time'] ?? 0); if (!Number.isFinite(time) || time < 0) throw Error('--time must be nonnegative seconds');
      const preview = z.object({ revision: z.number(), shotId: z.string(), time: z.number(), width: z.number(), height: z.number(), mimeType: z.literal('image/png'), image: z.string(), camera: z.unknown() }).parse(await request('/api/preview', { shotId, time }, 45000));
      const { image, ...metadata } = preview;
      await writeFile(out, Buffer.from(image, 'base64'), { flag: 'wx' }); result = { ...metadata, saved: out }; break;
    }
    case 'export': {
      const shotId = required(args.shift(), 'shot ID'); const opts = options(args, ['--base-revision', '--size', '--controls']);
      const size = Number(opts['--size'] || 1280); if (![640, 1280].includes(size)) throw Error('--size must be 640 or 1280');
      result = await request('/api/exports', { shotId, baseRevision: revision(opts['--base-revision']), size, controls: !!opts['--controls'] }); break;
    }
    case 'cancel': { const id = required(args.shift(), 'job ID'); options(args, []); result = await request('/api/exports/' + encodeURIComponent(id) + '/cancel', {}); break; }
    default: throw Error(`Unknown command: ${command}. Use --help.`);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
main().catch(error => { process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n'); process.exitCode = 1; });
