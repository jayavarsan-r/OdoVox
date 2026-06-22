/**
 * Typed fetch wrapper around the Odovox API. Prefixes NEXT_PUBLIC_API_URL, sends
 * credentials (for the httpOnly refresh cookie), and throws a typed ApiError on failure.
 * Consumed by TanStack Query.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : null;

  if (!res.ok) {
    const errBody = payload as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      errBody?.error?.code ?? 'HTTP_ERROR',
      errBody?.error?.message ?? res.statusText,
      errBody?.error?.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
