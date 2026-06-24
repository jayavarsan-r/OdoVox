import type {
  ActivityItem,
  QueueDoctor,
  QueueRoom,
  QueueSnapshot,
  ServerEvent,
  VisitWithPatient,
} from '@odovox/types';

/**
 * The pure heart of the queue store. One state shape, one `applyEvent` transition — Socket.IO events
 * and the initial snapshot both flow through here, which is what makes reconnection seamless: the
 * server re-emits a full `queue.snapshot` and `hydrateState` resets us from the truth, no diffing.
 *
 * Out-of-order protection (§5.3): we track the highest `lifecycleVersion` seen per visit and ignore
 * any visit-updating event carrying a lower version. Terminal events (completed/cancelled) just drop
 * the row; recording events only toggle an ephemeral flag and don't carry a version.
 */
export interface QueueState {
  visits: Map<string, VisitWithPatient>;
  versions: Map<string, number>;
  doctors: QueueDoctor[];
  rooms: QueueRoom[];
  activity: ActivityItem[];
  lastSyncedAt: number;
}

const ACTIVITY_CAP = 50;

export function emptyQueueState(): QueueState {
  return { visits: new Map(), versions: new Map(), doctors: [], rooms: [], activity: [], lastSyncedAt: 0 };
}

export function hydrateState(snapshot: QueueSnapshot): QueueState {
  const visits = new Map<string, VisitWithPatient>();
  const versions = new Map<string, number>();
  for (const v of snapshot.visits) {
    visits.set(v.id, v);
    versions.set(v.id, v.lifecycleVersion);
  }
  return {
    visits,
    versions,
    doctors: snapshot.doctors,
    rooms: snapshot.rooms,
    activity: [],
    lastSyncedAt: Date.now(),
  };
}

function upsertVisit(state: QueueState, v: VisitWithPatient): QueueState {
  const seen = state.versions.get(v.id);
  if (seen !== undefined && v.lifecycleVersion < seen) return state; // stale — ignore (§5.3)
  const visits = new Map(state.visits);
  const versions = new Map(state.versions);
  visits.set(v.id, v);
  versions.set(v.id, v.lifecycleVersion);
  return { ...state, visits, versions };
}

function removeVisit(state: QueueState, visitId: string): QueueState {
  if (!state.visits.has(visitId)) return state;
  const visits = new Map(state.visits);
  const versions = new Map(state.versions);
  visits.delete(visitId);
  versions.delete(visitId);
  return { ...state, visits, versions };
}

function setRecording(state: QueueState, visitId: string, recording: boolean): QueueState {
  const existing = state.visits.get(visitId);
  if (!existing || existing.recording === recording) return state;
  const visits = new Map(state.visits);
  visits.set(visitId, { ...existing, recording });
  return { ...state, visits };
}

function prependActivity(state: QueueState, item: ActivityItem): QueueState {
  if (state.activity.some((a) => a.id === item.id)) return state; // dedupe (snapshot refetch + live)
  return { ...state, activity: [item, ...state.activity].slice(0, ACTIVITY_CAP) };
}

/** Seed the activity feed from GET /activity (the live `activity` events prepend on top of it). */
export function seedActivity(state: QueueState, items: ActivityItem[]): QueueState {
  return { ...state, activity: items.slice(0, ACTIVITY_CAP) };
}

export function applyEvent(state: QueueState, event: ServerEvent): QueueState {
  switch (event.type) {
    case 'queue.snapshot':
      // A reconnect snapshot is the truth for visits, but must NOT wipe the activity feed.
      return { ...hydrateState(event.payload), activity: state.activity };
    case 'queue.visit.checked_in':
    case 'queue.visit.called_in':
    case 'queue.visit.returned':
    case 'queue.visit.checkout':
    case 'queue.visit.reassigned':
    case 'queue.visit.priority_changed':
      return upsertVisit(state, event.payload);
    case 'queue.visit.completed':
    case 'queue.visit.cancelled':
      return removeVisit(state, event.payload.visitId);
    case 'doctor.recording.started':
      return setRecording(state, event.payload.visitId, true);
    case 'doctor.recording.stopped':
      return setRecording(state, event.payload.visitId, false);
    case 'activity':
      return prependActivity(state, event.payload);
    default:
      return state;
  }
}
