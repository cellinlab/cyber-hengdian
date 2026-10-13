/** Thin HTTP client. The running service remains the only project owner. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
export async function request(path: string, body?: unknown, timeoutMs = 15000): Promise<unknown> {
  const base = process.env.HENGDIAN_URL || 'http://127.0.0.1:4317';
  let response: Response;
  try {
    response = await fetch(new URL(path, base), {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ServiceError(
      `Cannot reach Cyber Hengdian at ${base}: ${error instanceof Error ? error.message : String(error)}. Start the service first.`,
    );
  }
  const raw = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new ServiceError(
      `HTTP ${response.status}: service returned non-JSON data`,
      response.status,
    );
  }
  if (!response.ok) {
    const detail =
      result && typeof result === 'object' && 'error' in result ? String(result.error) : raw;
    throw new ServiceError(`HTTP ${response.status}: ${detail}`, response.status);
  }
  return result;
}

/** Local file import to the chosen loopback workspace; registration/binding is a separate transaction. */
export async function uploadReference(file: string) {
  const { readFile, stat } = await import('node:fs/promises');
  const { extname, isAbsolute } = await import('node:path');
  if (!isAbsolute(file)) throw Error('Reference path must be absolute');
  const types: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  const mimeType = types[extname(file).toLowerCase()];
  if (!mimeType) throw Error('Reference images must be PNG, JPEG or WebP');
  const info = await stat(file);
  if (!info.isFile() || info.size > 10 * 1024 * 1024)
    throw Error('Reference image must be a file up to 10 MB');
  const data = await readFile(file);
  const base = process.env.HENGDIAN_URL || 'http://127.0.0.1:4317';
  const url = new URL(base);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw Error('Image import requires a loopback Hengdian service');
  const response = await fetch(new URL('/api/references', base), {
    method: 'POST',
    headers: { 'Content-Type': mimeType },
    body: new Uint8Array(data),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ServiceError(String(result.error ?? 'Image import failed'), response.status);
  return result;
}
