'use client';

import { create } from 'zustand';
import type { ClinicalExtraction } from '@odovox/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import {
  consultReducer,
  deriveStateFromView,
  initialState,
  type ConsultAction,
  type ConsultState,
} from './machine';
import { toPatchBody } from './editors';
import { blockingErrorsFromError } from './confirm-errors';
import { activeWarningCodes, hasUnresolvedBlocking } from './safety-view';
import type { ConsultationView, ConsultEvent } from './types';
import { openConsultStream } from './sse';
import {
  elapsedMs,
  pauseClock,
  resumeClock,
  startClock,
  type RecordingClock,
} from './recording-clock';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const MAX_RECORD_MS = 180_000;

interface RecorderRefs {
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
  analyser: AnalyserNode | null;
  audioCtx: AudioContext | null;
  chunks: Blob[];
  blob: Blob | null;
  mimeType: string;
  clock: RecordingClock;
  raf: number | null;
  timer: ReturnType<typeof setInterval> | null;
}

const refs: RecorderRefs = {
  mediaRecorder: null,
  stream: null,
  analyser: null,
  audioCtx: null,
  chunks: [],
  blob: null,
  mimeType: 'audio/webm',
  clock: { startedAt: 0, pausedMs: 0, pauseStartedAt: null },
  raf: null,
  timer: null,
};

let closeStream: (() => void) | null = null;

interface ConsultStore {
  state: ConsultState;
  consultationId: string | null;
  amplitude: number[];
  dispatch: (action: ConsultAction) => void;
  init: (consultationId: string) => Promise<void>;
  beginRecording: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  sendForReview: () => Promise<void>;
  edit: (data: ClinicalExtraction) => void;
  confirm: () => Promise<void>;
  reject: (reason?: string) => Promise<void>;
  rerecord: () => Promise<void>;
  teardown: () => void;
}

function stopMedia(): void {
  if (refs.raf) cancelAnimationFrame(refs.raf);
  if (refs.timer) clearInterval(refs.timer);
  refs.raf = null;
  refs.timer = null;
  refs.stream?.getTracks().forEach((t) => t.stop());
  void refs.audioCtx?.close().catch(() => undefined);
  refs.stream = null;
  refs.analyser = null;
  refs.audioCtx = null;
}

export const useConsultStore = create<ConsultStore>((set, get) => ({
  state: initialState,
  consultationId: null,
  amplitude: [0, 0, 0, 0, 0],

  dispatch: (action) => set((s) => ({ state: consultReducer(s.state, action) })),

  init: async (consultationId) => {
    set({ consultationId });
    try {
      const view = await api.get<ConsultationView>(`/consultations/${consultationId}`);
      set({ state: deriveStateFromView(view) });
    } catch {
      set({ state: { kind: 'IDLE' } });
    }
  },

  beginRecording: async () => {
    get().dispatch({ type: 'REQUEST_PERMISSION' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16_000, echoCancellation: true, noiseSuppression: true },
      });
      refs.stream = stream;
      refs.mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      refs.chunks = [];
      refs.blob = null;
      const mr = new MediaRecorder(stream, { mimeType: refs.mimeType });
      mr.ondataavailable = (e) => e.data.size > 0 && refs.chunks.push(e.data);
      mr.start(250);
      refs.mediaRecorder = mr;
      refs.clock = startClock(Date.now());

      // Live waveform via an analyser node.
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      refs.audioCtx = audioCtx;
      refs.analyser = analyser;
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const tickWave = () => {
        analyser.getByteFrequencyData(bins);
        const step = Math.floor(bins.length / 5);
        const bars = Array.from({ length: 5 }, (_, i) => bins[i * step]! / 255);
        set({ amplitude: bars });
        refs.raf = requestAnimationFrame(tickWave);
      };
      tickWave();

      get().dispatch({ type: 'PERMISSION_GRANTED' });
      refs.timer = setInterval(() => {
        // elapsedMs freezes while paused — so the on-screen timer stops, and the displayed duration
        // tracks the actual recorded audio (the Phase-3 bug was pausedMs never being updated).
        const elapsed = elapsedMs(refs.clock, Date.now());
        if (elapsed >= MAX_RECORD_MS) get().stop();
        else get().dispatch({ type: 'TICK', durationMs: elapsed });
      }, 200);
    } catch (err) {
      get().dispatch({ type: 'PERMISSION_DENIED', error: err instanceof Error ? err.message : 'Mic unavailable' });
    }
  },

  pause: () => {
    if (refs.mediaRecorder?.state !== 'recording') return;
    refs.mediaRecorder.pause();
    refs.clock = pauseClock(refs.clock, Date.now());
    get().dispatch({ type: 'PAUSE' });
  },
  resume: () => {
    if (refs.mediaRecorder?.state !== 'paused') return;
    refs.mediaRecorder.resume();
    refs.clock = resumeClock(refs.clock, Date.now());
    get().dispatch({ type: 'RESUME' });
  },

  stop: () => {
    const mr = refs.mediaRecorder;
    if (!mr) return;
    const durationMs = elapsedMs(refs.clock, Date.now());
    mr.onstop = () => {
      refs.blob = new Blob(refs.chunks, { type: refs.mimeType });
    };
    mr.stop();
    stopMedia();
    get().dispatch({ type: 'STOP', durationMs });
  },

  sendForReview: async () => {
    const { consultationId } = get();
    if (!consultationId || !refs.blob) return;
    try {
      get().dispatch({ type: 'UPLOAD_START' });
      const { uploadUrl } = await api.post<{ uploadUrl: string; storageKey: string }>(
        '/consultations/audio/presign',
        { consultationId, mimeType: refs.mimeType.split(';')[0], sizeBytes: refs.blob.size },
      );
      await fetch(uploadUrl, { method: 'PUT', body: refs.blob, headers: { 'Content-Type': refs.mimeType.split(';')[0]! } });
      get().dispatch({ type: 'UPLOAD_PROGRESS', progress: 1 });
      await api.post(`/consultations/${consultationId}/process`, {});
      get().dispatch({ type: 'PROCESS_STARTED' });
      closeStream?.();
      closeStream = openConsultStream(
        API_URL,
        consultationId,
        useAuth.getState().accessToken,
        (event: ConsultEvent) => get().dispatch({ type: 'SERVER_EVENT', event }),
        async () => {
          // Stream dropped — refetch + re-derive so the doctor never sees a frozen bar.
          try {
            const view = await api.get<ConsultationView>(`/consultations/${consultationId}`);
            get().dispatch({ type: 'HYDRATE', view });
          } catch {
            /* keep last state */
          }
        },
      );
    } catch (err) {
      get().dispatch({ type: 'FAIL', step: 'upload', error: err instanceof Error ? err.message : 'Upload failed' });
    }
  },

  edit: (data) => {
    const { consultationId } = get();
    get().dispatch({ type: 'EDIT', data });
    if (consultationId) void api.patch(`/consultations/${consultationId}`, toPatchBody(data)).catch(() => undefined);
  },

  confirm: async () => {
    const { consultationId, state } = get();
    if (!consultationId || (state.kind !== 'VERIFY' && state.kind !== 'CONFIRMING')) return;
    const data = state.data;
    const confirmedWithWarning = state.safety.some((w) => !w.resolved);
    if (hasUnresolvedBlocking(state.safety)) return; // UI also disables the button
    get().dispatch({ type: 'CONFIRM_START' });
    try {
      await api.post(`/consultations/${consultationId}/confirm`, {
        structuredData: data,
        confirmedWithWarning,
        activeWarnings: activeWarningCodes(state.safety),
      });
      get().dispatch({ type: 'CONFIRM_DONE' });
    } catch (err) {
      // A 422 BLOCKING_ERRORS is not an exception — it's the safety gate. Feed the server's errors
      // back into the machine so the card surfaces them; only unexpected failures propagate.
      const blocking = blockingErrorsFromError(err);
      if (blocking) {
        get().dispatch({ type: 'BLOCKING_ERRORS_SURFACED', errors: blocking });
        return;
      }
      get().dispatch({ type: 'CONFIRM_FAILED' });
      throw err;
    }
  },

  reject: async (reason) => {
    const { consultationId } = get();
    if (consultationId) await api.post(`/consultations/${consultationId}/reject`, { reason }).catch(() => undefined);
    get().dispatch({ type: 'REJECT', reason });
  },

  rerecord: async () => {
    const { consultationId } = get();
    if (consultationId) {
      await api.post(`/consultations/${consultationId}/reject`, { reason: 'doctor re-recorded' }).catch(() => undefined);
    }
    get().dispatch({ type: 'RERECORD' });
  },

  teardown: () => {
    stopMedia();
    closeStream?.();
    closeStream = null;
    set({ state: initialState, consultationId: null, amplitude: [0, 0, 0, 0, 0] });
  },
}));
