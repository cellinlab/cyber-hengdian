import { describe, it, expect, afterEach } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storeReference } from '../server/references';
const dirs: string[] = [];
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), 'hengdian-ref-'));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
describe('appearance image assets', () => {
  it.each([
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ] as const)('decodes and preserves original %s bytes idempotently', async (format, mime) => {
    const bytes = await sharp({
      create: { width: 40, height: 30, channels: 3, background: '#d4423c' },
    })
      .toFormat(format)
      .toBuffer();
    const dir = temp(),
      result = await storeReference(bytes, mime, dir);
    expect(result).toMatchObject({ width: 40, height: 30, mimeType: mime });
    expect(readFileSync(join(dir, result.asset))).toEqual(bytes);
    expect(await storeReference(bytes, mime, dir)).toEqual(result);
  });
  it('rejects wrong declared type, truncated image and unsupported input', async () => {
    const dir = temp(),
      png = await sharp({ create: { width: 32, height: 32, channels: 3, background: 'white' } })
        .png()
        .toBuffer();
    await expect(storeReference(png, 'image/jpeg', dir)).rejects.toThrow();
    await expect(storeReference(png.subarray(0, 45), 'image/png', dir)).rejects.toThrow();
    await expect(storeReference(Buffer.from('<svg/>'), 'image/svg+xml', dir)).rejects.toThrow();
  });
});
