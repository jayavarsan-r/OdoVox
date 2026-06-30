import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/** Base application error. Carries an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** 409 — a request conflicts with current state (e.g. an invalid lab-case transition). */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT', details?: unknown) {
    super(message, 409, code, details);
  }
}

/** 422 — well-formed request the server refuses to process (e.g. insufficient stock). */
export class UnprocessableError extends AppError {
  constructor(message = 'Unprocessable', code = 'UNPROCESSABLE', details?: unknown) {
    super(message, 422, code, details);
  }
}

/**
 * Central Fastify error handler. Maps known errors to status codes and NEVER leaks
 * stack traces or internal messages to clients in production.
 */
export function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const isProd = process.env.NODE_ENV === 'production';

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      request.log.error({ err: error }, 'application error');
    } else {
      request.log.warn({ err: error.message, code: error.code }, 'handled error');
    }
    reply.status(error.statusCode).send({
      ok: false,
      error: { code: error.code, message: error.message, details: error.details ?? undefined },
    });
    return;
  }

  // Fastify validation errors (schema) → 400
  const fastifyErr = error as FastifyError;
  if (fastifyErr.validation) {
    reply.status(400).send({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
    });
    return;
  }

  if (typeof fastifyErr.statusCode === 'number' && fastifyErr.statusCode < 500) {
    reply.status(fastifyErr.statusCode).send({
      ok: false,
      error: { code: fastifyErr.code ?? 'ERROR', message: fastifyErr.message },
    });
    return;
  }

  // Unknown / 5xx — log fully, return opaque message.
  request.log.error({ err: error }, 'unhandled error');
  reply.status(500).send({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Internal server error' : error.message,
    },
  });
}
