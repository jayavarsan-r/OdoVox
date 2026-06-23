/**
 * Typed fetch wrapper around the Odovox API.
 *
 * - Prefixes NEXT_PUBLIC_API_URL and sends credentials (httpOnly refresh cookie).
 * - Attaches the in-memory access token as a Bearer header.
 * - Unwraps the `{ ok: true, data }` success envelope; throws ApiError on `{ ok: false }`.
 * - On a 401, transparently calls /auth/refresh once and retries the original request.
 */

import { useAuth } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiErrorBody {
  ok?: false;
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
  /** Skip the Bearer header + 401-refresh dance (used by auth endpoints themselves). */
  skipAuth?: boolean;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'ok' in payload) {
    const env = payload as { ok: boolean; data?: T };
    if (env.ok) return env.data as T;
  }
  return payload as T;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Refresh the access token from the httpOnly cookie. Deduped across concurrent callers. */
async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return false;
        const payload = await res.json();
        const token = payload?.data?.accessToken as string | undefined;
        if (!token) return false;
        useAuth.getState().setAccessToken(token);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function rawFetch(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const { body, headers, skipAuth: _skip, ...rest } = options;
  return fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.skipAuth ? null : useAuth.getState().accessToken;
  let res = await rawFetch(path, options, token);

  // One transparent refresh + retry on 401.
  if (res.status === 401 && !options.skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await rawFetch(path, options, useAuth.getState().accessToken);
    } else {
      useAuth.getState().clearSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/welcome')) {
        window.location.href = '/welcome';
      }
    }
  }

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

  return unwrap<T>(payload);
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
