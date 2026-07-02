import { ClinicalExtraction } from '@odovox/types';
import { buildSafetyView, type SafetyPayload, type SafetyViewItem, type SafetyWarning } from './safety-view.js';
import { extractSafetyPayload, type ConsultationView, type ConsultEvent } from './types.js';

/**
 * The single source of truth for a consultation's UI state. One type owns it (`ConsultState`), one
 * function transitions it (`consultReducer`). Components only READ from the store that wraps this.
 * SSE events and refetches both flow through here — which is what makes reconnection seamless: if the
 * stream drops, `deriveStateFromView(refetched)` reproduces the exact state and no component notices.
 */
export type ConsultState =
  | { kind: 'IDLE' }
  | { kind: 'REQUESTING_PERMISSION' }
  | { kind: 'RECORDING'; durationMs: number }
  | { kind: 'PAUSED'; durationMs: number }
  | { kind: 'STOPPED'; durationMs: number }
  | { kind: 'UPLOADING'; progress: number }
  | { kind: 'TRANSCRIBING'; transcript?: string }
  | { kind: 'TRANSCRIBED'; transcript: string }
  | { kind: 'EXTRACTING' }
  | { kind: 'VERIFY'; data: ClinicalExtraction; safety: SafetyViewItem[] }
  | { kind: 'CONFIRMING'; data: ClinicalExtraction; safety: SafetyViewItem[] }
  | { kind: 'CONFIRMED' }
  | { kind: 'REJECTED'; reason?: string }
  | { kind: 'FAILED'; step: string; error: string };

export type ConsultAction =
  | { type: 'REQUEST_PERMISSION' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED'; error: string }
  | { type: 'TICK'; durationMs: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP'; durationMs: number }
  | { type: 'RERECORD' }
  | { type: 'UPLOAD_START' }
  | { type: 'UPLOAD_PROGRESS'; progress: number }
  | { type: 'PROCESS_STARTED' }
  | { type: 'SERVER_EVENT'; event: ConsultEvent }
  | { type: 'EDIT'; data: ClinicalExtraction }
  | { type: 'CONFIRM_START' }
  | { type: 'CONFIRM_DONE' }
  | { type: 'CONFIRM_FAILED' }
  | { type: 'BLOCKING_ERRORS_SURFACED'; errors: SafetyWarning[] }
  | { type: 'REJECT'; reason?: string }
  | { type: 'FAIL'; step: string; error: string }
  | { type: 'HYDRATE'; view: ConsultationView };

export const initialState: ConsultState = { kind: 'IDLE' };

/** Rebuild the raw safety payload from a view (so EDIT can re-evaluate resolution, keeping warnings). */
function viewToPayload(items: SafetyViewItem[]): SafetyPayload {
  const strip = ({ code, message, field, detail }: SafetyViewItem) => ({ code, message, field, detail });
  return {
    warnings: items.filter((i) => !i.blocking).map(strip),
    blockingErrors: items.filter((i) => i.blocking).map(strip),
  };
}

function toVerify(structuredData: Record<string, unknown>): ConsultState {
  const data = ClinicalExtraction.parse(structuredData);
  return { kind: 'VERIFY', data, safety: buildSafetyView(extractSafetyPayload(structuredData), data) };
}

export function consultReducer(state: ConsultState, action: ConsultAction): ConsultState {
  switch (action.type) {
    case 'RERECORD':
      return { kind: 'IDLE' };
    case 'HYDRATE':
      return deriveStateFromView(action.view);
    case 'FAIL':
      return { kind: 'FAILED', step: action.step, error: action.error };
    case 'REJECT':
      return { kind: 'REJECTED', reason: action.reason };
    case 'REQUEST_PERMISSION':
      return { kind: 'REQUESTING_PERMISSION' };
    case 'PERMISSION_GRANTED':
      return { kind: 'RECORDING', durationMs: 0 };
    case 'PERMISSION_DENIED':
      return { kind: 'FAILED', step: 'permission', error: action.error };
    case 'TICK':
      return state.kind === 'RECORDING' ? { kind: 'RECORDING', durationMs: action.durationMs } : state;
    case 'PAUSE':
      return state.kind === 'RECORDING' ? { kind: 'PAUSED', durationMs: state.durationMs } : state;
    case 'RESUME':
      return state.kind === 'PAUSED' ? { kind: 'RECORDING', durationMs: state.durationMs } : state;
    case 'STOP':
      return state.kind === 'RECORDING' || state.kind === 'PAUSED'
        ? { kind: 'STOPPED', durationMs: action.durationMs }
        : state;
    case 'UPLOAD_START':
      return { kind: 'UPLOADING', progress: 0 };
    case 'UPLOAD_PROGRESS':
      return state.kind === 'UPLOADING' ? { kind: 'UPLOADING', progress: action.progress } : state;
    case 'PROCESS_STARTED':
      return { kind: 'TRANSCRIBING' };
    case 'CONFIRM_START':
      return state.kind === 'VERIFY' ? { kind: 'CONFIRMING', data: state.data, safety: state.safety } : state;
    case 'CONFIRM_DONE':
      return { kind: 'CONFIRMED' };
    case 'CONFIRM_FAILED':
      return state.kind === 'CONFIRMING' ? { kind: 'VERIFY', data: state.data, safety: state.safety } : state;
    case 'BLOCKING_ERRORS_SURFACED': {
      // The server re-ran safety on the final data and refused the confirm (422). Its blocking list
      // is authoritative — replace ours with it, keep existing warnings, and return to VERIFY so the
      // card renders each error and the CTA stays gated until the doctor fixes the fields.
      if (state.kind !== 'CONFIRMING' && state.kind !== 'VERIFY') return state;
      const { warnings } = viewToPayload(state.safety);
      return {
        kind: 'VERIFY',
        data: state.data,
        safety: buildSafetyView({ warnings, blockingErrors: action.errors }, state.data),
      };
    }
    case 'EDIT': {
      if (state.kind !== 'VERIFY' && state.kind !== 'CONFIRMING') return state;
      return { kind: 'VERIFY', data: action.data, safety: buildSafetyView(viewToPayload(state.safety), action.data) };
    }
    case 'SERVER_EVENT':
      return applyServerEvent(state, action.event);
    default:
      return state;
  }
}

function applyServerEvent(state: ConsultState, event: ConsultEvent): ConsultState {
  switch (event.type) {
    case 'RECORDED':
    case 'TRANSCRIBING':
      return { kind: 'TRANSCRIBING' };
    case 'TRANSCRIBED':
      return { kind: 'TRANSCRIBED', transcript: event.data?.transcript ?? '' };
    case 'EXTRACTING':
      return { kind: 'EXTRACTING' };
    case 'READY':
      return event.data?.structuredData ? toVerify(event.data.structuredData) : state;
    case 'FAILED':
      return { kind: 'FAILED', step: event.data?.stage ?? 'pipeline', error: event.data?.message ?? 'Failed' };
    default:
      return state;
  }
}

/** Reconstruct the UI state from a freshly-fetched consultation (reconnect / first load). */
export function deriveStateFromView(view: ConsultationView): ConsultState {
  if (view.status === 'CONFIRMED') return { kind: 'CONFIRMED' };
  if (view.status === 'REJECTED') return { kind: 'REJECTED' };

  const job = view.latestJob;
  if (job?.status === 'FAILED') return { kind: 'FAILED', step: job.kind, error: job.lastError ?? 'Failed' };

  const data = ClinicalExtraction.parse(view.structuredData ?? {});
  const extracted =
    data.procedure != null ||
    data.teeth.length > 0 ||
    data.prescriptions.length > 0 ||
    data.toothStatusUpdates.length > 0;

  if (extracted && (!job || job.status === 'SUCCEEDED')) return toVerify(view.structuredData);
  if (job && (job.status === 'RUNNING' || job.status === 'QUEUED')) {
    return job.kind.startsWith('EXTRACTION') ? { kind: 'EXTRACTING' } : { kind: 'TRANSCRIBING' };
  }
  return { kind: 'IDLE' };
}
