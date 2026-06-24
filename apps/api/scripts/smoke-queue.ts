/* eslint-disable no-console -- this is a CLI smoke script; console output is the point. */
/**
 * Two-device live smoke test for Phase 4. Drives the real running API + Socket.IO (no mocks) the way
 * two browsers would: a doctor socket and a receptionist socket both subscribe, then the queue
 * choreography is fired over REST and we assert BOTH clients receive each broadcast — measuring the
 * REST→both-clients latency against the ≤400ms (dev) target.
 *
 *   Prereqs: the dev stack up — `OTP_PROVIDER=mock pnpm --filter @odovox/api dev` (Postgres+Redis via
 *   docker compose). Run: `pnpm --filter @odovox/api exec tsx scripts/smoke-queue.ts`
 */
import { io, type Socket } from 'socket.io-client';
import type { ServerEvent } from '@odovox/types';

const API = process.env.API_URL ?? 'http://localhost:4000';

const r = (n: number): number => Math.floor(Math.random() * n);
const randomIp = (): string => `10.${r(255)}.${r(255)}.${r(254) + 1}`;
const randomPhone = (): string => `9${Array.from({ length: 9 }, () => r(10)).join('')}`;

async function http<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': randomIp(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as { ok?: boolean; data?: T; error?: { message: string } };
  if (!res.ok) throw new Error(`${path} → ${res.status} ${json.error?.message ?? ''}`);
  return json.data as T;
}
async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': randomIp() } });
  const json = (await res.json()) as { data: T };
  return json.data;
}

async function signIn(phone: string): Promise<string> {
  await http('/auth/otp/request', { phone });
  const data = await http<{ accessToken: string }>('/auth/otp/verify', { phone, otp: '123456' });
  return data.accessToken;
}

function connect(token: string, label: string, log: ServerEvent[]): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(API, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.on('event', (e: ServerEvent) => log.push(e));
    socket.on('connect', () => {
      console.log(`  ✓ ${label} socket connected`);
      resolve(socket);
    });
    socket.on('connect_error', reject);
  });
}

function waitFor(log: ServerEvent[], type: ServerEvent['type'], from: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (log.slice(from).some((e) => e.type === type)) {
        clearInterval(t);
        resolve(Date.now() - start);
      } else if (Date.now() - start > 5000) {
        clearInterval(t);
        reject(new Error(`timeout waiting for ${type}`));
      }
    }, 5);
  });
}

const SAMPLE_CLINIC = {
  name: 'Smoke Dental',
  addressLine: '1 Test Rd',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  contactPhone: '8000000000',
  openingTime: '09:00',
  closingTime: '18:00',
  weeklyOffDays: [0],
  chairsCount: 2,
  doctorName: 'Dr. Smoke',
  qualification: 'BDS, MDS',
  registrationNumber: 'KA-DENT-SMOKE',
  specialization: ['Endodontics'],
};

async function main(): Promise<void> {
  console.log(`\n▶ Two-device queue smoke test against ${API}\n`);

  // --- Sign up a doctor + clinic and a receptionist -------------------------
  const docRaw = await signIn(randomPhone());
  const clinic = await http<{ accessToken: string; clinic: { id: string }; joinCode: string }>('/clinics', SAMPLE_CLINIC, docRaw);
  const docToken = clinic.accessToken;
  const me = await get<{ user: { id: string } }>('/auth/me', docToken);
  const doctorId = me.user.id;

  const recpRaw = await signIn(randomPhone());
  const recp = await http<{ accessToken: string }>('/clinics/join', { joinCode: clinic.joinCode, name: 'Reception', role: 'RECEPTIONIST' }, recpRaw);
  const recpToken = recp.accessToken;
  console.log(`  ✓ clinic ${clinic.clinic.id} · doctor + receptionist ready`);

  const patient = await http<{ id: string; name: string }>('/patients', { name: 'Akhilesh Guhan', phone: randomPhone(), age: 34, gender: 'MALE' }, docToken);

  // --- Two devices subscribe ------------------------------------------------
  const docLog: ServerEvent[] = [];
  const recpLog: ServerEvent[] = [];
  const docSocket = await connect(docToken, 'doctor', docLog);
  const recpSocket = await connect(recpToken, 'receptionist', recpLog);
  await new Promise((res) => setTimeout(res, 200)); // let snapshots land

  const step = async (label: string, type: ServerEvent['type'], action: () => Promise<unknown>) => {
    const docFrom = docLog.length;
    const recpFrom = recpLog.length;
    const t0 = Date.now();
    await action();
    const [docMs, recpMs] = await Promise.all([waitFor(docLog, type, docFrom), waitFor(recpLog, type, recpFrom)]);
    const total = Date.now() - t0;
    const ok = total <= 400 ? '✓' : '⚠';
    console.log(`  ${ok} ${label.padEnd(34)} both clients in ${total}ms (doctor ${docMs}ms · recp ${recpMs}ms)`);
  };

  console.log('\n  Choreography:');
  // 1. Receptionist checks a walk-in in → doctor's queue updates.
  let visitId = '';
  await step('① reception checks patient in', 'queue.visit.checked_in', async () => {
    const v = await http<{ id: string }>('/visits', { patientId: patient.id, doctorId, chiefComplaint: 'Tooth pain' }, recpToken);
    visitId = v.id;
  });
  // 2. Doctor calls patient in → receptionist sees IN CHAIR.
  await step('② doctor calls patient in', 'queue.visit.called_in', () =>
    http(`/visits/${visitId}/call-in`, {}, docToken),
  );
  // 3. Checkout (stands in for consultation confirm) → receptionist "Ready for Checkout".
  await step('③ visit moves to checkout', 'queue.visit.checkout', () =>
    http(`/visits/${visitId}/checkout`, {}, docToken),
  );
  // 4. Receptionist completes checkout → removed from active queue.
  await step('④ reception completes checkout', 'queue.visit.completed', () =>
    http(`/visits/${visitId}/complete`, { payment: { method: 'CASH', amountPaise: 350000 }, prescriptionHanded: true }, recpToken),
  );

  console.log('\n  Event tallies:');
  console.log(`    doctor received      ${docLog.map((e) => e.type).join(', ')}`);
  console.log(`    receptionist received ${recpLog.map((e) => e.type).join(', ')}`);

  docSocket.close();
  recpSocket.close();
  console.log('\n✅ Two-device smoke test passed — both screens stayed in sync.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Smoke test failed:', err);
  process.exit(1);
});
