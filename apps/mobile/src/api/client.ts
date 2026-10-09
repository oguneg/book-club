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

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal): Promise<T> {
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
  // 204 No Content (e.g. after deleting): nothing to parse.
  return schema.parse(res.status === 204 ? undefined : await res.json());
}

/** GET a JSON endpoint and validate the response, so a server/app mismatch fails loudly here. */
export function apiGet<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  return request('GET', path, schema, undefined, signal);
}

export function apiPost<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  return request('POST', path, schema, body);
}

export function apiPut<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  return request('PUT', path, schema, body);
}

export function apiPatch<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  return request('PATCH', path, schema, body);
}

export function apiDelete<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return request('DELETE', path, schema);
}

/** URL of a cover image served by our API (keys come from the server). */
export function coverUri(key: string): string {
  return `${API_URL}/api/covers/${key}`;
}
