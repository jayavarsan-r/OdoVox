// Two-device browser smoke test for Phase 4 (acceptance #23). Opens two real Chromium contexts —
// a doctor on /consult and a receptionist on /today — logs each in as the seeded users, then drives
// the queue choreography and screenshots BOTH screens side-by-side at the three required moments.
//
//   Prereqs: API on :4000 + web on :3000 + seeded DB. Run: node scripts/two-device-screenshots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const API = 'http://localhost:4000';
const WEB = 'http://localhost:3000';
const OUT = 'docs/phase4-screenshots';
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(context, phone) {
  await context.request.post(`${API}/auth/otp/request`, { data: { phone } });
  const res = await context.request.post(`${API}/auth/otp/verify`, { data: { phone, otp: '123456' } });
  const body = await res.json();
  return body.data.accessToken; // clinic-scoped for an existing member
}
async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`);
  return json.data;
}

async function shot(docPage, recpPage, name) {
  await sleep(900); // let the broadcast land + UI settle
  await docPage.screenshot({ path: `${OUT}/${name}-doctor.png` });
  await recpPage.screenshot({ path: `${OUT}/${name}-receptionist.png` });
  console.log(`  📸 ${name} (doctor + receptionist)`);
}

async function main() {
  const browser = await chromium.launch();
  const docCtx = await browser.newContext({ viewport: { width: 414, height: 896 } });
  const recpCtx = await browser.newContext({ viewport: { width: 414, height: 896 } });

  console.log('\n▶ Logging both devices in…');
  const docToken = await login(docCtx, '9000000001'); // Dr. Asha (seed)
  const recpToken = await login(recpCtx, '9000000002'); // Ravi (reception, seed)
  const me = await api(docToken, 'GET', '/auth/me');
  const doctorId = me.user.id;

  const docPage = await docCtx.newPage();
  const recpPage = await recpCtx.newPage();
  await docPage.goto(`${WEB}/consult`, { waitUntil: 'networkidle' });
  await recpPage.goto(`${WEB}/today`, { waitUntil: 'networkidle' });
  await docPage.waitForSelector('text=Consultation', { timeout: 15000 }).catch(() => {});
  await recpPage.waitForSelector('text=Today', { timeout: 15000 }).catch(() => {});
  await shot(docPage, recpPage, '0-initial');

  // Moment 1 — receptionist checks a walk-in in → doctor's queue updates.
  console.log('▶ ① reception checks a walk-in in');
  const patient = await api(docToken, 'POST', '/patients', { name: 'Priya Sharma', phone: '9012345678', age: 29, gender: 'FEMALE', chiefComplaint: 'Routine cleaning' });
  const visit = await api(recpToken, 'POST', '/visits', { patientId: patient.id, doctorId, chiefComplaint: 'Routine cleaning', priority: 0 });
  await shot(docPage, recpPage, '1-checked-in');

  // Moment 2 — doctor calls the patient in → receptionist sees IN CHAIR.
  console.log('▶ ② doctor calls the patient in');
  await api(docToken, 'POST', `/visits/${visit.id}/call-in`, {});
  await shot(docPage, recpPage, '2-called-in');

  // Moment 3 — visit moves to checkout (stands in for consult confirm) → receptionist "Ready for Checkout".
  console.log('▶ ③ visit moves to checkout');
  await api(docToken, 'POST', `/visits/${visit.id}/checkout`, {});
  await shot(docPage, recpPage, '3-checkout');

  await browser.close();
  console.log(`\n✅ Screenshots saved to ${OUT}/\n`);
}

main().catch((e) => {
  console.error('❌ Browser smoke failed:', e);
  process.exit(1);
});
