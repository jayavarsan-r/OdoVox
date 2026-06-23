import type { FastifyInstance } from 'fastify';
import { RequestOtpInput, VerifyOtpInput, type VerifyOtpResponse } from '@odovox/types';
import type { ClinicMember } from '@odovox/db';
import { AppError, AuthError } from '../lib/errors.js';
import { ok, parse, setRefreshCookie, clearRefreshCookie } from '../lib/http.js';
import { maskPhone, normalizePhone } from '../lib/phone.js';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  generateOtp,
  hashOtp,
  verifyOtp,
} from '../lib/otp-service.js';
import { getOtpSender } from '../lib/otp/index.js';
import {
  REFRESH_COOKIE_NAME,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
} from '../lib/tokens.js';
import { toMemberResponse } from '../lib/serialize.js';
import { getContext, runAsSystem } from '../lib/request-context.js';
import type { AccessClaims } from '../plugins/jwt.js';

// Per-phone verify cap. Set above OTP_MAX_ATTEMPTS (5) so the 5-attempt lockout — the
// stricter, binding anti-bruteforce control — is what a user hits first, rather than the
// rate limiter masking it.
const OTP_VERIFY_MAX_PER_MINUTE = 10;

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma, redis } = fastify;

  /**
   * Find the caller's single active membership across clinics (a system-scope read).
   * The `await` inside `runAsSystem` matters: Prisma promises are lazy, so we must let the
   * query execute *within* the system context, not after it has unwound.
   */
  const findActiveMembership = (userId: string): Promise<ClinicMember | null> =>
    runAsSystem(async () => {
      return await prisma.clinicMember.findFirst({
        where: { userId, status: 'ACTIVE', deletedAt: null },
        orderBy: { joinedAt: 'desc' },
      });
    });

  const buildClaims = (
    userId: string,
    phone: string,
    membership: ClinicMember | null,
  ): AccessClaims => ({
    sub: userId,
    phone,
    clinicId: membership?.clinicId,
    role: membership?.role,
  });

  // ---------------------------------------------------------------------------
  // POST /auth/otp/request — 3/min/IP (route) + 5/hour/phone (Redis) + 60s cooldown
  // ---------------------------------------------------------------------------
  fastify.post(
    '/auth/otp/request',
    { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (req) => {
      const { phone: rawPhone } = parse(RequestOtpInput, req.body);
      const phone = normalizePhone(rawPhone);

      // Per-phone hourly cap via a Redis counter (1h TTL).
      const hourKey = `otp:req:${phone}`;
      const count = await redis.incr(hourKey);
      if (count === 1) await redis.expire(hourKey, 60 * 60);
      if (count > OTP_MAX_PER_HOUR) {
        throw new AppError(
          'Too many OTP requests for this number. Try again later.',
          429,
          'OTP_RATE_LIMITED',
        );
      }

      // 60s cooldown between codes for the same phone.
      const latest = await prisma.otpRequest.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
      });
      if (latest && !latest.verifiedAt) {
        const elapsed = Math.floor((Date.now() - latest.createdAt.getTime()) / 1000);
        if (elapsed < OTP_RESEND_SECONDS) {
          throw new AppError(
            'Please wait before requesting another code.',
            429,
            'OTP_COOLDOWN_ACTIVE',
            { retryAfterSeconds: OTP_RESEND_SECONDS - elapsed },
          );
        }
      }

      const otp = generateOtp();
      const otpHash = await hashOtp(otp);

      // Invalidate any older still-valid codes for this phone.
      await prisma.otpRequest.updateMany({
        where: { phone, verifiedAt: null, expiresAt: { gt: new Date() } },
        data: { expiresAt: new Date() },
      });

      const created = await prisma.otpRequest.create({
        data: {
          phone,
          otpHash,
          attempts: 0,
          expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
          ip: req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });

      await getOtpSender(fastify.log).send(phone, otp);

      await fastify.audit('OTP_REQUESTED', 'OtpRequest', created.id, {
        phone: maskPhone(phone),
      });

      return ok({ expiresInSeconds: OTP_TTL_SECONDS, resendInSeconds: OTP_RESEND_SECONDS });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /auth/otp/verify — 5/min/phone (Redis)
  // ---------------------------------------------------------------------------
  fastify.post('/auth/otp/verify', async (req, reply) => {
    const { phone: rawPhone, otp } = parse(VerifyOtpInput, req.body);
    const phone = normalizePhone(rawPhone);

    const minuteKey = `otp:verify:${phone}`;
    const tries = await redis.incr(minuteKey);
    if (tries === 1) await redis.expire(minuteKey, 60);
    if (tries > OTP_VERIFY_MAX_PER_MINUTE) {
      throw new AppError('Too many attempts. Try again shortly.', 429, 'OTP_RATE_LIMITED');
    }

    const request = await prisma.otpRequest.findFirst({
      where: { phone, verifiedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!request) {
      throw new AppError('Code is invalid or has expired.', 400, 'OTP_INVALID_OR_EXPIRED');
    }
    if (request.attempts >= OTP_MAX_ATTEMPTS) {
      throw new AppError('Too many wrong attempts. Request a new code.', 429, 'OTP_LOCKED');
    }

    const updated = await prisma.otpRequest.update({
      where: { id: request.id },
      data: { attempts: { increment: 1 } },
    });

    const matches = await verifyOtp(otp, request.otpHash);
    if (!matches) {
      const attemptsRemaining = Math.max(0, OTP_MAX_ATTEMPTS - updated.attempts);
      await fastify.audit('OTP_VERIFY_FAILED', 'OtpRequest', request.id, {
        phone: maskPhone(phone),
        attemptsRemaining,
      });
      throw new AppError('Wrong code.', 400, 'OTP_INCORRECT', { attemptsRemaining });
    }

    await prisma.otpRequest.update({
      where: { id: request.id },
      data: { verifiedAt: new Date() },
    });

    // Upsert the user. New users start without a name (set during onboarding).
    const existing = await prisma.user.findUnique({ where: { phone } });
    const isNewUser = existing === null;
    const user = existing
      ? await prisma.user.update({ where: { phone }, data: { lastLoginAt: new Date() } })
      : await prisma.user.create({ data: { phone, name: '', lastLoginAt: new Date() } });

    // Attribute subsequent audit entries to this user.
    const ctx = getContext();
    if (ctx) ctx.userId = user.id;

    const membership = await findActiveMembership(user.id);

    const accessToken = await fastify.jwt.signAccessToken(buildClaims(user.id, phone, membership));

    const refreshToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiry(),
        deviceInfo: req.headers['user-agent'] ?? null,
      },
    });
    setRefreshCookie(reply, refreshToken);

    await fastify.audit('OTP_VERIFIED', 'User', user.id, { phone: maskPhone(phone) });
    await fastify.audit(isNewUser ? 'USER_CREATED' : 'USER_SIGNED_IN', 'User', user.id);

    const body: VerifyOtpResponse = {
      accessToken,
      expiresIn: fastify.jwt.accessTokenTtlSeconds,
      user: { id: user.id, phone: user.phone, name: user.name || null },
      activeMembership: membership ? toMemberResponse(membership) : null,
      nextStep: membership ? 'HOME' : 'ROLE_SELECT',
    };
    return ok(body);
  });

  // ---------------------------------------------------------------------------
  // POST /auth/refresh — rotate refresh token, issue new access token
  // ---------------------------------------------------------------------------
  fastify.post('/auth/refresh', async (req, reply) => {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!presented) {
      clearRefreshCookie(reply);
      throw new AuthError('No refresh token');
    }

    const tokenHash = hashRefreshToken(presented);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      clearRefreshCookie(reply);
      throw new AuthError('Invalid refresh token');
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      clearRefreshCookie(reply);
      throw new AuthError('Invalid refresh token');
    }

    const ctx = getContext();
    if (ctx) ctx.userId = user.id;

    // Rotation: revoke the presented token and issue a fresh one.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const nextToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(nextToken),
        expiresAt: refreshExpiry(),
        deviceInfo: req.headers['user-agent'] ?? null,
      },
    });
    setRefreshCookie(reply, nextToken);

    const membership = await findActiveMembership(user.id);
    const accessToken = await fastify.jwt.signAccessToken(
      buildClaims(user.id, user.phone, membership),
    );

    await fastify.audit('TOKEN_REFRESHED', 'RefreshToken', stored.id);

    return ok({ accessToken, expiresIn: fastify.jwt.accessTokenTtlSeconds });
  });

  // ---------------------------------------------------------------------------
  // POST /auth/logout — revoke the current refresh token + clear cookie
  // ---------------------------------------------------------------------------
  fastify.post('/auth/logout', async (req, reply) => {
    const presented = req.cookies?.[REFRESH_COOKIE_NAME];
    if (presented) {
      const tokenHash = hashRefreshToken(presented);
      const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (stored && !stored.revokedAt) {
        const ctx = getContext();
        if (ctx) ctx.userId = stored.userId;
        await prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        await fastify.audit('USER_LOGGED_OUT', 'RefreshToken', stored.id);
      }
    }
    clearRefreshCookie(reply);
    return ok({ logoutAt: new Date().toISOString() });
  });

  // ---------------------------------------------------------------------------
  // GET /auth/me — current user + active membership + clinic
  // ---------------------------------------------------------------------------
  fastify.get(
    '/auth/me',
    { preHandler: fastify.authenticate },
    async (req) => {
      const userId = req.user!.id;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AuthError('User not found');

      const membership = await findActiveMembership(userId);
      const clinic = membership
        ? await prisma.clinic.findUnique({ where: { id: membership.clinicId } })
        : null;

      return ok({
        user: { id: user.id, phone: user.phone, name: user.name || null },
        activeMembership: membership ? toMemberResponse(membership) : null,
        clinic: clinic
          ? { id: clinic.id, name: clinic.name, city: clinic.city, state: clinic.state }
          : null,
      });
    },
  );
}
