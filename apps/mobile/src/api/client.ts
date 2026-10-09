import type { z } from 'zod';
import { API_URL } from '@/config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The server's `error` code, e.g. "not_found", "invalid_isbn". */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    // The session cookie; in development the API is on another port of the same site.
    credentials: 'include',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const code = await res
      .json()
      .then((b: { error?: string }) => b.error)
      .catch(() => undefined);
    throw new ApiError(res.status, `${method} ${path} failed with ${res.status}`, code);
  }
  return schema.parse(await res.json());
}

/** GET a JSON endpoint and validate the response, so a server/app mismatch fails loudly here. */
export function apiGet<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  return request('GET', path, schema, undefined, signal);
}

export function apiPost<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  return request('POST', path, schema, body);
}

/** URL of a cover image served by our API (keys come from the server). */
export function coverUri(key: string): string {
  return `${API_URL}/api/covers/${key}`;
}
