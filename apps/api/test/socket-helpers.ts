import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { io as ioClient, type Socket } from 'socket.io-client';
import type { ServerEvent } from '@odovox/types';

/** Start the real HTTP server on a random port so socket.io-client can connect. */
export async function listenApp(app: FastifyInstance): Promise<string> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

/**
 * Per-socket event buffer, attached at creation time so the snapshot emitted immediately on connect
 * is never missed in the window before a test attaches its collector.
 */
const buffers = new WeakMap<Socket, ServerEvent[]>();

/** Connect a client; resolves on `connect`, rejects on `connect_error` (auth failures land here). */
export function connectClient(url: string, token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      timeout: 10_000, // headroom for parallel test workers under load
    });
    const buf: ServerEvent[] = [];
    buffers.set(socket, buf);
    socket.on('event', (e: ServerEvent) => buf.push(e));
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

export interface Collector {
  events: ServerEvent[];
  waitFor: (predicate: (e: ServerEvent) => boolean, timeoutMs?: number) => Promise<ServerEvent>;
  expectNone: (predicate: (e: ServerEvent) => boolean, windowMs?: number) => Promise<void>;
}

/** Read the socket's event buffer (attached at connect), with helpers to await or assert-absence. */
export function collect(socket: Socket): Collector {
  let events = buffers.get(socket);
  if (!events) {
    events = [];
    buffers.set(socket, events);
    socket.on('event', (e: ServerEvent) => events!.push(e));
  }
  return {
    events,
    waitFor(predicate, timeoutMs = 10000) {
      return new Promise<ServerEvent>((resolve, reject) => {
        const existing = events.find(predicate);
        if (existing) return resolve(existing);
        const timer = setTimeout(() => {
          socket.off('event', handler);
          reject(new Error('timeout waiting for event'));
        }, timeoutMs);
        const handler = (e: ServerEvent) => {
          if (predicate(e)) {
            clearTimeout(timer);
            socket.off('event', handler);
            resolve(e);
          }
        };
        socket.on('event', handler);
      });
    },
    expectNone(predicate, windowMs = 800) {
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          socket.off('event', handler);
          resolve();
        }, windowMs);
        const handler = (e: ServerEvent) => {
          if (predicate(e)) {
            clearTimeout(timer);
            socket.off('event', handler);
            reject(new Error(`unexpected event: ${e.type}`));
          }
        };
        socket.on('event', handler);
      });
    },
  };
}
