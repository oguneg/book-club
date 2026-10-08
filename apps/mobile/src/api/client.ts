import type { z } from 'zod';
import { API_URL } from '@/config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** GET a JSON endpoint and validate the response, so a server/app mismatch fails loudly here. */
export async function apiGet<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new ApiError(res.status, `GET ${path} failed with ${res.status}`);
  return schema.parse(await res.json());
}
