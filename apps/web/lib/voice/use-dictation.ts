'use client';

import { useCallback, useReducer, useRef } from 'react';
import { api } from '@/lib/api-client';
import {
  DEFAULT_SILENCE,
  isSilent,
  shouldAutoStop,
  singleShotReducer,
  type SingleShotState,
} from './single-shot';

interface DictationRefs {
  mr: MediaRecorder | null;
  stream: MediaStream | null;
  audioCtx: AudioContext | null;
  chunks: Blob[];
  mime: string;
  raf: number | null;
  silentSince: number | null;
}

/**
 * Shared single-shot dictation: record → auto-stop on ~1.5s silence → presign → upload → POST the
 * dictate endpoint → hand the structured result to `onResult`. Used by the search mic, the patient
 * intake sheet, and the prescription sheet — same recorder, narrower endpoints. No verification SSE.
 */
export function useDictation<T>(
  endpoint: string,
  onResult: (data: T) => void,
  extraBody: Record<string, unknown> = {},
): { state: SingleShotState; start: () => Promise<void>; cancel: () => void } {
  const [state, dispatch] = useReducer(singleShotReducer, { kind: 'idle' });
  const refs = useRef<DictationRefs>({
    mr: null,
    stream: null,
    audioCtx: null,
    chunks: [],
    mime: 'audio/webm',
    raf: null,
    silentSince: null,
  });

  const cleanup = useCallback(() => {
    if (refs.current.raf) cancelAnimationFrame(refs.current.raf);
    refs.current.stream?.getTracks().forEach((t) => t.stop());
    void refs.current.audioCtx?.close().catch(() => undefined);
    refs.current.raf = null;
    refs.current.stream = null;
    refs.current.audioCtx = null;
    refs.current.silentSince = null;
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
      dispatch({ type: 'FAIL', error: err instanceof Error ? err.message : 'Dictation failed' });
    }
  }, [endpoint, extraBody, onResult]);

  const start = useCallback(async () => {
    dispatch({ type: 'START' });
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
        dispatch({ type: 'STOP' });
        cleanup();
        void finish();
      };
      mr.start(250);
      refs.current.mr = mr;

      // Silence auto-stop via the analyser.
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      refs.current.audioCtx = audioCtx;
      const bins = new Uint8Array(analyser.frequencyBinCount);
      let last = performance.now();
      const startedAt = last;
      const loop = () => {
        const now = performance.now();
        analyser.getByteFrequencyData(bins);
        const amps = Array.from(bins, (b) => b / 255);
        if (isSilent(amps)) {
          refs.current.silentSince ??= now;
        } else {
          refs.current.silentSince = null;
        }
        // Only auto-stop after at least 1s of audio (ignore the leading silence).
        const silentMs = refs.current.silentSince ? now - refs.current.silentSince : 0;
        if (now - startedAt > 1000 && shouldAutoStop(silentMs, DEFAULT_SILENCE) && mr.state === 'recording') {
          mr.stop();
          return;
        }
        last = now;
        refs.current.raf = requestAnimationFrame(loop);
      };
      refs.current.raf = requestAnimationFrame(loop);
    } catch (err) {
      dispatch({ type: 'FAIL', error: err instanceof Error ? err.message : 'Mic unavailable' });
    }
  }, [cleanup, finish]);

  const cancel = useCallback(() => {
    if (refs.current.mr?.state === 'recording') refs.current.mr.stop();
    cleanup();
    dispatch({ type: 'RESET' });
  }, [cleanup]);

  return { state, start, cancel };
}
