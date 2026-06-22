import fp from 'fastify-plugin';
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload } from 'jose';
import type { FastifyRequest } from 'fastify';
import type { Env } from '../lib/env.js';
import { AuthError } from '../lib/errors.js';
import { getContext } from '../lib/request-context.js';

const ALG = 'RS256';
const ACCESS_TTL = '15m';
const ACCESS_TTL_SECONDS = 15 * 60;

export interface AccessClaims {
  sub: string;
  phone: string;
  clinicId?: string;
  role?: 'DOCTOR' | 'RECEPTIONIST' | 'ADMIN';
}

declare module 'fastify' {
  interface FastifyInstance {
    jwt: {
      signAccessToken: (claims: AccessClaims) => Promise<string>;
      verifyAccessToken: (token: string) => Promise<AccessClaims>;
      accessTokenTtlSeconds: number;
    };
    /** preHandler that rejects the request if no valid access token is present. */
    authenticate: (req: FastifyRequest) => Promise<void>;
  }
}

function decodeBase64Pem(value: string): string {
  // Accept either a raw PEM or a base64-encoded PEM.
  if (value.includes('-----BEGIN')) return value;
  return Buffer.from(value, 'base64').toString('utf8');
}

export const jwtPlugin = fp(
  async (fastify, opts: { env: Env }) => {
    const { env } = opts;

    let privateKey: Awaited<ReturnType<typeof importPKCS8>>;
    let publicKey: Awaited<ReturnType<typeof importSPKI>>;
    try {
      privateKey = await importPKCS8(decodeBase64Pem(env.JWT_PRIVATE_KEY), ALG);
      publicKey = await importSPKI(decodeBase64Pem(env.JWT_PUBLIC_KEY), ALG);
    } catch (err) {
      throw new Error(
        `Failed to load JWT RS256 keys — check JWT_PRIVATE_KEY / JWT_PUBLIC_KEY: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    async function signAccessToken(claims: AccessClaims): Promise<string> {
      return new SignJWT({
        phone: claims.phone,
        clinicId: claims.clinicId,
        role: claims.role,
      })
        .setProtectedHeader({ alg: ALG, kid: `v${env.PHI_KEY_VERSION}` })
        .setSubject(claims.sub)
        .setIssuer(env.JWT_ISSUER)
        .setAudience(env.JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(ACCESS_TTL)
        .sign(privateKey);
    }

    async function verifyAccessToken(token: string): Promise<AccessClaims> {
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        algorithms: [ALG],
      });
      return toClaims(payload);
    }

    function toClaims(payload: JWTPayload): AccessClaims {
      if (typeof payload.sub !== 'string' || typeof payload.phone !== 'string') {
        throw new AuthError('Invalid token payload');
      }
      return {
        sub: payload.sub,
        phone: payload.phone,
        clinicId: typeof payload.clinicId === 'string' ? payload.clinicId : undefined,
        role:
          payload.role === 'DOCTOR' || payload.role === 'RECEPTIONIST' || payload.role === 'ADMIN'
            ? payload.role
            : undefined,
      };
    }

    fastify.decorate('jwt', {
      signAccessToken,
      verifyAccessToken,
      accessTokenTtlSeconds: ACCESS_TTL_SECONDS,
    });

    fastify.decorate('authenticate', async (req: FastifyRequest) => {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new AuthError('Missing bearer token');
      }
      const token = header.slice('Bearer '.length);
      let claims: AccessClaims;
      try {
        claims = await verifyAccessToken(token);
      } catch {
        throw new AuthError('Invalid or expired token');
      }
      req.user = { id: claims.sub, phone: claims.phone };
      req.clinicId = claims.clinicId;
      req.role = claims.role;

      // Propagate identity into the AsyncLocalStorage context so the Prisma
      // clinic-scope middleware and audit attribution pick it up.
      const ctx = getContext();
      if (ctx) {
        ctx.clinicId = claims.clinicId;
        ctx.userId = claims.sub;
      }
    });
  },
  { name: 'jwt' },
);
