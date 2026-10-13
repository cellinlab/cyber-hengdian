import { expect, test } from '@playwright/test';
import { createProject } from '../../src/core/catalog';
import { posePresets } from '../../src/core/actor';

test('directs an actor through visible joint controls, keeps pose keys after reload and switches languages', async ({
  page,
  request,
}) => {
  const current = await (await request.get('/api/project')).json();
  await request.post('/api/new', {
    data: { baseRevision: current.revision, environment: 'courtyard' },
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '场内对象 4', exact: true }).click();
  await page.getByRole('button', { name: /演员 A/ }).click();
  await page.getByLabel('姿势预设', { exact: true }).selectOption('sit');
  await expect
    .poll(
      async () =>
        (await (await request.get('/api/project')).json()).entities[0].actor.pose.rootOffset[1],
    )
    .toBe(-0.43);
  await page.getByRole('button', { name: '保存姿态关键帧', exact: true }).click();
  await page.getByLabel('镜头时间', { exact: true }).fill('2');
  await page.getByLabel('姿势预设', { exact: true }).selectOption('wave');
  await expect
    .poll(async () => {
      const p = await (await request.get('/api/project')).json();
      return p.shots[0].poseTracks?.[p.entities[0].id]?.length;
    })
    .toBe(2);
  const before = await (await request.get('/api/project')).json();
  expect(before.shots[0].poseTracks[before.entities[0].id][1].pose).toEqual(
    posePresets.find((p) => p.id === 'wave')!.pose,
  );
  await page.getByLabel('语言', { exact: true }).selectOption('en');
  await expect(page.getByRole('button', { name: 'Export package', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Language', { exact: true })).toHaveValue('en');
  expect((await (await request.get('/api/project')).json()).shots).toEqual(before.shots);
  await expect(page.getByRole('button', { name: /午后的一次相遇/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('loads a scene, adds a searchable model and an assembly, and restores edits with undo', async ({
  page,
  request,
}) => {
  const current = await (await request.get('/api/project')).json();
  await request.post('/api/new', {
    data: { baseRevision: current.revision, environment: 'courtyard' },
  });
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.getByRole('tab', { name: '场景模板', exact: true }).click();
  await page.getByRole('button', { name: /CLASSROOM 窗边教室/ }).click();
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).environment)
    .toBe('empty');
  const base = await (await request.get('/api/project')).json();
  await page.getByRole('tab', { name: '模型资产', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索资源' }).fill('Eiffel');
  await page.getByRole('button', { name: /埃菲尔铁塔/ }).click();
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).entities.length)
    .toBe(base.entities.length + 1);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).entities.length)
    .toBe(base.entities.length);
  await page.getByRole('button', { name: '资源库', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索资源' }).fill('');
  await page.getByRole('tab', { name: '组合布景', exact: true }).click();
  await page.getByRole('button', { name: /街角咖啡座/ }).click();
  await expect
    .poll(async () => (await (await request.get('/api/project')).json()).entities.length)
    .toBeGreaterThan(base.entities.length);
});

test('renders articulated motion deterministically, with a visibly different keyed pose', async ({
  page,
}) => {
  const p = createProject('empty');
  const actor = createProject().entities[0];
  actor.transform.position = [0, 0, 0];
  p.entities = [actor];
  const shot = p.shots[0];
  shot.camera = {
    from: [0, 1, 4],
    to: [0, 1, 4],
    target: [0, 0.9, 0],
    targetEnd: [0, 0.9, 0],
    fov: 45,
    follow: null,
  };
  shot.poseTracks = {
    [actor.id]: [
      { time: 0, pose: posePresets[0].pose },
      { time: 2, pose: posePresets.find((p) => p.id === 'wave')!.pose },
    ],
  };
  await page.goto('/render');
  await page.waitForFunction(() => !!(window as any).hengdianRender);
  await page.evaluate(async (p) => (window as any).hengdianRender.load(p, 640, 360), p);
  const frame = (time: number) =>
    page.evaluate(({ id, time }) => (window as any).hengdianRender.frame(id, time, 'rgb'), {
      id: shot.id,
      time,
    });
  const neutral = await frame(0),
    wave = await frame(2);
  expect(neutral).not.toBe(wave);
  expect(await frame(0)).toBe(neutral);
  expect(await frame(5)).toBe(wave);
});
