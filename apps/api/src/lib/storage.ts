import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from './env.js';

/**
 * S3-compatible object storage (MinIO in dev). All media lives in one private bucket;
 * access is always via short-lived signed URLs. Large uploads go *directly* browser→bucket
 * via a presigned PUT so we never proxy bytes through the API.
 */

const MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/** Audio mimes accepted for consultation recordings (browser MediaRecorder output + fallbacks). */
const AUDIO_MIME_ALLOWLIST = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
]);

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // ~3min webm/opus, generous headroom

export function isAllowedMime(mime: string): boolean {
  return MIME_ALLOWLIST.has(mime);
}

export function isAllowedAudioMime(mime: string): boolean {
  // Strip any codec suffix, e.g. "audio/webm;codecs=opus".
  return AUDIO_MIME_ALLOWLIST.has(mime.split(';')[0]!.trim());
}

export function extForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (!cachedClient) {
    const env = loadEnv();
    cachedClient = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }
  return cachedClient;
}

function bucket(): string {
  return loadEnv().S3_BUCKET;
}

export const storage = {
  async putObject(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    await client().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
    );
  },

  /** Short-lived signed GET URL (default 5 minutes). */
  async getSignedUrl(key: string, expiresIn = 300): Promise<string> {
    return presign(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
  },

  /** Download an object's bytes (workers pull audio from S3, never proxy through the API). */
  async getObject(key: string): Promise<Buffer> {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  },

  /** Signed PUT URL for a direct browser upload (default 5 minutes). */
  async presignUpload(key: string, contentType: string, expiresIn = 300): Promise<string> {
    return presign(
      client(),
      new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
      { expiresIn },
    );
  },

  async deleteObject(key: string): Promise<void> {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },
};
