import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Phase 9.6 Issue 7: Sarvam's batch endpoint caps a submission at ~30 seconds, but rich clinical
 * dictations run 1-3 minutes. Long audio is split into overlapping chunks server-side, each chunk
 * transcribed separately, and the transcripts merged. Pure planning/merging lives here (unit
 * tested); the actual slicing shells out to ffmpeg/ffprobe (present on the host; override the
 * binaries with FFMPEG_PATH / FFPROBE_PATH).
 */

export interface AudioChunk {
  startMs: number;
  durationMs: number;
}

/** How the provider probes and slices audio — injectable so tests never need ffmpeg. */
export interface SttAudioTools {
  getDurationMs(audio: Buffer, mimeType: string): Promise<number>;
  /** Returns the slice re-encoded as 16k mono WAV (Sarvam-friendly, seek-accurate). */
  sliceAudio(audio: Buffer, mimeType: string, chunk: AudioChunk): Promise<{ audio: Buffer; mimeType: string }>;
}

/** Split a duration into ≤maxChunkMs windows overlapping by overlapMs (so words at a cut survive). */
export function chunkPlan(durationMs: number, maxChunkMs = 25_000, overlapMs = 3_000): AudioChunk[] {
  if (durationMs <= 0) return [];
  const step = maxChunkMs - overlapMs;
  if (step <= 0) throw new Error('overlapMs must be smaller than maxChunkMs');
  const chunks: AudioChunk[] = [];
  for (let start = 0; start < durationMs; start += step) {
    const len = Math.min(maxChunkMs, durationMs - start);
    chunks.push({ startMs: start, durationMs: len });
    if (start + len >= durationMs) break;
  }
  return chunks;
}

/** Concatenate chunk transcripts in order; blank chunks (silence) drop out. */
export function mergeTranscripts(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');
}

const extOf = (mime: string): string => mime.split(';')[0]!.split('/')[1] ?? 'webm';

async function withTempFile<T>(audio: Buffer, mime: string, fn: (path: string, dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'odovox-stt-'));
  const input = join(dir, `in.${extOf(mime)}`);
  try {
    await writeFile(input, audio);
    return await fn(input, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Real ffmpeg/ffprobe implementation. */
export const ffmpegAudioTools: SttAudioTools = {
  async getDurationMs(audio, mimeType) {
    const ffprobe = process.env.FFPROBE_PATH ?? 'ffprobe';
    return withTempFile(audio, mimeType, async (input) => {
      const { stdout } = await execFileAsync(ffprobe, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        input,
      ]);
      const seconds = Number.parseFloat(stdout.trim());
      if (!Number.isFinite(seconds)) throw new Error(`ffprobe returned no duration: ${stdout}`);
      return Math.round(seconds * 1000);
    });
  },

  async sliceAudio(audio, mimeType, chunk) {
    const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
    return withTempFile(audio, mimeType, async (input, dir) => {
      const output = join(dir, 'out.wav');
      await execFileAsync(ffmpeg, [
        '-y',
        '-i', input,
        '-ss', (chunk.startMs / 1000).toFixed(3),
        '-t', (chunk.durationMs / 1000).toFixed(3),
        '-ar', '16000',
        '-ac', '1',
        '-f', 'wav',
        output,
      ]);
      return { audio: await readFile(output), mimeType: 'audio/wav' };
    });
  },
};
