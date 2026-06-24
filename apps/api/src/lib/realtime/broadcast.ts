import { REALTIME_EVENT_NAME, type ServerEvent } from '@odovox/types';

/**
 * Broadcast indirection. Routes call `broadcastToClinic`/`broadcastToDoctor` after a transaction
 * commits (never before — clients must not see state that didn't persist). The actual Socket.IO
 * `io.to(room).emit(...)` is injected by the socket plugin (Stage 2) via `setRealtimeEmitter`, so
 * the command layer (REST) stays decoupled from the transport. Until injected, broadcasts no-op,
 * which is exactly what unit tests of the pure transition logic want.
 */
export type RealtimeEmitter = (room: string, eventName: string, event: ServerEvent) => void;

let emitter: RealtimeEmitter | null = null;

export function setRealtimeEmitter(fn: RealtimeEmitter | null): void {
  emitter = fn;
}

export function clinicRoom(clinicId: string): string {
  return `clinic:${clinicId}`;
}

export function doctorRoom(clinicId: string, doctorId: string): string {
  return `clinic:${clinicId}:doctor:${doctorId}`;
}

/** Fan an event out to every socket in a clinic (the doctor screens + receptionist screens). */
export function broadcastToClinic(clinicId: string, event: ServerEvent): void {
  emitter?.(clinicRoom(clinicId), REALTIME_EVENT_NAME, event);
}

/** Target only one doctor's sockets within a clinic. */
export function broadcastToDoctor(clinicId: string, doctorId: string, event: ServerEvent): void {
  emitter?.(doctorRoom(clinicId, doctorId), REALTIME_EVENT_NAME, event);
}
