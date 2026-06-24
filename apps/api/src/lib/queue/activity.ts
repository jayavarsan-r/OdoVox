import type { QueueEvent } from '@odovox/db';
import type { ActivityItem } from '@odovox/types';

/** First name only — the activity feed reads tighter as "Asha called Akhilesh in". */
function first(name: string | null | undefined): string {
  if (!name) return 'Someone';
  return name.replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '').trim().split(/\s+/)[0] ?? name;
}

/** Human-readable copy for a queue event. Pure — unit-tested for every event type. */
export function renderActivityText(
  type: QueueEvent['type'],
  patientName: string,
  byUserName: string | null,
): string {
  const by = first(byUserName);
  const p = first(patientName);
  switch (type) {
    case 'CHECKED_IN':
      return `${by} checked ${p} in`;
    case 'CALLED_IN':
      return `${by} called ${p} in`;
    case 'RETURNED_TO_QUEUE':
      return `${by} sent ${p} back to the queue`;
    case 'CHECKOUT_STARTED':
      return `${p} is ready for checkout`;
    case 'COMPLETED':
      return `${by} completed ${p}'s visit`;
    case 'CANCELLED':
      return `${by} cancelled ${p}'s visit`;
    case 'REASSIGNED':
      return `${by} reassigned ${p}`;
    case 'PRIORITY_CHANGED':
      return `${by} changed ${p}'s priority`;
    case 'DOCTOR_RECORDING':
      return `${by} is recording ${p}`;
    case 'DOCTOR_RECORDING_DONE':
      return `${by} finished recording ${p}`;
    default:
      return `${p}`;
  }
}

export function buildActivityItem(
  event: QueueEvent,
  patientName: string,
  byUserName: string | null,
): ActivityItem {
  return {
    id: event.id,
    type: event.type,
    visitId: event.visitId,
    patientId: event.patientId,
    patientName,
    byUserId: event.byUserId ?? null,
    byUserName: byUserName ?? null,
    text: renderActivityText(event.type, patientName, byUserName),
    metadata: (event.metadata as Record<string, unknown>) ?? {},
    createdAt: event.createdAt,
  };
}
