import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { unzipSync, strFromU8 } from 'fflate';
import { projectSchema } from '../src/core/schema';
import { evaluate } from '../src/core/project';
import { getPartMap } from '../src/core/parts';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Browser canvas exports non-interlaced 8-bit RGB/RGBA PNGs. Decode their exact
// pixels here: screenshots/colour-management conversions would corrupt ID values.
export function decodePng(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  check(b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'Invalid PNG signature');
  const width = b.readUInt32BE(16),
    height = b.readUInt32BE(20);
  const channels = b[25] === 6 ? 4 : b[25] === 2 ? 3 : 0;
  check(b[24] === 8 && channels && b[28] === 0, 'Expected 8-bit non-interlaced RGB/RGBA PNG');
  check(width > 0 && height > 0 && width * height <= 4096 * 4096, 'Unsupported PNG dimensions');
  const chunks: Buffer[] = [];
  for (let offset = 8; offset + 12 <= b.length;) {
    const size = b.readUInt32BE(offset);
    check(offset + size + 12 <= b.length, 'Truncated PNG chunk');
    if (b.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(b.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: (stride + 1) * height });
  check(raw.length === (stride + 1) * height, 'Unexpected PNG pixel length');
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    check(filter <= 4, 'Unknown PNG filter');
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= channels ? pixels[i - channels] : 0;
      const up = y ? pixels[i - stride] : 0;
      const c = y && x >= channels ? pixels[i - stride - channels] : 0;
      const p = a + up - c;
      const pa = Math.abs(p - a),
        pb = Math.abs(p - up),
        pc = Math.abs(p - c);
      const predictor =
        filter === 1
          ? a
          : filter === 2
            ? up
            : filter === 3
              ? Math.floor((a + up) / 2)
              : filter === 4
                ? pa <= pb && pa <= pc
                  ? a
                  : pb <= pc
                    ? up
                    : c
                : 0;
      pixels[i] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}

export function verifyPackFiles(files: Record<string, Uint8Array>) {
  const json = (name: string) => {
    check(files[name], `Missing ${name}`);
    return JSON.parse(strFromU8(files[name]));
  };
  const manifest = json('manifest.json');
  check(manifest.schemaVersion === 'hengdian-handoff/1', 'Unsupported handoff version');
  const listed = Object.keys(manifest.files).sort();
  check(
    JSON.stringify(listed) ===
      JSON.stringify(
        Object.keys(files)
          .filter((n) => n !== 'manifest.json')
          .sort(),
      ),
    'Manifest file list differs from ZIP',
  );
  for (const name of listed) {
    check(files[name].length === manifest.files[name].bytes, `Size mismatch: ${name}`);
    check(hash(files[name]) === manifest.files[name].sha256, `SHA-256 mismatch: ${name}`);
  }
  const project = projectSchema.parse(json('project.hengdian.json'));
  const shot = project.shots.find((s) => s.id === manifest.shotId);
  check(shot, 'Manifest shot missing from project');
  check(
    project.id === manifest.projectId && project.revision === manifest.revision,
    'Project identity/revision mismatch',
  );
  const fps = Number(project.fps),
    count = Math.round(shot.duration * fps);
  check(
    manifest.fps === fps &&
      manifest.frameCount === count &&
      manifest.duration === count / fps &&
      manifest.sourceDuration === shot.duration,
    'Frame timing mismatch',
  );
  const cameras = json('camera.json');
  check(Array.isArray(cameras) && cameras.length === count, 'Camera frame count mismatch');
  for (let i = 0; i < count; i++) {
    const expected = { frame: i, time: i / fps, ...evaluate(project, shot, i / fps).camera };
    check(
      JSON.stringify(cameras[i]) === JSON.stringify(expected),
      `Camera differs from project at frame ${i}`,
    );
  }
  const controls = manifest.depth !== null;
  check((manifest.objectIds !== null) === controls, 'Control metadata mismatch');
  const allowedIds = new Set([0]);
  if (controls) {
    check(
      Object.keys(manifest.objectIds).length === project.entities.length,
      'Object ID map count mismatch',
    );
    project.entities.forEach((e, i) => {
      check(
        manifest.objectIds[e.id]?.value === i + 1 &&
          manifest.objectIds[e.id]?.hex === '#' + (i + 1).toString(16).padStart(6, '0'),
        `Object ID map mismatch: ${e.id}`,
      );
      allowedIds.add(i + 1);
    });
  }
  const expectedKeys = [...new Set([0, Math.floor(count / 2), count - 1])];
  for (const [folder, frames] of [
    ['keyframes', expectedKeys],
    ['depth', controls ? Array.from({ length: count }, (_, i) => i) : []],
    ['id', controls ? Array.from({ length: count }, (_, i) => i) : []],
  ] as [string, number[]][]) {
    const expected = frames.map((i) => `${folder}/${String(i).padStart(6, '0')}.png`).sort();
    check(
      JSON.stringify(
        Object.keys(files)
          .filter((n) => n.startsWith(folder + '/'))
          .sort(),
      ) === JSON.stringify(expected),
      `${folder} frame sequence mismatch`,
    );
  }
  const visibleIds = new Set<number>();
  const sampleCoverage: Record<string, Record<number, number>> = {};
  let depthMin = 255,
    depthMax = 0;
  for (const [name, bytes] of Object.entries(files)) {
    if (!/^(keyframes|depth|id)\//.test(name)) continue;
    const png = decodePng(bytes);
    check(
      png.width === manifest.width && png.height === manifest.height,
      `Image dimensions mismatch: ${name}`,
    );
    if (name.startsWith('keyframes/')) continue;
    const coverage: Record<number, number> = {};
    for (let i = 0; i < png.pixels.length; i += png.channels) {
      const [r, g, b] = png.pixels.subarray(i, i + 3);
      check(png.channels !== 4 || png.pixels[i + 3] === 255, `Non-opaque control pixel: ${name}`);
      if (name.startsWith('depth/')) {
        check(r === g && g === b, `Non-grayscale depth pixel: ${name}`);
        depthMin = Math.min(depthMin, r);
        depthMax = Math.max(depthMax, r);
      } else {
        const id = (r << 16) | (g << 8) | b;
        check(allowedIds.has(id), `Unknown object ID ${id}: ${name}`);
        visibleIds.add(id);
        coverage[id] = (coverage[id] ?? 0) + 1;
      }
    }
    if (name.startsWith('id/') && expectedKeys.includes(Number(name.slice(3, -4))))
      sampleCoverage[name] = coverage;
  }
  for (const entity of project.entities)
    if (entity.asset) {
      check(files['assets/' + entity.asset], `Missing GLB ${entity.asset}`);
      check(
        hash(files['assets/' + entity.asset]) + '.glb' === entity.asset,
        `GLB content hash mismatch: ${entity.asset}`,
      );
    }
  const expectedPartMap = getPartMap(project);
  const parts = manifest.parts;
  const partMaskCoverage: Record<string, number> = {};
  if (parts) {
    check(JSON.stringify(parts.mapping) === JSON.stringify(expectedPartMap), 'Part map mismatch');
    const frames = Array.from({ length: count }, (_, i) => String(i).padStart(6, '0'));
    const selected = parts.masks as { entityId: string; partId: string; frameSequence: string }[];
    check(
      Array.isArray(selected) && selected.length > 0 && selected.length <= 16,
      'Invalid mask selection',
    );
    check(
      new Set(selected.map((m) => m.entityId + '/' + m.partId)).size === selected.length,
      'Duplicate masks',
    );
    const expected = frames
      .flatMap((frame) => [
        'part-id/' + frame + '.png',
        ...selected.map((m) => `masks/${m.entityId}/${m.partId}/${frame}.png`),
      ])
      .sort();
    check(
      JSON.stringify(
        Object.keys(files)
          .filter((n) => n.startsWith('part-id/') || n.startsWith('masks/'))
          .sort(),
      ) === JSON.stringify(expected),
      'Part frame sequence mismatch',
    );
    const allowed = new Set([0, ...expectedPartMap.map((p) => p.value)]);
    for (const frame of frames) {
      const ids = decodePng(files['part-id/' + frame + '.png']);
      check(
        ids.width === manifest.width && ids.height === manifest.height,
        'Part ID dimensions mismatch',
      );
      for (let i = 0; i < ids.pixels.length; i += ids.channels)
        check(
          allowed.has((ids.pixels[i] << 16) | (ids.pixels[i + 1] << 8) | ids.pixels[i + 2]),
          'Unknown part ID',
        );
      for (const selection of selected) {
        const entry = expectedPartMap.find(
          (p) => p.entityId === selection.entityId && p.partId === selection.partId,
        );
        check(entry, 'Unknown selected part');
        check(
          selection.frameSequence === `masks/${selection.entityId}/${selection.partId}/%06d.png`,
          'Mask path mapping mismatch',
        );
        const name = `masks/${selection.entityId}/${selection.partId}/${frame}.png`,
          mask = decodePng(files[name]);
        check(mask.width === ids.width && mask.height === ids.height, 'Mask dimensions mismatch');
        let white = 0;
        for (let pixel = 0; pixel < ids.width * ids.height; pixel++) {
          const i = pixel * ids.channels,
            j = pixel * mask.channels;
          const value = (ids.pixels[i] << 16) | (ids.pixels[i + 1] << 8) | ids.pixels[i + 2];
          const expected = value === entry.value ? 255 : 0;
          check(
            mask.pixels[j] === expected &&
              mask.pixels[j + 1] === expected &&
              mask.pixels[j + 2] === expected,
            'Mask differs from visible Part ID: ' + name,
          );
          if (mask.channels === 4) check(mask.pixels[j + 3] === 255, 'Transparent part mask');
          if (expected === 255) white++;
        }
        if (expectedKeys.includes(Number(frame))) partMaskCoverage[name] = white;
      }
    }
  } else
    check(
      !Object.keys(files).some((n) => n.startsWith('part-id/') || n.startsWith('masks/')),
      'Unexpected part masks',
    );
  for (const reference of project.references ?? []) {
    const bytes = files['references/' + reference.asset];
    check(bytes, 'Missing reference image: ' + reference.asset);
    check(hash(bytes) === reference.asset.split('.')[0], 'Reference content hash mismatch');
  }
  if (manifest.references !== undefined || (project.references ?? []).length) {
    check(
      JSON.stringify(manifest.references) ===
        JSON.stringify(
          (project.references ?? []).map((ref) => ({ ...ref, path: 'references/' + ref.asset })),
        ),
      'Reference metadata mismatch',
    );
    const referenceData = json('references.json');
    check(
      JSON.stringify(referenceData.references) === JSON.stringify(project.references ?? []),
      'Reference handoff mismatch',
    );
    check(
      JSON.stringify(referenceData.bindings) ===
        JSON.stringify(
          project.entities.map((e) => ({
            entityId: e.id,
            referenceIds: e.referenceIds ?? [],
            parts: (e.parts ?? []).map((part) => ({
              partId: part.id,
              name: part.name,
              referenceIds: part.referenceIds ?? [],
              note: part.note ?? '',
            })),
          })),
        ),
      'Reference binding handoff mismatch',
    );
  }
  check(files['motion.mp4']?.length > 0, 'Missing motion.mp4');
  return {
    projectId: project.id,
    revision: project.revision,
    shotId: shot.id,
    shotName: shot.name,
    filesVerified: listed.length,
    frames: count,
    fps,
    duration: count / fps,
    width: manifest.width,
    height: manifest.height,
    controls,
    observedIds: [...visibleIds].sort((a, b) => a - b),
    depthRange: controls ? [depthMin, depthMax] : null,
    sampleCoverage,
    partMaskCoverage,
    partMaskCount: parts?.masks?.length ?? 0,
    appearanceReferences: (project.references ?? []).length,
    visualReview:
      'Required separately: pixel counts do not establish framing, visibility, movement quality or story continuity.',
  };
}

export function verifyShootingPack(path: string) {
  const files = unzipSync(readFileSync(path));
  const report = verifyPackFiles(files);
  const dir = mkdtempSync(join(tmpdir(), 'hengdian-pack-verify-'));
  try {
    const video = join(dir, 'motion.mp4');
    writeFileSync(video, files['motion.mp4']);
    const probe = spawnSync(
      process.env.FFPROBE_PATH || 'ffprobe',
      [
        '-v',
        'error',
        '-count_frames',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,nb_read_frames,avg_frame_rate,duration',
        '-of',
        'json',
        video,
      ],
      { encoding: 'utf8' },
    );
    check(
      !probe.error && probe.status === 0,
      `ffprobe failed: ${probe.error?.message ?? probe.stderr}`,
    );
    const stream = JSON.parse(probe.stdout).streams?.[0];
    check(stream, 'No MP4 video stream');
    const [numerator, denominator] = stream.avg_frame_rate.split('/').map(Number);
    check(
      stream.width === report.width && stream.height === report.height,
      'MP4 dimensions mismatch',
    );
    check(
      Number(stream.nb_read_frames) === report.frames && numerator / denominator === report.fps,
      'MP4 frame count/rate mismatch',
    );
    check(Math.abs(Number(stream.duration) - report.duration) < 0.001, 'MP4 duration mismatch');
    return { ...report, videoVerified: true };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    check(process.argv[2], 'Usage: npx tsx tools/verify-shooting-pack.ts <shooting-pack.zip>');
    console.log(JSON.stringify(verifyShootingPack(process.argv[2]), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
