import { rmSync } from 'node:fs';
import { join } from 'node:path';

export default function teardown() {
  const dir = process.env.HENGDIAN_E2E_DATA;
  if (!dir) return;
  // Keep browser failure evidence in /tmp; remove the isolated workspace state.
  for (const name of ['workspace.json', 'workspace.json.tmp', 'assets', 'exports', 'packs']) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}
