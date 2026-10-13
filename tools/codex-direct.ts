#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const promptPath = args[0];
const sessionId = args[1];
if (!promptPath || args.length > 2) {
  console.error('Usage: npm run codex:direct -- PROMPT.md [SESSION_ID]');
  process.exit(2);
}
const url = process.env.HENGDIAN_URL ?? 'http://127.0.0.1:4317';
const endpoint = new URL(url);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
  throw new Error('Only loopback Hengdian services are supported by this launcher.');
}
const before = await fetch(new URL('/api/project', url)).then((response) => {
  if (!response.ok) throw new Error(`Service unavailable: HTTP ${response.status}`);
  return response.json();
});
console.log(
  `Target: ${url} · ${before.name ?? before.project?.name ?? 'unknown project'} · revision ${before.revision ?? before.project?.revision ?? 'unknown'}`,
);
const prompt = await readFile(resolve(promptPath), 'utf8');
const runDir = resolve(
  process.env.HENGDIAN_CODEX_LOGS ?? resolve(root, '.hengdian/codex-case'),
  new Date().toISOString().replace(/[:.]/g, '-'),
);
await mkdir(runDir, { recursive: true });
await writeFile(resolve(runDir, 'before.json'), JSON.stringify(before, null, 2));
await writeFile(resolve(runDir, 'prompt.md'), prompt);
const common = [
  '--ignore-user-config',
  '--json',
  '-c',
  'approval_policy="never"',
  '-c',
  'sandbox_mode="read-only"',
  '-c',
  `mcp_servers.hengdian.command=${JSON.stringify(process.execPath)}`,
  '-c',
  `mcp_servers.hengdian.args=${JSON.stringify([
    resolve(root, 'node_modules/tsx/dist/cli.mjs'),
    resolve(root, 'tools/mcp.ts'),
  ])}`,
  '-c',
  `mcp_servers.hengdian.env.HENGDIAN_URL=${JSON.stringify(url)}`,
  '-c',
  'mcp_servers.hengdian.required=true',
  '-c',
  'mcp_servers.hengdian.tool_timeout_sec=120',
  // The directing brief authorizes these local actions for this invocation only.
  '-c',
  'mcp_servers.hengdian.tools.apply_operations.approval_mode="approve"',
  '-c',
  'mcp_servers.hengdian.tools.create_export.approval_mode="approve"',
  '-c',
  'mcp_servers.hengdian.tools.use_scene_template.approval_mode="approve"',
  '-c',
  'mcp_servers.hengdian.tools.add_assembly.approval_mode="approve"',
  '-o',
  resolve(runDir, 'final.md'),
];
const command = sessionId
  ? ['--no-daemon', '-C', root, 'exec', 'resume', ...common, sessionId, '-']
  : ['--no-daemon', '-C', root, 'exec', ...common, '--color', 'never', '-'];
const run = {
  service: url,
  prompt: resolve(promptPath),
  resume: sessionId ?? null,
  startedAt: new Date().toISOString(),
  actualSessionId: null as string | null,
  finishedAt: null as string | null,
  exitCode: null as number | null,
  launchError: null as string | null,
};
await writeFile(resolve(runDir, 'run.json'), JSON.stringify(run, null, 2));
console.log(`Codex evidence: ${runDir}`);
console.log(
  'This directing run authorizes scene templates, assemblies, apply_operations and create_export only on the displayed local service; shell remains read-only.',
);
const child = spawn(process.env.CODEX_BIN ?? 'codex', command, {
  cwd: root,
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
});
const events = createWriteStream(resolve(runDir, 'events.jsonl'));
const errors = createWriteStream(resolve(runDir, 'stderr.log'));
child.stdout.pipe(events);
child.stderr.pipe(errors);
// Keep image/base64 tool payloads out of terminal output; raw evidence stays local.
let pending = '';
child.stdout.on('data', (data: Buffer) => {
  pending += data.toString();
  let boundary: number;
  while ((boundary = pending.indexOf('\n')) >= 0) {
    const line = pending.slice(0, boundary);
    pending = pending.slice(boundary + 1);
    try {
      const event = JSON.parse(line);
      if (event.type === 'thread.started') {
        run.actualSessionId = event.thread_id;
        console.log(`Session: ${event.thread_id}`);
      } else if (
        event.type === 'turn.completed' ||
        event.type === 'turn.failed' ||
        event.type === 'error'
      )
        console.log(JSON.stringify(event));
      else if (event.item?.type === 'mcp_tool_call')
        console.log(
          `${event.type}: ${event.item.server}.${event.item.tool} [${event.item.status ?? 'unknown'}${event.item.result?.isError ? ', tool error' : ''}]${event.item.error?.message ? ' ' + event.item.error.message : ''}`,
        );
      else if (event.item?.type === 'agent_message' && event.type === 'item.completed')
        console.log(event.item.text);
    } catch {
      // Original line remains in events.jsonl, including non-JSON diagnostics.
    }
  }
});
child.stdin.on('error', (error) => {
  errors.write(`stdin: ${error.message}\n`);
});
child.stdin.end(prompt);
const exitCode = await new Promise<number>((done) => {
  child.on('error', (error) => {
    run.launchError = error.message;
    errors.write(error.message + '\n');
    console.error(`Could not start Codex: ${error.message}`);
    done(1);
  });
  child.on('close', (code) => done(code ?? 1));
});
try {
  const after = await fetch(new URL('/api/project', url)).then((response) => response.json());
  await writeFile(resolve(runDir, 'after.json'), JSON.stringify(after, null, 2));
} finally {
  run.finishedAt = new Date().toISOString();
  run.exitCode = exitCode;
  await writeFile(resolve(runDir, 'run.json'), JSON.stringify(run, null, 2));
  console.log(
    `Codex process exit: ${exitCode}. This is not creative-task acceptance; inspect final.md and before/after.json. Evidence: ${runDir}`,
  );
}
process.exitCode = exitCode;
