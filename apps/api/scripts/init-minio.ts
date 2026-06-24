import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';

/**
 * One-shot: ensure the media bucket exists and CORS allows direct browser uploads.
 * Invoked by `pnpm db:seed` and documented in the README. Degrades gracefully (exit 0)
 * if MinIO isn't reachable so a DB-only seed still succeeds.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../.env') });

const ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const BUCKET = process.env.S3_BUCKET ?? 'odovox-media';
const WEB_ORIGIN = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',')[0]!.trim();

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'odovox',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'odovox-dev-password',
  },
});

async function main(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.warn(`✓ Bucket "${BUCKET}" already exists`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.warn(`✓ Created bucket "${BUCKET}"`);
  }

  // MinIO doesn't implement the S3 PutBucketCors API (it serves permissive CORS by default
  // in dev), so this is best-effort and never fatal. Real S3/R2 honour it.
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [WEB_ORIGIN],
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }),
    );
    console.warn(`✓ CORS configured for ${WEB_ORIGIN}`);
  } catch {
    console.warn(`• CORS not set via API (MinIO uses permissive dev CORS) — ok for dev`);
  }
}

main().catch((err) => {
  console.warn(
    `⚠ MinIO init skipped (is MinIO running on ${ENDPOINT}?): ${
      err instanceof Error ? err.message : String(err)
    }`,
  );
  process.exit(0);
});
