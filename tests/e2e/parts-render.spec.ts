import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { createProject, newEntity } from '../../src/core/catalog';
import { newSetpiece } from '../../src/core/library';
import { getPartMap } from '../../src/core/parts';
import { identity, type Project } from '../../src/core/schema';
const fixture = () => {
  const p = createProject('empty');
  const truck = newSetpiece('truck');
  truck.id = 'render-truck';
  p.entities = [truck];
  p.shots = [p.shots[0]];
  p.shots[0].camera = {
    from: [8, 5, 10],
    to: [8, 5, 10],
    target: [0, 1.4, 0],
    targetEnd: [0, 1.4, 0],
    fov: 45,
    follow: null,
  };
  return p;
};
const load = (page: Page, p: Project) =>
  page.evaluate(async (p) => (window as any).hengdianRender.load(p, 480, 270), p);
const frame = (page: Page, p: Project, pass: string, time = 0, partId?: string) =>
  page.evaluate(
    ({ id, pass, time, selection }) =>
      (window as any).hengdianRender.frame(id, time, pass, selection),
    {
      id: p.shots[0].id,
      pass,
      time,
      selection: partId ? { entityId: 'render-truck', partId } : undefined,
    },
  );
async function pixels(base64: string) {
  return sharp(Buffer.from(base64, 'base64')).removeAlpha().raw().toBuffer();
}
function value(data: Buffer, i: number) {
  return data[i] * 65536 + data[i + 1] * 256 + data[i + 2];
}
async function validateMasks(page: Page, p: Project, requireVisible = true) {
  const id = await pixels(await frame(page, p, 'part-id'));
  const map = getPartMap(p);
  const allowed = new Set([0, ...map.map((e) => e.value)]);
  let total = 0;
  for (let i = 0; i < id.length; i += 3)
    if (!allowed.has(value(id, i)))
      throw Error(`Unmapped Part ID pixel ${value(id, i)} at ${i / 3}`);
  for (const part of map) {
    const mask = await pixels(await frame(page, p, 'mask', 0, part.partId));
    let white = 0;
    for (let i = 0; i < mask.length; i += 3) {
      const m = value(mask, i);
      if (m !== 0 && m !== 0xffffff) throw Error(`Nonbinary mask pixel ${m}`);
      if ((m === 0xffffff) !== (value(id, i) === part.value))
        throw Error(`Part ID / mask disagreement ${part.partId} pixel ${i / 3}`);
      if (m === 0xffffff) white++;
    }
    if (requireVisible) expect(white).toBeGreaterThan(0);
    total += white;
  }
  return total;
}
test('exact Part ID pixels equal every binary mask and retain foreground occlusion', async ({
  page,
}) => {
  const p = fixture();
  await page.goto('/render');
  await page.waitForFunction(() => !!(window as any).hengdianRender);
  await load(page, p);
  const baseline = await validateMasks(page, p);
  const occluder = newEntity('box', [3, 2, 4]);
  occluder.transform.scale = [3.5, 4, 1];
  p.entities.push(occluder);
  await load(page, p);
  const hidden = await validateMasks(page, p, false);
  expect(hidden).toBeGreaterThan(0);
  expect(hidden).toBeLessThan(baseline);
});
test('parts stay stable across color changes and reorder while arbitrary seeking reproduces RGB', async ({
  page,
}) => {
  const p = fixture();
  await page.goto('/render');
  await page.waitForFunction(() => !!(window as any).hengdianRender);
  await load(page, p);
  const initial = await frame(page, p, 'part-id');
  const map = getPartMap(p);
  p.entities[0].color = '#2255ee';
  const offscreen = newEntity('box', [40, 0, 0]);
  p.entities.unshift(offscreen);
  await load(page, p);
  expect(getPartMap(p)).toEqual(map);
  expect(await frame(page, p, 'part-id')).toBe(initial);
  const shot = p.shots[0];
  shot.tracks['render-truck'] = [
    { ...identity([-1, 0, 0]), time: 0 },
    { ...identity([1, 0, 0.5]), time: shot.duration },
  ];
  await load(page, p);
  const first = await frame(page, p, 'rgb', 1.25);
  const later = await frame(page, p, 'rgb', 4);
  expect(first).not.toBe(later);
  await frame(page, p, 'part-id', 2);
  await frame(page, p, 'mask', 2, 'cab');
  await frame(page, p, 'highlight', 3, 'cargo');
  expect(await frame(page, p, 'rgb', 1.25)).toBe(first);
  expect(await frame(page, p, 'rgb', 4)).toBe(later);
});
function duplicateNamesGlb() {
  const positions = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 2, 0]);
  const binary = Buffer.from(positions.buffer);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Duplicate', children: [1, 2] },
      { name: 'Duplicate', mesh: 0, translation: [-2, 0, 0] },
      { name: 'Duplicate', mesh: 0, translation: [2, 0, 0] },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binary.length }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [-1, 0, 0],
        max: [1, 2, 0],
      },
    ],
  };
  const source = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(source.length / 4) * 4, 32);
  source.copy(padded);
  const out = Buffer.alloc(28 + padded.length + binary.length);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(padded.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(out, 20);
  out.writeUInt32LE(binary.length, 20 + padded.length);
  out.writeUInt32LE(0x004e4942, 24 + padded.length);
  binary.copy(out, 28 + padded.length);
  return out;
}
test('a real GLB with duplicate node names has stable child paths and rejects a missing selector', async ({
  page,
  request,
}) => {
  const uploaded = await request.post('/api/assets', {
    headers: { 'content-type': 'model/gltf-binary' },
    data: duplicateNamesGlb(),
  });
  expect(uploaded.ok()).toBe(true);
  const { asset } = await uploaded.json();
  const p = fixture();
  const e = newEntity('box');
  e.id = 'render-truck';
  e.kind = 'glb';
  e.asset = asset;
  e.parts = [
    { id: 'left', name: 'Left', members: ['0/0/0'] },
    { id: 'right', name: 'Right', members: ['0/0/1'] },
  ];
  p.entities = [e];
  await page.goto('/render');
  await page.waitForFunction(() => !!(window as any).hengdianRender);
  await load(page, p);
  const nodes = await page.evaluate(() => (window as any).hengdianRender.nodes('render-truck'));
  expect(nodes.map((n: any) => n.key)).toEqual(['0/0/0', '0/0/1']);
  await validateMasks(page, p);
  await load(page, p);
  expect(await page.evaluate(() => (window as any).hengdianRender.nodes('render-truck'))).toEqual(
    nodes,
  );
  p.entities[0].parts![0].members = ['0/0/99'];
  await expect(load(page, p)).rejects.toThrow('Unknown mesh selector');
});
