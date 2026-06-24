'use client';

import { io, type Socket } from 'socket.io-client';
import { REALTIME_EVENT_NAME, ServerEvent } from '@odovox/types';
import type { RealtimeStatus } from './status';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type EventHandler = (event: ServerEvent) => void;
type StatusHandler = (status: RealtimeStatus) => void;

/**
 * Singleton Socket.IO client. Read-mostly: it subscribes and surfaces typed `ServerEvent`s; every
 * mutation goes through REST. Auto-reconnect + backoff are Socket.IO's; the `auth` callback re-reads
 * the access token on EVERY (re)connection attempt, so a token that rotated while we were away is
 * picked up automatically. If the server rejects auth (token expired after a long offline), we
 * trigger a refresh and Socket.IO retries with the fresh token.
 */
class RealtimeClient {
  private socket: Socket | null = null;
  private status: RealtimeStatus = 'disconnected';
  private readonly eventHandlers = new Set<EventHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();
  private getToken: () => string | null = () => null;
  private onAuthError: () => Promise<void> = async () => {};

  connect(getToken: () => string | null, onAuthError: () => Promise<void>): void {
    this.getToken = getToken;
    this.onAuthError = onAuthError;
    if (this.socket) return; // already connected/connecting
    this.setStatus('connecting');

    const socket = io(API_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 60_000, // cap backoff at 60s (§5.1)
      auth: (cb) => cb({ token: this.getToken() ?? '' }),
    });

    socket.on('connect', () => this.setStatus('connected'));
    socket.on('disconnect', (reason) => {
      // Manual disconnect → stay disconnected; anything else → Socket.IO will retry.
      this.setStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
    });
    socket.on('connect_error', (err) => {
      this.setStatus(socket.active ? 'reconnecting' : 'disconnected');
      if (isAuthError(err.message)) void this.onAuthError(); // refresh; next retry sends fresh token
    });
    socket.io.on('reconnect_attempt', () => this.setStatus('reconnecting'));

    socket.on(REALTIME_EVENT_NAME, (raw: unknown) => {
      const parsed = ServerEvent.safeParse(raw);
      if (parsed.success) {
        for (const h of this.eventHandlers) h(parsed.data);
      }
    });

    this.socket = socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus('disconnected');
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status); // emit current immediately
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): RealtimeStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected';
  }

  private setStatus(status: RealtimeStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const h of this.statusHandlers) h(status);
  }
}

function isAuthError(message: string): boolean {
  return message === 'AUTH_INVALID' || message === 'AUTH_MISSING' || message === 'NO_ACTIVE_MEMBERSHIP';
}

export const realtime = new RealtimeClient();
