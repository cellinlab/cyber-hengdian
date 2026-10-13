import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Preserve original bytes; validate a fully decoded static image before accepting it. */
export async function storeReference(data: Buffer, mimeType: string, dir: string) {
  if (!data.length || data.length > 10 * 1024 * 1024)
    throw Error('Reference image must be 1 byte–10 MB');
  const formats = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' } as const;
  const format = formats[mimeType as keyof typeof formats];
  if (!format) throw Error('Reference images must be PNG, JPEG or WebP');
  const input = sharp(data, { limitInputPixels: 16_777_216, failOn: 'warning' });
  const meta = await input.metadata();
  if (meta.format !== format || !meta.width || !meta.height || (meta.pages ?? 1) > 1)
    throw Error('Image contents do not match the declared static image type');
  await input.raw().toBuffer(); // metadata alone does not prove that the image can be decoded.
  const extension = format === 'jpeg' ? 'jpg' : format;
  const asset = createHash('sha256').update(data).digest('hex') + '.' + extension;
  if (!existsSync(join(dir, asset))) writeFileSync(join(dir, asset), data, { flag: 'wx' });
  const rotated = [5, 6, 7, 8].includes(meta.orientation ?? 1);
  return {
    asset,
    width: rotated ? meta.height : meta.width,
    height: rotated ? meta.width : meta.height,
    mimeType,
  };
}
