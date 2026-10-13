import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { createProject } from '../src/core/catalog';
import { evaluate } from '../src/core/project';
import { decodePng, verifyPackFiles, verifyShootingPack } from '../tools/verify-shooting-pack';

function png(width: number, height: number, rgb: number[]) {
  const chunk = (name: string, data: Buffer) => {
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(name), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const end = Buffer.alloc(4);
    end.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, body, end]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) pixels.set(rgb, y * (1 + width * 3) + 1 + x * 3);
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function fixture() {
  const p = createProject();
  const s = p.shots[0];
  s.duration = 0.5;
  s.tracks = {};
  const count = Math.round(s.duration * Number(p.fps));
  const files: Record<string, Uint8Array> = {
    'project.hengdian.json': strToU8(JSON.stringify(p)),
    'camera.json': strToU8(
      JSON.stringify(
        Array.from({ length: count }, (_, i) => ({
          frame: i,
          time: i / Number(p.fps),
          ...evaluate(p, s, i / Number(p.fps)).camera,
        })),
      ),
    ),
    'motion.mp4': strToU8('not a video; pure file verifier does not claim video decoding'),
  };
  for (let i = 0; i < count; i++) {
    const frame = String(i).padStart(6, '0');
    files[`id/${frame}.png`] = png(2, 2, [0, 0, 1]);
    files[`depth/${frame}.png`] = png(2, 2, [16, 16, 16]);
    if ([0, Math.floor(count / 2), count - 1].includes(i))
      files[`keyframes/${frame}.png`] = png(2, 2, [85, 93, 77]);
  }
  const manifest = {
    schemaVersion: 'hengdian-handoff/1',
    projectId: p.id,
    revision: p.revision,
    shotId: s.id,
    fps: Number(p.fps),
    frameCount: count,
    duration: s.duration,
    sourceDuration: s.duration,
    width: 2,
    height: 2,
    depth: { encoding: 'linear view-space 8-bit grayscale' },
    objectIds: Object.fromEntries(
      p.entities.map((e, i) => [
        e.id,
        { value: i + 1, hex: '#' + (i + 1).toString(16).padStart(6, '0') },
      ]),
    ),
    files: {},
  };
  const sign = () => {
    manifest.files = Object.fromEntries(
      Object.entries(files)
        .filter(([n]) => n !== 'manifest.json')
        .map(([n, b]) => [
          n,
          { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') },
        ]),
    );
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
  };
  sign();
  return { files, sign };
}

describe('shooting pack evidence verifier', () => {
  it('checks exact files, camera timeline and raw ID/depth pixels without pretending to assess visual quality', () => {
    const report = verifyPackFiles(fixture().files);
    expect(report.frames).toBe(12);
    expect(report.observedIds).toEqual([1]);
    expect(report.depthRange).toEqual([16, 16]);
    expect(report.visualReview).toContain('Required separately');
  });
  it('rejects corrupted bytes and unlisted files', () => {
    const { files } = fixture();
    files['motion.mp4'][0] ^= 1;
    expect(() => verifyPackFiles(files)).toThrow('SHA-256');
    files['hidden.txt'] = strToU8('unlisted');
    expect(() => verifyPackFiles(files)).toThrow('file list');
  });
  it('rejects a camera frame that diverges from the editable scene even when hashes match', () => {
    const { files, sign } = fixture();
    const camera = JSON.parse(new TextDecoder().decode(files['camera.json']));
    camera[5].position[0] += 1;
    files['camera.json'] = strToU8(JSON.stringify(camera));
    sign();
    expect(() => verifyPackFiles(files)).toThrow('frame 5');
  });
  it('rejects missing controls, unknown IDs and mismatched dimensions', () => {
    const { files, sign } = fixture();
    delete files['depth/000001.png'];
    sign();
    expect(() => verifyPackFiles(files)).toThrow('depth frame sequence');
    files['depth/000001.png'] = png(2, 2, [16, 16, 16]);
    files['id/000001.png'] = png(2, 2, [0, 0, 99]);
    sign();
    expect(() => verifyPackFiles(files)).toThrow('Unknown object ID 99');
    files['id/000001.png'] = png(3, 2, [0, 0, 1]);
    sign();
    expect(() => verifyPackFiles(files)).toThrow('dimensions');
  });
  it('rejects non-grayscale depth and malformed PNG input', () => {
    const { files, sign } = fixture();
    files['depth/000001.png'] = png(2, 2, [16, 15, 16]);
    sign();
    expect(() => verifyPackFiles(files)).toThrow('Non-grayscale');
    expect(() => decodePng(strToU8('invalid'))).toThrow('Invalid PNG');
  });
});

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const mediaToolsAvailable =
  spawnSync(ffmpeg, ['-version']).status === 0 && spawnSync(ffprobe, ['-version']).status === 0;
it.runIf(mediaToolsAvailable)(
  'decodes an actual MP4 and rejects a missing video frame despite valid ZIP hashes',
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'hengdian-video-verifier-test-'));
    try {
      const { files, sign } = fixture();
      const video = join(dir, 'motion.mp4');
      const archive = join(dir, 'pack.zip');
      for (const frames of [12, 11]) {
        const encoded = spawnSync(
          ffmpeg,
          [
            '-y',
            '-v',
            'error',
            '-f',
            'lavfi',
            '-i',
            'color=c=red:s=2x2:r=24',
            '-frames:v',
            String(frames),
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            video,
          ],
          { encoding: 'utf8' },
        );
        expect(encoded.status, encoded.stderr).toBe(0);
        files['motion.mp4'] = readFileSync(video);
        sign();
        writeFileSync(archive, zipSync(files));
        if (frames === 12) expect(verifyShootingPack(archive).videoVerified).toBe(true);
        else expect(() => verifyShootingPack(archive)).toThrow('MP4 frame count/rate mismatch');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
