import { chromium } from '@playwright/test';
import { browserOptions } from './exporter';
import { evaluate } from '../src/core/project';
import type { Project } from '../src/core/schema';
let pending = 0;
let queue = Promise.resolve();
export async function preview(project: Project, shotId: string, time: number, base: string) {
  const shot = project.shots.find((s) => s.id === shotId);
  if (!shot) throw Error('镜头不存在');
  if (time < 0 || time > shot.duration) throw Error('预览时间超出镜头');
  // Agents commonly request start/middle/end in parallel. Serialize Chromium
  // work, retaining each caller's immutable project snapshot and a bounded queue.
  if (pending >= 4)
    throw Object.assign(Error('预览队列已满（最多 4 张），请等待已有预览完成'), { status: 429 });
  pending++;
  const preceding = queue;
  let release!: () => void;
  queue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await preceding;
  try {
    return await renderPreview(project, shotId, time, base);
  } finally {
    pending--;
    release();
  }
}

async function renderPreview(project: Project, shotId: string, time: number, base: string) {
  const shot = project.shots.find((s) => s.id === shotId)!;
  let browser;
  try {
    const ratio = project.aspect === '16:9' ? 16 / 9 : project.aspect === '9:16' ? 9 / 16 : 1;
    const w = ratio >= 1 ? 640 : Math.round(640 * ratio),
      h = ratio >= 1 ? Math.round(640 / ratio) : 640;
    browser = await chromium.launch(browserOptions());
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(base + '/render');
    await page.waitForFunction(() => !!(window as any).hengdianRender);
    await page.evaluate(
      async ({ project, w, h }) => (window as any).hengdianRender.load(project, w, h),
      { project, w, h },
    );
    const image = await page.evaluate(
      ({ shotId, time }) => (window as any).hengdianRender.frame(shotId, time, 'rgb'),
      { shotId, time },
    );
    const framing = await page.evaluate(() => (window as any).hengdianRender.inspect());
    return {
      framing,
      revision: project.revision,
      shotId,
      time,
      width: w,
      height: h,
      mimeType: 'image/png',
      image,
      camera: evaluate(project, shot, time).camera,
    };
  } finally {
    await browser?.close();
  }
}
