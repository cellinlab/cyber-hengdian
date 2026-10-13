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
