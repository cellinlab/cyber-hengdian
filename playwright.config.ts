import { defineConfig } from '@playwright/test';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const data = mkdtempSync(join(tmpdir(), 'hengdian-e2e-'));
process.env.HENGDIAN_E2E_DATA = data;
const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: join(data, 'results'),
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4331',
    viewport: { width: 1440, height: 960 },
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH || (existsSync(systemChrome) ? systemChrome : undefined),
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:4331/api/project',
    reuseExistingServer: false,
    timeout: 30_000,
    env: { PORT: '4331', HENGDIAN_DATA: data },
  },
});
