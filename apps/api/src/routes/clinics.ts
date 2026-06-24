import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ClinicCreateInput, ClinicJoinInput } from '@odovox/types';
import type { ClinicMember } from '@odovox/db';
import { AppError, NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { encryptField } from '../lib/encryption.js';
import { createWithUniqueJoinCode } from '../lib/join-code.js';
import { toClinicResponse, toMemberResponse } from '../lib/serialize.js';
import { getContext, runAsSystem } from '../lib/request-context.js';

const LookupQuery = z.object({
  joinCode: z.string().trim().min(4, 'Enter a join code').max(12),
});

function joinSpecialization(specialization?: string[]): string | null {
  if (!specialization || specialization.length === 0) return null;
  return specialization.join(', ');
}

export async function clinicRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;

  // Lazy Prisma promises must be awaited *inside* runAsSystem so the query runs within
  // the system scope (otherwise clinic-scope enforcement rejects the cross-clinic read).
  const findActiveMembership = (userId: string): Promise<ClinicMember | null> =>
    runAsSystem(async () => {
      return await prisma.clinicMember.findFirst({
        where: { userId, status: 'ACTIVE', deletedAt: null },
      });
    });

  // ---------------------------------------------------------------------------
  // POST /clinics — create a clinic; caller becomes ADMIN + DOCTOR. 5/min/IP.
  // ---------------------------------------------------------------------------
  fastify.post(
    '/clinics',
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req) => {
      const input = parse(ClinicCreateInput, req.body);
      const userId = req.user!.id;

      if (await findActiveMembership(userId)) {
        throw new AppError('You already belong to a clinic.', 409, 'ALREADY_IN_CLINIC');
      }

      // Concurrency-safe: retry on a join-code unique violation.
      const { result: clinic, joinCode } = await createWithUniqueJoinCode(input.name, (code) =>
        prisma.clinic.create({
          data: {
            name: input.name,
            joinCode: code,
            addressLine: input.addressLine,
            city: input.city,
            state: input.state,
            pincode: input.pincode,
            gstNumber: input.gstNumber ?? null,
            contactPhone: input.contactPhone,
            openingTime: input.openingTime,
            closingTime: input.closingTime,
            lunchStart: input.lunchStart ?? null,
            lunchEnd: input.lunchEnd ?? null,
            weeklyOffDays: input.weeklyOffDays,
            chairsCount: input.chairsCount,
          },
        }),
      );

      // From here on, scope clinic-scoped writes to the new clinic.
      const ctx = getContext();
      if (ctx) ctx.clinicId = clinic.id;

      // Rooms: explicit list, else auto-generate one per chair.
      const rooms =
        input.rooms && input.rooms.length > 0
          ? input.rooms.map((r, i) => ({
              clinicId: clinic.id,
              name: r.name,
              number: r.number ?? String(i + 1),
            }))
          : Array.from({ length: input.chairsCount }, (_, i) => ({
              clinicId: clinic.id,
              name: `Room ${i + 1}`,
              number: String(i + 1),
            }));
      if (rooms.length > 0) {
        await prisma.room.createMany({ data: rooms });
      }

      await prisma.user.update({ where: { id: userId }, data: { name: input.doctorName } });

      const membership = await prisma.clinicMember.create({
        data: {
          clinicId: clinic.id,
          userId,
          role: 'DOCTOR',
          isAdmin: true,
          status: 'ACTIVE',
          qualification: input.qualification,
          registrationNumberEnc: encryptField(input.registrationNumber),
          specialization: joinSpecialization(input.specialization),
        },
      });

      await fastify.audit('CLINIC_CREATED', 'Clinic', clinic.id, { joinCode });
      await fastify.audit('CLINIC_MEMBER_ADDED', 'ClinicMember', membership.id, {
        role: 'DOCTOR',
        isAdmin: true,
      });
      await fastify.audit('USER_PROFILE_UPDATED', 'User', userId);

      // Re-issue an access token scoped to the new clinic so the caller can immediately
      // make clinic-scoped requests without re-logging-in.
      const accessToken = await fastify.jwt.signAccessToken({
        sub: userId,
        phone: req.user!.phone,
        clinicId: clinic.id,
        role: 'DOCTOR',
      });

      return ok({
        clinic: toClinicResponse(clinic),
        membership: toMemberResponse(membership),
        joinCode,
        accessToken,
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /clinics/lookup?joinCode=XXXXXX — minimal public info. 10/min/IP.
  // ---------------------------------------------------------------------------
  fastify.get(
    '/clinics/lookup',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => {
      const { joinCode } = parse(LookupQuery, req.query);
      const clinic = await prisma.clinic.findFirst({
        where: { joinCode: { equals: joinCode, mode: 'insensitive' }, deletedAt: null },
      });
      if (!clinic) throw new NotFoundError('No clinic found for that code.');
      return ok({ name: clinic.name, city: clinic.city, state: clinic.state });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /clinics/join — join an existing clinic by code. 5/min/IP.
  // ---------------------------------------------------------------------------
  fastify.post(
    '/clinics/join',
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req) => {
      const input = parse(ClinicJoinInput, req.body);
      const userId = req.user!.id;

      if (await findActiveMembership(userId)) {
        throw new AppError('You already belong to a clinic.', 409, 'ALREADY_IN_CLINIC');
      }

      const clinic = await prisma.clinic.findFirst({
        where: { joinCode: { equals: input.joinCode, mode: 'insensitive' }, deletedAt: null },
      });
      if (!clinic) throw new NotFoundError('No clinic found for that code.');

      const ctx = getContext();
      if (ctx) ctx.clinicId = clinic.id;

      await prisma.user.update({ where: { id: userId }, data: { name: input.name } });

      const isDoctor = input.role === 'DOCTOR';
      const membership = await prisma.clinicMember.create({
        data: {
          clinicId: clinic.id,
          userId,
          role: input.role,
          isAdmin: false,
          status: 'ACTIVE',
          qualification: isDoctor ? (input.qualification ?? null) : null,
          registrationNumberEnc:
            isDoctor && input.registrationNumber ? encryptField(input.registrationNumber) : null,
          specialization: isDoctor ? joinSpecialization(input.specialization) : null,
        },
      });

      await fastify.audit('CLINIC_MEMBER_JOINED', 'ClinicMember', membership.id, {
        role: input.role,
      });
      await fastify.audit('USER_PROFILE_UPDATED', 'User', userId);

      const accessToken = await fastify.jwt.signAccessToken({
        sub: userId,
        phone: req.user!.phone,
        clinicId: clinic.id,
        role: input.role,
      });

      return ok({
        clinic: toClinicResponse(clinic),
        membership: toMemberResponse(membership),
        accessToken,
      });
    },
  );
}
