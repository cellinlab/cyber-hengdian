import { expect, test } from '@playwright/test';
import { createProject } from '../../src/core/catalog';
import { identity } from '../../src/core/schema';

test('renders a resting actor after arrival and reproduces the same frame when scrubbing backward', async ({
  page,
}) => {
  const project = createProject();
  project.entities = [project.entities[0]];
  delete project.entities[0].actor; // Exercise the pre-rig legacy locomotion path.
  const shot = project.shots[0];
  shot.camera = {
    from: [0, 1.4, 4],
    to: [0, 1.4, 4],
    target: [0, 0.9, 0],
    targetEnd: [0, 0.9, 0],
    fov: 45,
    follow: null,
  };
  shot.tracks[project.entities[0].id] = [
    { ...identity([-1, 0, 0]), time: 0 },
    { ...identity([0, 0, 0]), time: 3 },
    { ...identity([0, 0, 0]), time: 6 },
  ];
  await page.goto('/render');
  await page.waitForFunction(() => !!(window as any).hengdianRender);
  await page.evaluate(
    async (project) => (window as any).hengdianRender.load(project, 640, 360),
    project,
  );
  const frame = (time: number) =>
    page.evaluate(({ id, time }) => (window as any).hengdianRender.frame(id, time, 'rgb'), {
      id: shot.id,
      time,
    });
  const travelling = await frame(1.3);
  const resting = await frame(4);
  expect(await frame(4.8)).toBe(resting);
  expect(await frame(1.3)).toBe(travelling);
  expect(travelling).not.toBe(resting);
});
