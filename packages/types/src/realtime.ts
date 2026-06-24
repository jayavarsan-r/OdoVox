import { z } from 'zod';
import { ConsultationStatus, QueueEventType, RoomStatus, VisitStatus } from './common.js';

/**
 * Realtime (Socket.IO) event contract — the single source of truth shared by the API broadcast
 * helpers and the web queue store. Server → Client only: ALL mutations go through REST (which is
 * where RBAC/validation/audit/rate-limit live), and the REST handler broadcasts after commit.
 * The WebSocket is the broadcast channel; REST is the command channel.
 */

// ---------------------------------------------------------------------------
// Queue row — a visit enriched with the patient / doctor / room / bill context the UI renders.
// ---------------------------------------------------------------------------
export const QueuePatientZ = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int(),
  patientCode: z.string(),
  phone: z.string(),
  medicalFlags: z.array(z.string()).default([]),
});
export type QueuePatient = z.infer<typeof QueuePatientZ>;

export const VisitWithPatientZ = z.object({
  id: z.string(),
  clinicId: z.string(),
  status: VisitStatus,
  tokenNumber: z.number().int(),
  priority: z.number().int(),
  /** Optimistic-lock counter. The store rejects any incoming event with a lower version (§5.3). */
  lifecycleVersion: z.number().int(),
  chiefComplaint: z.string().nullable(),
  assignedDoctorId: z.string().nullable(),
  doctorId: z.string(),
  doctorName: z.string().nullable(),
  roomId: z.string().nullable(),
  roomName: z.string().nullable(),
  patient: QueuePatientZ,
  /** Present once a consultation has been started for this visit — lets the doctor jump to it. */
  consultationId: z.string().nullable(),
  consultationStatus: ConsultationStatus.nullable(),
  /** Whether a doctor is recording into this visit's consultation right now (ephemeral). */
  recording: z.boolean().default(false),
  billTotalPaise: z.number().int().nullable(),
  billDuePaise: z.number().int().nullable(),
  checkedInAt: z.coerce.date().nullable(),
  calledInAt: z.coerce.date().nullable(),
  checkoutStartedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type VisitWithPatient = z.infer<typeof VisitWithPatientZ>;

// ---------------------------------------------------------------------------
// Snapshot — full current queue state for a clinic, emitted on connect / reconnect.
// ---------------------------------------------------------------------------
export const QueueDoctorZ = z.object({
  id: z.string(),
  name: z.string(),
  /** Off-today flag from DoctorAvailability (Phase 6 owns the real scheduling; we just read it). */
  available: z.boolean().default(true),
});
export type QueueDoctor = z.infer<typeof QueueDoctorZ>;

export const QueueRoomZ = z.object({
  id: z.string(),
  name: z.string(),
  number: z.string(),
  status: RoomStatus,
});
export type QueueRoom = z.infer<typeof QueueRoomZ>;

export const QueueSnapshotZ = z.object({
  visits: z.array(VisitWithPatientZ),
  doctors: z.array(QueueDoctorZ),
  rooms: z.array(QueueRoomZ),
  serverTime: z.coerce.date(),
});
export type QueueSnapshot = z.infer<typeof QueueSnapshotZ>;

// ---------------------------------------------------------------------------
// Activity feed item — a human-readable rendering of a QueueEvent.
// ---------------------------------------------------------------------------
export const ActivityItemZ = z.object({
  id: z.string(),
  type: QueueEventType,
  visitId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  byUserId: z.string().nullable(),
  byUserName: z.string().nullable(),
  /** Pre-rendered copy, e.g. "Asha called Akhilesh in". */
  text: z.string(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.coerce.date(),
});
export type ActivityItem = z.infer<typeof ActivityItemZ>;

// ---------------------------------------------------------------------------
// Server → Client event union.
//
// DEVIATION (flagged): §2.3 specified minimal payloads (`{ visitId }`, `{ visitId, priority }`,
// `{ visitId, toDoctorId }`) for returned / reassigned / priority_changed. We instead send the
// full VisitWithPatient for every event where the visit REMAINS in the active queue, because §5.3
// requires every visit-updating event to carry `lifecycleVersion` for out-of-order rejection — the
// minimal payloads couldn't satisfy that. Events where the visit LEAVES the queue (completed,
// cancelled) keep the minimal `{ visitId }` shape since the store just drops the row.
// `queue.visit.cancelled` is added (referenced by §6.2 but absent from the §2.3 list).
// ---------------------------------------------------------------------------
export const ServerEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('queue.snapshot'), payload: QueueSnapshotZ }),
  z.object({ type: z.literal('queue.visit.checked_in'), payload: VisitWithPatientZ }),
  z.object({ type: z.literal('queue.visit.called_in'), payload: VisitWithPatientZ }),
  z.object({ type: z.literal('queue.visit.returned'), payload: VisitWithPatientZ }),
  z.object({ type: z.literal('queue.visit.checkout'), payload: VisitWithPatientZ }),
  z.object({ type: z.literal('queue.visit.reassigned'), payload: VisitWithPatientZ }),
  z.object({ type: z.literal('queue.visit.priority_changed'), payload: VisitWithPatientZ }),
  z.object({ type: z.literal('queue.visit.completed'), payload: z.object({ visitId: z.string() }) }),
  z.object({
    type: z.literal('queue.visit.cancelled'),
    payload: z.object({ visitId: z.string(), reason: z.string().nullable() }),
  }),
  z.object({
    type: z.literal('doctor.recording.started'),
    payload: z.object({ visitId: z.string(), doctorId: z.string(), patientName: z.string() }),
  }),
  z.object({
    type: z.literal('doctor.recording.stopped'),
    payload: z.object({ visitId: z.string(), doctorId: z.string() }),
  }),
  z.object({ type: z.literal('activity'), payload: ActivityItemZ }),
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
export type ServerEventType = ServerEvent['type'];

/** The single Socket.IO message name every server event rides on (`socket.emit('event', …)`). */
export const REALTIME_EVENT_NAME = 'event' as const;
