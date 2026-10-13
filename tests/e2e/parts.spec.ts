import { test, expect } from '@playwright/test';
import { createProject } from '../../src/core/catalog';
import { newSetpiece } from '../../src/core/library';

import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#155daa' } })
  .png()
  .toBuffer();

test('marks truck nodes, previews masks, binds a real image, and restores reference bindings', async ({
  page,
  request,
}) => {
  const current = await (await request.get('/api/project')).json();
  const project = createProject('empty');
  const truck = newSetpiece('truck');
  project.entities = [truck];
  project.shots[0].camera = {
    from: [8, 5, 10],
    to: [8, 5, 10],
    target: [0, 1.5, 0],
    targetEnd: [0, 1.5, 0],
    fov: 45,
    follow: null,
  };
  const imported = await request.post('/api/import', {
    data: { project, baseRevision: current.revision },
  });
  expect(imported.ok()).toBeTruthy();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '场内对象 1', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(truck.name) }).click();
  await page.getByLabel('选择部件', { exact: true }).selectOption('cab');
  await page.getByRole('button', { name: '读取模型节点', exact: true }).click();
  await expect(page.getByLabel('部件名称', { exact: true })).toHaveValue('车头 · Cab');
  await page.getByLabel('部件名称', { exact: true }).fill('蓝色车头');
  await page.getByLabel('部件约束说明', { exact: true }).fill('保留车头轮廓、窗户位置；只替换车漆');
  await page.getByRole('button', { name: '保存部件', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get('/api/project')).json()).entities[0].parts.find(
          (part: { id: string }) => part.id === 'cab',
        ).name,
    )
    .toBe('蓝色车头');
  await page.getByLabel('预览通道', { exact: true }).selectOption('mask');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page
    .getByLabel('外观描述', { exact: true })
    .fill('Metallic blue cab, keep the grille and windshield.');
  await page
    .locator('.parts-inspector input[type=file]')
    .setInputFiles({ name: 'cab.png', mimeType: 'image/png', buffer: png });
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).references?.length)
    .toBe(1);
  const bound = await (await request.get('/api/project')).json();
  expect(bound.entities[0].parts.find((part: { id: string }) => part.id === 'cab').note).toBe(
    '保留车头轮廓、窗户位置；只替换车漆',
  );
  expect(
    bound.entities[0].parts.find((part: { id: string }) => part.id === 'cab').referenceIds,
  ).toEqual([bound.references[0].id]);
  await expect(page.getByRole('img', { name: 'cab.png' })).toBeVisible();
  await page.getByLabel('语言', { exact: true }).selectOption('en');
  await expect(page.getByLabel('Preview pass', { exact: true })).toHaveValue('mask');
  await page.reload();
  await page.getByRole('button', { name: 'Objects 1', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(truck.name) }).click();
  await page.getByLabel('Select part', { exact: true }).selectOption('cab');
  await expect(page.getByLabel('Bind reference cab.png')).toBeChecked();
  await page.getByRole('button', { name: 'Read model nodes', exact: true }).click();
  await expect(page.getByLabel('Part constraint notes', { exact: true })).toHaveValue(
    '保留车头轮廓、窗户位置；只替换车漆',
  );
  await page.getByRole('button', { name: 'Collapse part editor', exact: true }).click();
  await expect(page.getByLabel('Part constraint notes', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Export package', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Part mask sequences' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a stale node snapshot cannot silently overwrite concurrent edits and deleted selections reset preview', async ({
  page,
  request,
}) => {
  const current = await (await request.get('/api/project')).json();
  const project = createProject('empty');
  project.entities = [newSetpiece('truck')];
  await request.post('/api/import', { data: { project, baseRevision: current.revision } });
  await page.goto('/');
  await page.getByRole('button', { name: '场内对象 1', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(project.entities[0].name) }).click();
  await page.getByLabel('选择部件', { exact: true }).selectOption('cab');
  await page.getByRole('button', { name: '读取模型节点', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存部件', exact: true })).toBeEnabled();
  const observed = await (await request.get('/api/project')).json();
  await request.post('/api/commands', {
    data: {
      requestId: crypto.randomUUID(),
      baseRevision: observed.revision,
      label: 'concurrent name',
      operations: [
        {
          type: 'entity.update',
          id: project.entities[0].id,
          changes: { name: 'Concurrent truck' },
        },
      ],
    },
  });
  await expect(page.getByRole('button', { name: '保存部件', exact: true })).toBeDisabled();
  await page.getByLabel('预览通道', { exact: true }).selectOption('mask');
  await page.getByRole('button', { name: '删除部件', exact: true }).click();
  await expect(page.getByLabel('预览通道', { exact: true })).toHaveValue('beauty');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('ZIP import restores images and rejects missing or mismatched reference bytes before replacing the project', async ({
  page,
  request,
}) => {
  const current = await (await request.get('/api/project')).json();
  await request.post('/api/new', {
    data: { baseRevision: current.revision, environment: 'empty' },
  });
  const project = createProject('empty');
  project.name = 'Reference package';
  const truck = newSetpiece('truck');
  const asset = createHash('sha256').update(png).digest('hex') + '.png';
  const id = crypto.randomUUID();
  project.references = [
    { id, name: 'Cab material', asset, purpose: 'appearance', description: 'Blue metallic paint' },
  ];
  truck.parts![0].referenceIds = [id];
  project.entities = [truck];
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  const input = page.locator('input[type=file][accept*="zip"]');
  const upload = async (files: Record<string, Uint8Array>) =>
    input.setInputFiles({
      name: 'truck.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(zipSync(files)),
    });
  const before = await (await request.get('/api/project')).json();
  await upload({ 'project.hengdian.json': strToU8(JSON.stringify(project)) });
  await expect(page.getByRole('alert')).toContainText('工程包缺少参考图');
  expect((await (await request.get('/api/project')).json()).revision).toBe(before.revision);
  const wrong = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#aa1515' },
  })
    .png()
    .toBuffer();
  await upload({
    'project.hengdian.json': strToU8(JSON.stringify(project)),
    ['references/' + asset]: wrong,
  });
  await expect(page.getByRole('alert')).toContainText('参考图内容与工程引用不一致');
  expect((await (await request.get('/api/project')).json()).revision).toBe(before.revision);
  await upload({
    'project.hengdian.json': strToU8(JSON.stringify(project)),
    ['references/' + asset]: png,
  });
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).name)
    .toBe(project.name);
  const restored = await (await request.get('/api/project')).json();
  expect(restored.entities[0].parts[0].referenceIds).toEqual([id]);
  const image = await request.get('/api/references/' + asset);
  expect(image.ok()).toBeTruthy();
  expect(Buffer.from(await image.body())).toEqual(png);
});
