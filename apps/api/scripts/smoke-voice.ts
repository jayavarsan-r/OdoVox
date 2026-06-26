/* eslint-disable no-console -- CLI smoke script. */
/**
 * Real-provider voice smoke. Drives the full consultation pipeline against the running API with
 * REAL Sarvam + Gemini (no mocks): create consultation → presign → upload real speech audio → process
 * → poll until extracted. Run N times to satisfy the "3 consecutive consultations" acceptance.
 *
 *   Prereqs: API up with STT_PROVIDER=sarvam, AI_PROVIDER=gemini; /tmp/speech.webm exists.
 *   Run: pnpm --filter @odovox/api exec tsx scripts/smoke-voice.ts [runs]
 */
import { readFileSync } from 'node:fs';

const API = process.env.API_URL ?? 'http://localhost:4000';
const RUNS = Number(process.argv[2] ?? 3);
const audio = readFileSync('/tmp/speech.webm');

const r = (n: number) => Math.floor(Math.random() * n);
const ip = () => `10.${r(255)}.${r(255)}.${r(254) + 1}`;
const phone = () => `9${Array.from({ length: 9 }, () => r(10)).join('')}`;
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const j = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok) throw new Error(`${path} → ${res.status} ${j.error?.message ?? ''}`);
  return j.data as T;
}
async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': ip() } });
  return (await res.json() as { data: T }).data;
}
async function signIn(p: string): Promise<string> {
  await post('/auth/otp/request', { phone: p });
  return (await post<{ accessToken: string }>('/auth/otp/verify', { phone: p, otp: '123456' })).accessToken;
}

async function oneConsult(token: string, n: number): Promise<void> {
  const patient = await post<{ id: string }>('/patients', { name: `Voice Patient ${n}`, phone: phone(), age: 30, gender: 'MALE', chiefComplaint: 'Tooth pain upper left' }, token);
  const { consultationId } = await post<{ consultationId: string }>('/consultations', { patientId: patient.id }, token);
  const { uploadUrl } = await post<{ uploadUrl: string }>('/consultations/audio/presign', { consultationId, mimeType: 'audio/webm', sizeBytes: audio.length }, token);
  await fetch(uploadUrl, { method: 'PUT', body: audio, headers: { 'Content-Type': 'audio/webm' } });

  const t0 = Date.now();
  await post(`/consultations/${consultationId}/process`, {}, token);

  // Poll until extraction lands (structuredData populated) or the job fails.
  for (let i = 0; i < 60; i++) {
    await sleep(700);
    const c = await get<{ status: string; structuredData: Record<string, unknown>; latestJob?: { kind: string; status: string; lastError?: string }; transcript?: string }>(`/consultations/${consultationId}`, token);
    const job = c.latestJob;
    if (job?.status === 'FAILED') throw new Error(`pipeline FAILED at ${job.kind}: ${job.lastError}`);
    const data = c.structuredData ?? {};
    const extracted = data.procedure != null || (Array.isArray(data.teeth) && data.teeth.length > 0) || (Array.isArray(data.prescriptions) && data.prescriptions.length > 0);
    if (extracted && job?.kind?.startsWith('EXTRACTION') && job.status === 'SUCCEEDED') {
      console.log(`  ✓ consult ${n}: ${Date.now() - t0}ms`);
      console.log(`    transcript: "${(c.transcript ?? '').slice(0, 90)}"`);
      console.log(`    extracted:  procedure=${data.procedure} teeth=${JSON.stringify(data.teeth)} rx=${(data.prescriptions as unknown[])?.length ?? 0} warnings=${JSON.stringify(data.safetyWarnings)}`);
      return;
    }
  }
  throw new Error('timed out waiting for extraction');
}

async function main(): Promise<void> {
  console.log(`\n▶ Real-provider voice smoke (${RUNS} consultations) against ${API}\n`);
  // Seed doctor (9000000001) — already an ACTIVE member of the demo clinic, so OTP login mints a
  // clinic-scoped token directly (no clinic-create needed).
  const token = await signIn('9000000001');
  for (let n = 1; n <= RUNS; n++) await oneConsult(token, n);
  console.log(`\n✅ ${RUNS}/${RUNS} consultations succeeded end-to-end with real Sarvam + Gemini.\n`);
  process.exit(0);
}
main().catch((e) => { console.error('\n❌ Voice smoke failed:', e instanceof Error ? e.message : e); process.exit(1); });
