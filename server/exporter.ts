import { chromium, type Browser } from '@playwright/test';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
  renameSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { getPartMap, type PartSelection } from '../src/core/parts';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import type { Project } from '../src/core/schema';
import { evaluate } from '../src/core/project';
export type ExportJob = {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  file?: string;
  revision: number;
  shotId: string;
  created: string;
};
export const browserOptions = () => ({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    (process.platform === 'darwin' &&
    existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined),
});
export class Exports {
  jobs = new Map<string, ExportJob>();
  active: string | null = null;
  private browsers = new Map<string, Browser>();
  private encoders = new Map<string, ChildProcess>();
  constructor(
    public dir: string,
    public assets: string,
    public base: string,
  ) {
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8')) as ExportJob;
      if (j.status === 'running' || j.status === 'queued') {
        j.status = 'failed';
        j.error = '服务重启，任务未完成；请重新导出';
      }
      this.jobs.set(j.id, j);
      this.save(j);
    }
  }
  private save(j: ExportJob) {
    const file = join(this.dir, j.id + '.json');
    writeFileSync(file + '.tmp', JSON.stringify(j));
    renameSync(file + '.tmp', file);
  }
  list() {
    return [...this.jobs.values()].reverse();
  }
  cancel(id: string) {
    const j = this.jobs.get(id);
    if (!j) throw Error('任务不存在');
    if (j.status === 'running' || j.status === 'queued') {
      j.status = 'cancelled';
      this.save(j);
      void this.browsers.get(id)?.close();
      this.encoders.get(id)?.kill('SIGTERM');
    }
    return j;
  }
  start(
    project: Project,
    shotId: string,
    size: number,
    controls: boolean,
    parts: PartSelection[] = [],
  ) {
    if (this.active) throw Error('已有导出任务进行中');
    if (!project.shots.some((s) => s.id === shotId)) throw Error('镜头不存在');
    if (
      controls &&
      Math.round(project.shots.find((s) => s.id === shotId)!.duration * Number(project.fps)) > 720
    )
      throw Error('首版完整控制通道最多 720 帧，请缩短镜头或降低帧率');
    const map = getPartMap(project);
    const keys = parts.map((s) => s.entityId + '/' + s.partId);
    if (
      parts.length > 16 ||
      new Set(keys).size !== keys.length ||
      parts.some((s) => !map.some((p) => p.entityId === s.entityId && p.partId === s.partId))
    )
      throw Error('Select up to 16 existing, unique parts');
    if (
      parts.length &&
      Math.round(project.shots.find((s) => s.id === shotId)!.duration * Number(project.fps)) > 720
    )
      throw Error('Part masks support up to 720 frames');
    const id = randomUUID();
    const j: ExportJob = {
      id,
      status: 'queued',
      progress: 0,
      revision: project.revision,
      shotId,
      created: new Date().toISOString(),
    };
    this.jobs.set(id, j);
    this.active = id;
    this.save(j);
    void this.run(j, structuredClone(project), size, controls, structuredClone(parts));
    return j;
  }
  private async run(
    j: ExportJob,
    p: Project,
    size: number,
    controls: boolean,
    parts: PartSelection[],
  ) {
    const frames = join(this.dir, j.id + '-frames');
    mkdirSync(frames);
    let browser: Browser | undefined;
    try {
      j.status = 'running';
      this.save(j);
      const shot = p.shots.find((s) => s.id === j.shotId)!;
      const ratio = p.aspect === '16:9' ? 16 / 9 : p.aspect === '9:16' ? 9 / 16 : 1;
      const w = ratio >= 1 ? size : Math.round((size * ratio) / 2) * 2;
      const h = ratio >= 1 ? Math.round(size / ratio / 2) * 2 : size;
      browser = await chromium.launch(browserOptions());
      this.browsers.set(j.id, browser);
      const page = await browser.newPage({
        viewport: { width: w, height: h },
        deviceScaleFactor: 1,
      });
      await page.goto(this.base + '/render');
      await page.waitForFunction(() => !!(window as any).hengdianRender);
      await page.evaluate(
        async ({ p, w, h }) => {
          await (window as any).hengdianRender.load(p, w, h);
        },
        { p, w, h },
      );
      const fps = Number(p.fps),
        count = Math.round(shot.duration * fps);
      const files: Record<string, Uint8Array> = {};
      const cameraFrames: unknown[] = [];
      for (let i = 0; i < count; i++) {
        if ((j.status as string) === 'cancelled') throw Error('cancelled');
        const time = i / fps;
        const frame = String(i).padStart(6, '0');
        for (const pass of [
          ...(controls ? ['rgb', 'depth', 'id'] : ['rgb']),
          ...(parts.length ? ['part-id'] : []),
        ]) {
          const data = Buffer.from(
            await page.evaluate(
              ({ shotId, time, pass }) => (window as any).hengdianRender.frame(shotId, time, pass),
              { shotId: shot.id, time, pass },
            ),
            'base64',
          );
          if (pass === 'rgb') {
            writeFileSync(join(frames, frame + '.png'), data);
            if ([0, Math.floor(count / 2), count - 1].includes(i))
              files[`keyframes/${frame}.png`] = data;
          } else files[`${pass}/${frame}.png`] = data;
        }
        for (const selection of parts) {
          const data = Buffer.from(
            await page.evaluate(
              ({ shotId, time, selection }) =>
                (window as any).hengdianRender.frame(shotId, time, 'mask', selection),
              { shotId: shot.id, time, selection },
            ),
            'base64',
          );
          files[`masks/${selection.entityId}/${selection.partId}/${frame}.png`] = data;
        }
        cameraFrames.push({ frame: i, time, ...evaluate(p, shot, time).camera });
        j.progress = Math.round(((i + 1) / count) * 90);
        if (i % 10 === 0) this.save(j);
      }
      await browser.close();
      this.browsers.delete(j.id);
      if ((j.status as string) === 'cancelled') throw Error('cancelled');
      const video = join(frames, 'motion.mp4');
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', [
          '-y',
          '-loglevel',
          'error',
          '-framerate',
          String(fps),
          '-i',
          join(frames, '%06d.png'),
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          video,
        ]);
        this.encoders.set(j.id, child);
        let error = '';
        child.stderr.on('data', (d) => (error += d.toString()));
        child.on('error', () => reject(Error('找不到 FFmpeg，请安装后重试')));
        child.on('exit', (code) =>
          code === 0 ? resolve() : reject(Error(error || '视频编码失败')),
        );
      });
      if ((j.status as string) === 'cancelled') throw Error('cancelled');
      files['motion.mp4'] = readFileSync(video);
      files['project.hengdian.json'] = strToU8(JSON.stringify(p, null, 2));
      files['camera.json'] = strToU8(JSON.stringify(cameraFrames));
      for (const e of p.entities)
        if (e.asset) files['assets/' + e.asset] = readFileSync(join(this.assets, e.asset));
      for (const ref of p.references ?? [])
        files['references/' + ref.asset] = readFileSync(
          join(dirname(this.assets), 'references', ref.asset),
        );
      files['references.json'] = strToU8(
        JSON.stringify(
          {
            references: p.references ?? [],
            bindings: p.entities.map((e) => ({
              entityId: e.id,
              referenceIds: e.referenceIds ?? [],
              parts: (e.parts ?? []).map((part) => ({
                partId: part.id,
                name: part.name,
                referenceIds: part.referenceIds ?? [],
                note: part.note ?? '',
              })),
            })),
          },
          null,
          2,
        ),
      );
      files['README.txt'] = strToU8(
        `Cyber Hengdian production handoff\nShot: ${shot.name}\nIntent: ${shot.intent}\nThis is a 3D previsualization reference, not AI-generated final footage.\nImport this ZIP into Cyber Hengdian to restore the editable project and GLB assets.\nGeneration services differ: only supply depth/ID/part-mask sequences when the chosen workflow supports them.\nAppearance images are originals, with per-part bindings in references.json; they are not geometry or motion controls.\nMasks describe visible opaque surfaces; they do not guarantee structure locking in a video generator.\n`,
      );
      files['manifest.json'] = strToU8(
        JSON.stringify(
          {
            schemaVersion: 'hengdian-handoff/1',
            projectId: p.id,
            revision: p.revision,
            shotId: shot.id,
            width: w,
            height: h,
            fps,
            frameCount: count,
            duration: count / fps,
            sourceDuration: shot.duration,
            resourcePack: p.resourcePack,
            proceduralRuntime: {
              actorRig: 'hengdian-humanoid/1',
              setpieces: 'hengdian-setpieces/1',
              license: 'MIT',
              modelIds: [...new Set(p.entities.flatMap((e) => (e.modelId ? [e.modelId] : [])))],
              note: 'Procedural geometry is recreated by the compatible Cyber Hengdian runtime; no standalone mesh files are embedded for built-in models.',
            },
            units: 'meters',
            coordinates: 'right-handed Y-up',
            pack: { id: p.environment, version: p.packVersion, license: 'MIT' },
            depth: controls
              ? {
                  encoding: 'linear view-space 8-bit grayscale',
                  near: 0.05,
                  far: 200,
                  background: 255,
                  transparency: 'opaque geometry',
                }
              : null,
            objectIds: controls
              ? Object.fromEntries(
                  p.entities.map((e, i) => [
                    e.id,
                    { value: i + 1, hex: '#' + (i + 1).toString(16).padStart(6, '0') },
                  ]),
                )
              : null,
            parts: parts.length
              ? {
                  encoding: '24-bit lossless RGB integer ID; black=unassigned/background',
                  visibility: 'visible opaque surfaces, depth occlusion preserved',
                  frameSequence: 'part-id/%06d.png',
                  mapping: getPartMap(p),
                  masks: parts.map((selection) => ({
                    ...selection,
                    frameSequence: `masks/${selection.entityId}/${selection.partId}/%06d.png`,
                    encoding: '8-bit black/white RGB; white=visible selected part',
                  })),
                }
              : null,
            references: (p.references ?? []).map((ref) => ({
              ...ref,
              path: 'references/' + ref.asset,
            })),
            assets: p.entities
              .filter((e) => e.asset)
              .map((e) => ({
                file: e.asset,
                source: e.source,
                license: e.license ?? 'unspecified',
              })),
            files: Object.fromEntries(
              Object.entries(files).map(([name, bytes]) => [
                name,
                { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
              ]),
            ),
          },
          null,
          2,
        ),
      );
      const final = join(this.dir, j.id + '.zip');
      writeFileSync(final + '.tmp', zipSync(files, { level: 1 }));
      renameSync(final + '.tmp', final);
      j.file = j.id + '.zip';
      j.progress = 100;
      j.status = 'complete';
    } catch (e) {
      if ((j.status as string) !== 'cancelled') {
        j.status = 'failed';
        j.error = e instanceof Error ? e.message : String(e);
      }
    } finally {
      await browser?.close().catch(() => {});
      this.browsers.delete(j.id);
      this.encoders.delete(j.id);
      rmSync(frames, { recursive: true, force: true });
      this.save(j);
      this.active = null;
    }
  }
}
