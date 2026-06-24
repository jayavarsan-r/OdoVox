import fp from 'fastify-plugin';
import { Server, type Socket } from 'socket.io';
import { REALTIME_EVENT_NAME, type QueueSnapshot, type ServerEvent } from '@odovox/types';
import type { Env } from '../lib/env.js';
import { runAsSystem } from '../lib/request-context.js';
import { getQueueSnapshot } from '../lib/queue/snapshot.js';
import { getRecordingVisitIds } from '../lib/realtime/recording.js';
import { clinicRoom, doctorRoom, setRealtimeEmitter } from '../lib/realtime/broadcast.js';

/**
 * Socket.IO realtime layer (Stage 2). The transport is broadcast-only: clients subscribe and
 * receive events; ALL mutations go through REST (which owns RBAC/validation/audit). The clinic a
 * socket belongs to is ALWAYS derived from the verified access token's membership — never from a
 * client-supplied value — so cross-clinic event leakage is structurally impossible.
 *
 * Depends on jwt + prisma + redis being registered first.
 */
interface SocketData {
  userId: string;
  clinicId: string;
  role: 'DOCTOR' | 'RECEPTIONIST' | 'ADMIN';
}

/** Every server→client message rides the single `event` channel carrying a typed ServerEvent. */
interface ServerToClientEvents {
  event: (e: ServerEvent) => void;
}
type ClientToServerEvents = Record<string, never>;
type InterServerEvents = Record<string, never>;
type QueueSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const SNAPSHOT_CACHE_MS = 1000;

export const socketPlugin = fp(
  async (fastify, opts: { env: Env }) => {
    const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
      fastify.server,
      {
        cors: { origin: opts.env.CORS_ORIGINS, credentials: true },
        pingInterval: 25_000,
        pingTimeout: 20_000,
        maxHttpBufferSize: 1e6, // 1MB cap on inbound payloads
      },
    );

    // --- Handshake auth: verify JWT + an ACTIVE membership in the token's clinic ----------------
    io.use(async (socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('AUTH_MISSING'));
      let payload: Awaited<ReturnType<typeof fastify.jwt.verifyAccessToken>>;
      try {
        payload = await fastify.jwt.verifyAccessToken(token);
      } catch {
        return next(new Error('AUTH_INVALID'));
      }
      if (!payload.clinicId) return next(new Error('NO_ACTIVE_MEMBERSHIP'));
      // Trusted auth read — the clinic is taken from the token, then membership re-verified. The
      // query MUST be awaited inside runAsSystem (a bare `() => prisma…` returns a lazy PrismaPromise
      // that would execute after the system context has exited).
      const membership = await runAsSystem(async () => {
        const m = await fastify.prisma.clinicMember.findFirst({
          where: { userId: payload.sub, clinicId: payload.clinicId, status: 'ACTIVE', deletedAt: null },
        });
        return m;
      });
      if (!membership) return next(new Error('NO_ACTIVE_MEMBERSHIP'));
      socket.data.userId = payload.sub;
      socket.data.clinicId = membership.clinicId; // derived from the verified membership
      socket.data.role = membership.role;
      next();
    });

    // --- Connection: join rooms, push a snapshot, log ------------------------------------------
    io.on('connection', (socket: QueueSocket) => {
      const { clinicId, userId, role } = socket.data;
      void socket.join(clinicRoom(clinicId));
      if (role === 'DOCTOR') void socket.join(doctorRoom(clinicId, userId));
      fastify.log.info({ userId, clinicId, role }, 'ws connected');

      void getCachedSnapshot(clinicId)
        .then((snapshot) => socket.emit(REALTIME_EVENT_NAME, { type: 'queue.snapshot', payload: snapshot }))
        .catch((err: unknown) => fastify.log.error({ err }, 'ws snapshot failed'));

      socket.on('disconnect', (reason) => fastify.log.info({ userId, clinicId, reason }, 'ws disconnected'));
    });

    /** Build (or reuse a ≤1s Redis-cached) clinic snapshot — dedupes rapid reconnect storms. */
    async function getCachedSnapshot(clinicId: string): Promise<QueueSnapshot> {
      const cacheKey = `clinic:${clinicId}:snapshot`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as QueueSnapshot;
      const recordingVisitIds = await getRecordingVisitIds(fastify.redis, clinicId);
      const snapshot = await getQueueSnapshot(fastify.prisma, clinicId, { recordingVisitIds });
      await fastify.redis.set(cacheKey, JSON.stringify(snapshot), 'PX', SNAPSHOT_CACHE_MS);
      return snapshot;
    }

    // --- Wire REST broadcasts → Socket.IO ------------------------------------------------------
    setRealtimeEmitter((room, _eventName, event) => {
      io.to(room).emit(REALTIME_EVENT_NAME, event);
    });

    // Detach Socket.IO cleanly without closing Fastify's http server (Fastify owns its lifecycle):
    // disconnect clients + shut the engine, but leave server.close() to Fastify's own teardown.
    fastify.addHook('onClose', async () => {
      setRealtimeEmitter(null);
      io.disconnectSockets(true);
      io.engine.close();
    });

    fastify.log.info('Socket.IO attached');
  },
  { name: 'socket', dependencies: ['jwt', 'prisma', 'redis'] },
);
