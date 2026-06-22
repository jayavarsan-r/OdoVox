import { pino, type LoggerOptions } from 'pino';

/**
 * Structured JSON logger. Pretty-prints in development, raw JSON in prod.
 * Redacts sensitive fields so PHI / secrets never land in logs.
 */
export function buildLoggerOptions(env: {
  NODE_ENV: string;
  LOG_LEVEL: string;
}): LoggerOptions {
  const isDev = env.NODE_ENV === 'development';
  return {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.otp',
        '*.otpHash',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.medicalHistory',
        '*.allergies',
        '*.rawTranscript',
      ],
      remove: true,
    },
    ...(isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
  };
}

export const logger = pino(buildLoggerOptions({ NODE_ENV: 'development', LOG_LEVEL: 'info' }));
