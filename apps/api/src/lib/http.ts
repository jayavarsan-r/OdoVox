import type { FastifyReply } from 'fastify';
import type { z } from 'zod';
import { ValidationError } from './errors.js';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TTL_SECONDS,
} from './tokens.js';

/** Parse a request body/query with a Zod schema, raising a 400 ValidationError on failure. */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Request validation failed', result.error.flatten());
  }
  return result.data;
}

/**
 * Standard success envelope. Errors are emitted by the central error handler as
 * `{ ok: false, error: { code, message } }`, so the two halves form a discriminated union
 * the web client can switch on.
 */
export interface OkEnvelope<T> {
  ok: true;
  data: T;
}

export function ok<T>(data: T): OkEnvelope<T> {
  return { ok: true, data };
}

/** Set the httpOnly refresh-token cookie (scoped to /auth, Secure in production). */
export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_SECONDS,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}
