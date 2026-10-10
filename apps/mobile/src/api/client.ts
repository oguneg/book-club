import { Platform } from 'react-native';
import type { z } from 'zod';
import { sessionHeaders } from '@/auth/client';
import { API_URL } from '@/config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The server's `error` code, e.g. "not_found", "invalid_isbn". */
    readonly code?: string,
    /** Anything else in the error body (e.g. the id of the reading that already exists). */
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    // Web: the browser's session cookie (in development the API is on another port of the same site).
    // Native: the stored session cookie as a header, and nothing the platform might add on its own.
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(await sessionHeaders()),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
    throw new ApiError(res.status, `${method} ${path} failed with ${res.status}`, body.error, body);
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
