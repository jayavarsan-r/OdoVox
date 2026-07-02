'use client';

import { useCallback, useReducer, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import {
  DEFAULT_SILENCE,
  isSilent,
  shouldAutoStop,
  singleShotReducer,
  type SingleShotState,
} from './single-shot';
import { MAX_DICTATION_MS } from './voice-input';

interface DictationRefs {
  mr: MediaRecorder | null;
  stream: MediaStream | null;
  audioCtx: AudioContext | null;
  chunks: Blob[];
  mime: string;
  raf: number | null;
  silentSince: number | null;
  cancelled: boolean;
}

export interface DictationOptions {
  /** Hard stop after this long (Phase 9.7 safety cap — default 60s). */
  maxDurationMs?: number;
  /** Fires when the pipeline fails (mic denied, upload, provider) — for toast UX. */
  onError?: (err: unknown) => void;
}

const IDLE_BARS = [0.1, 0.1, 0.1, 0.1, 0.1];

/**
 * Shared single-shot dictation: record → auto-stop on ~1.5s silence (or the 60s cap) → presign →
 * upload → POST the dictate endpoint → hand the structured result to `onResult`. Used by every
 * <VoiceInput> surface — same recorder, narrower endpoints. No verification SSE. Also exposes a
 * 5-bar live amplitude array for the waveform.
 */
export function useDictation<T>(
  endpoint: string,
  onResult: (data: T) => void,
  extraBody: Record<string, unknown> = {},
  options: DictationOptions = {},
): {
  state: SingleShotState;
  bars: number[];
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
} {
  const [state, dispatch] = useReducer(singleShotReducer, { kind: 'idle' });
  const [bars, setBars] = useState<number[]>(IDLE_BARS);
  const refs = useRef<DictationRefs>({
    mr: null,
    stream: null,
    audioCtx: null,
    chunks: [],
    mime: 'audio/webm',
    raf: null,
    silentSince: null,
    cancelled: false,
  });

  const cleanup = useCallback(() => {
    if (refs.current.raf) cancelAnimationFrame(refs.current.raf);
    refs.current.stream?.getTracks().forEach((t) => t.stop());
    void refs.current.audioCtx?.close().catch(() => undefined);
    refs.current.raf = null;
    refs.current.stream = null;
    refs.current.audioCtx = null;
    refs.current.silentSince = null;
    setBars(IDLE_BARS);
  }, []);

  const finish = useCallback(async () => {
    const blob = new Blob(refs.current.chunks, { type: refs.current.mime });
    const mimeType = refs.current.mime.split(';')[0]!;
    try {
      const { uploadUrl, storageKey } = await api.post<{ uploadUrl: string; storageKey: string }>(
        '/dictate/presign',
        { mimeType, sizeBytes: blob.size },
      );
      await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': mimeType }, body: blob });
      const data = await api.post<T>(endpoint, { ...extraBody, storageKey });
      onResult(data);
      dispatch({ type: 'RESULT', transcript: '' });
    } catch (err) {
      options.onError?.(err);
      dispatch({ type: 'FAIL', error: err instanceof Error ? err.message : 'Dictation failed' });
    }
  }, [endpoint, extraBody, onResult, options.onError]);

  const start = useCallback(async () => {
    dispatch({ type: 'START' });
    refs.current.cancelled = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      refs.current.stream = stream;
      refs.current.mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      refs.current.chunks = [];
      const mr = new MediaRecorder(stream, { mimeType: refs.current.mime });
      mr.ondataavailable = (e) => e.data.size > 0 && refs.current.chunks.push(e.data);
      mr.onstop = () => {
        cleanup();
        if (refs.current.cancelled) {
          dispatch({ type: 'RESET' });
          return;
        }
        dispatch({ type: 'STOP' });
        void finish();
      };
      mr.start(250);
      refs.current.mr = mr;

      // Silence auto-stop + 60s cap + live bars via the analyser.
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      refs.current.audioCtx = audioCtx;
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const maxMs = options.maxDurationMs ?? MAX_DICTATION_MS;
      const startedAt = performance.now();
      const loop = () => {
        const now = performance.now();
        analyser.getByteFrequencyData(bins);
        const amps = Array.from(bins, (b) => b / 255);
        // 5 grouped bars for the waveform (same shape as the consult recorder).
        const group = Math.max(1, Math.floor(amps.length / 5));
        setBars(
          Array.from({ length: 5 }, (_, i) => {
            const slice = amps.slice(i * group, (i + 1) * group);
            return slice.length ? Math.max(...slice) : 0;
          }),
        );
        if (isSilent(amps)) {
          refs.current.silentSince ??= now;
        } else {
          refs.current.silentSince = null;
        }
        // Only auto-stop after at least 1s of audio (ignore the leading silence).
        const silentMs = refs.current.silentSince ? now - refs.current.silentSince : 0;
        const capHit = now - startedAt >= maxMs;
        if (((now - startedAt > 1000 && shouldAutoStop(silentMs, DEFAULT_SILENCE)) || capHit) && mr.state === 'recording') {
          mr.stop();
          return;
        }
        refs.current.raf = requestAnimationFrame(loop);
      };
      refs.current.raf = requestAnimationFrame(loop);
    } catch (err) {
      options.onError?.(err);
      dispatch({ type: 'FAIL', error: err instanceof Error ? err.message : 'Mic unavailable' });
    }
  }, [cleanup, finish, options.maxDurationMs, options.onError]);

  // Manual stop: end recording NOW and process it (same path as the silence auto-stop). The
  // MediaRecorder's onstop handler dispatches STOP → cleanup → finish(). We cancel the silence RAF
  // first so the loop can't also fire mr.stop().
  const stop = useCallback(() => {
    if (refs.current.raf) {
      cancelAnimationFrame(refs.current.raf);
      refs.current.raf = null;
    }
    if (refs.current.mr?.state === 'recording') refs.current.mr.stop();
  }, []);

  // Cancel: discard the clip entirely — nothing is uploaded or transcribed.
  const cancel = useCallback(() => {
    refs.current.cancelled = true;
    if (refs.current.mr?.state === 'recording') {
      refs.current.mr.stop();
      return; // onstop sees cancelled → RESET
    }
    cleanup();
    dispatch({ type: 'RESET' });
  }, [cleanup]);

  return { state, bars, start, stop, cancel };
}
