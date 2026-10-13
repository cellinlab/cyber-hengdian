import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { resolve } from 'node:path';

async function ready(page: Page) {
  await expect(page.getByLabel('三维片场')).toBeVisible();
  await expect(page.getByText('正在布置片场…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

async function seek(page: Page, time: number) {
  await page.getByLabel('镜头时间', { exact: true }).evaluate((element, time) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      String(time),
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, time);
}

test.beforeEach(async ({ request }) => {
  const project = await (await request.get('/api/project')).json();
  const response = await request.post('/api/new', {
    data: { baseRevision: project.revision, environment: 'courtyard' },
  });
  expect(response.ok()).toBeTruthy();
});

test('renders a real scene, switches camera views and navigates shots without browser errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  const variety = await page.getByLabel('三维片场').evaluate(async (element) => {
    const source = element as HTMLCanvasElement;
    const image = new Image();
    image.src = source.toDataURL();
    await image.decode();
    const probe = document.createElement('canvas');
    probe.width = 48;
    probe.height = 32;
    const ctx = probe.getContext('2d')!;
    ctx.drawImage(image, 0, 0, 48, 32);
    const pixels = ctx.getImageData(0, 0, 48, 32).data;
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4)
      colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    return colors.size;
  });
  expect(variety).toBeGreaterThan(30);
  await page.getByRole('button', { name: '自由布置', exact: true }).click();
  await expect(page.getByRole('button', { name: '将此视角设为镜头起点 ↗' })).toBeVisible();
  await page.getByRole('button', { name: '摄影机', exact: true }).click();
  await page.getByRole('button', { name: /缓慢推进.*运动镜头/ }).click();
  await expect(page.getByLabel('镜头名称', { exact: true })).toHaveValue('缓慢推进');
  await seek(page, 3);
  await expect(page.getByLabel('镜头时间', { exact: true })).toHaveValue('3');
  await page.getByRole('button', { name: '播放镜头' }).click();
  await expect(page.getByRole('button', { name: '暂停播放' })).toBeVisible();
  await page.getByRole('button', { name: '暂停播放' }).click();
  expect(errors).toEqual([]);
});

test('adds and edits an object, creates shot-local motion and preserves the edit after reload', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: '演员', exact: true }).click();
  await expect(page.getByLabel('对象名称', { exact: true })).toHaveValue('演员');
  await page.getByLabel('对象名称', { exact: true }).fill('林间旅人');
  await page.getByLabel('对象名称', { exact: true }).press('Enter');
  await expect
    .poll(async () =>
      (await (await request.get('/api/project')).json()).entities.some(
        (e: { name: string }) => e.name === '林间旅人',
      ),
    )
    .toBe(true);
  await seek(page, 3);
  await page.getByLabel('位置 X', { exact: true }).fill('5');
  await page.getByLabel('位置 X', { exact: true }).press('Enter');
  await expect
    .poll(async () => {
      const p = await (await request.get('/api/project')).json();
      const actor = p.entities.find((e: { name: string }) => e.name === '林间旅人');
      return p.shots[0].tracks[actor.id]?.map((key: { time: number }) => key.time);
    })
    .toEqual([0, 3]);
  const p = await (await request.get('/api/project')).json();
  const actor = p.entities.find((e: { name: string }) => e.name === '林间旅人');
  expect(p.shots[1].tracks[actor.id]).toBeUndefined();
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: /场内对象/ }).click();
  await page.getByRole('button', { name: '林间旅人 ACTOR' }).click();
  await expect(page.getByLabel('对象名称', { exact: true })).toHaveValue('林间旅人');
  await expect(page.getByRole('button', { name: '跳到 3 秒关键帧' })).toBeVisible();
});

test('changes scene packs and undoes the replacement', async ({ page, request }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await ready(page);
  for (const [label, environment] of [
    ['无界摄影棚', 'studio'],
    ['旷野公路', 'exterior'],
  ] as const) {
    await page.getByRole('button', { name: new RegExp(label) }).click();
    await expect
      .poll(async () => (await (await request.get('/api/project')).json()).environment)
      .toBe(environment);
    await ready(page);
  }
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).environment)
    .toBe('studio');
  await ready(page);
});

test('saves a time-addressed note and opens the generation handoff without pretending it is complete', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await ready(page);
  await seek(page, 2);
  await page.getByRole('button', { name: /^批注/ }).click();
  await page.getByLabel('批注内容').fill('镜头停顿，让观众看到人物反应。');
  await page.getByRole('button', { name: '保存到当前时刻' }).click();
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).notes.length)
    .toBe(1);
  expect((await (await request.get('/api/project')).json()).notes[0].time).toBe(2);
  await page.getByRole('button', { name: '关闭窗口' }).click();
  await page.getByRole('button', { name: /导出.*拍摄包/ }).click();
  await expect(page.getByRole('dialog', { name: '把这个镜头带走' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始导出拍摄包' })).toBeEnabled();
  await expect(page.getByRole('link', { name: '下载 ZIP' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('imports a self-contained handoff ZIP without losing subject identity or camera relationships', async ({
  page,
  request,
}) => {
  const project = await (await request.get('/api/project')).json();
  const positions = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const document = JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: positions.length }],
    bufferViews: [{ buffer: 0, byteLength: positions.length }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
  });
  const json = Buffer.from(document.padEnd(Math.ceil(document.length / 4) * 4, ' '));
  const glb = Buffer.alloc(28 + json.length + positions.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  json.copy(glb, 20);
  glb.writeUInt32LE(positions.length, 20 + json.length);
  glb.writeUInt32LE(0x004e4942, 24 + json.length);
  positions.copy(glb, 28 + json.length);
  const asset = createHash('sha256').update(glb).digest('hex') + '.glb';
  const subject = project.entities[0];
  const stableId = subject.id;
  Object.assign(subject, {
    name: '可迁移主体',
    kind: 'glb',
    asset,
    source: 'Test triangle',
    license: 'CC0-1.0',
  });
  project.name = '来自另一个片场的工程';
  project.shots[0].camera.follow = stableId;
  project.shots[0].tracks[stableId] = [
    { ...subject.transform, time: 0 },
    { ...subject.transform, position: [1, 0, 0], time: 1 },
  ];
  const bytes = zipSync({
    'project.hengdian.json': strToU8(JSON.stringify(project)),
    ['assets/' + asset]: glb,
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await ready(page);
  await page
    .getByLabel('导入工程文件')
    .setInputFiles({ name: 'scene.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).name)
    .toBe(project.name);
  await ready(page);
  const restored = await (await request.get('/api/project')).json();
  expect(restored.entities[0].id).toBe(stableId);
  expect(restored.entities[0].asset).toBe(asset);
  expect(restored.shots[0].camera.follow).toBe(stableId);
  expect(restored.shots[0].tracks[stableId]).toEqual(project.shots[0].tracks[stableId]);
  expect((await request.get('/api/assets/' + asset)).ok()).toBeTruthy();
});

test('supports mobile resource and inspector panels without page-width overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await ready(page);
  const canvas = await page.getByLabel('三维片场').boundingBox();
  expect(canvas!.width).toBeGreaterThan(250);
  expect(canvas!.height).toBeGreaterThan(150);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.getByRole('button', { name: '资源', exact: true }).click();
  await page.getByRole('button', { name: '演员', exact: true }).click();
  await page.getByRole('button', { name: '检查器', exact: true }).click();
  await expect(page.getByLabel('对象名称', { exact: true })).toBeVisible();
  await page.getByLabel('对象名称', { exact: true }).fill('移动端演员');
  await page.getByLabel('对象名称', { exact: true }).press('Enter');
  await expect(page.getByLabel('对象名称', { exact: true })).toHaveValue('移动端演员');
  await page.getByRole('button', { name: '检查器', exact: true }).click();
  await expect(page.getByLabel('三维片场')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test('replaces a subject through the inspector while preserving its identity, follow and motion', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await ready(page);
  const before = await (await request.get('/api/project')).json();
  const id = before.entities[0].id;
  await page.getByLabel('跟随主体', { exact: true }).selectOption(id);
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).shots[0].camera.follow)
    .toBe(id);
  await page.getByRole('button', { name: /场内对象/ }).click();
  await page
    .getByRole('button', { name: `${before.entities[0].name} ACTOR`, exact: true })
    .first()
    .click();
  await seek(page, 2);
  await page.getByLabel('位置 X', { exact: true }).fill('4');
  await page.getByLabel('位置 X', { exact: true }).press('Enter');
  await expect
    .poll(
      async () => (await (await request.get('/api/project')).json()).shots[0].tracks[id]?.length,
    )
    .toBe(2);
  const animated = await (await request.get('/api/project')).json();
  await expect(page.getByLabel('替换对象类型')).toBeEnabled();
  await page.getByLabel('替换对象类型').selectOption('product');
  await expect
    .poll(
      async () =>
        (await (await request.get('/api/project')).json()).entities.find(
          (e: { id: string }) => e.id === id,
        )?.kind,
    )
    .toBe('product');
  const replaced = await (await request.get('/api/project')).json();
  expect(replaced.entities.length).toBe(before.entities.length);
  expect(replaced.shots[0].camera.follow).toBe(id);
  expect(replaced.shots[0].tracks[id]).toEqual(animated.shots[0].tracks[id]);
  await ready(page);
});

test('installs the example resource pack from JSON and keeps it reusable after restoring the previous scene', async ({
  page,
  request,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await ready(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /导入片场包/ }).click();
  await (await chooser).setFiles(resolve('examples/tabletop.pack.json'));
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).resourcePack?.id)
    .toBe('tabletop-demo');
  const installed = await (await request.get('/api/project')).json();
  expect(installed.environment).toBe('studio');
  expect(installed.resourcePack.version).toBe('1.0.0');
  expect(installed.resourcePack.sha256).toMatch(/^[a-f0-9]{64}$/);
  await expect(page.getByRole('button', { name: /桌面产品.*Cell/ })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).environment)
    .toBe('courtyard');
  await page.getByRole('button', { name: /桌面产品.*Cell/ }).click();
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).resourcePack?.id)
    .toBe('tabletop-demo');
  await ready(page);
});
