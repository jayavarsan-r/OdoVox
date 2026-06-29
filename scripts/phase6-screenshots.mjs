// Phase 6 screenshots (acceptance deliverable #4). Logs in the seeded doctor + receptionist, joins a
// second doctor, seeds availability + appointments on a known weekday, then screenshots:
//   1) doctor day view  2) receptionist multi-doctor view  3) new-appointment sheet (slot picker)
//   4) appointment detail sheet
//
//   Prereqs: API on :4000 + web on :3000 + seeded DB. Run: node scripts/phase6-screenshots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const API = 'http://localhost:4000';
const WEB = 'http://localhost:3000';
const OUT = 'docs/phase6-screenshots';
const TZ_OFFSET = '+05:30'; // Asia/Kolkata
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nextWeekdayISO(daysAhead = 3) {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1); // skip Sunday (clinic off)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function login(context, phone) {
  const reqRes = await context.request.post(`${API}/auth/otp/request`, { data: { phone } });
  if (!reqRes.ok()) throw new Error(`otp/request ${phone} → ${reqRes.status()} ${await reqRes.text()}`);
  const res = await context.request.post(`${API}/auth/otp/verify`, { data: { phone, otp: '123456' } });
  const json = await res.json();
  if (!json?.data?.accessToken) throw new Error(`otp/verify ${phone} → ${res.status()} ${JSON.stringify(json)}`);
  return json.data.accessToken;
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

async function main() {
  const browser = await chromium.launch();
  const date = nextWeekdayISO(3);
  const at = (hhmm) => `${date}T${hhmm}:00${TZ_OFFSET}`;
  const rnd = () => `90${Math.floor(10000000 + Math.random() * 89999999)}`;

  // One context (and one login) per user.
  const docCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const recpCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const vCtx = await browser.newContext();
  const docToken = await login(docCtx, '9000000001');
  const recpToken = await login(recpCtx, '9000000002');
  void recpToken;

  const me = await api(docToken, 'GET', '/auth/me');
  const ashaId = me.user.id;

  // Second doctor joins the seeded clinic (joinCode SMILE7).
  const vTokenRaw = await login(vCtx, rnd());
  const vJoin = await api(vTokenRaw, 'POST', '/clinics/join', {
    joinCode: 'SMILE7', name: 'Dr. Vikram Rao', role: 'DOCTOR', qualification: 'BDS',
    registrationNumber: `KA-DENT-${Math.floor(Math.random() * 1e6)}`, specialization: ['Orthodontics'],
  });
  const vikramToken = vJoin.accessToken;
  const vikramId = vJoin.membership.userId;
  for (const dow of [1, 2, 3, 4, 5, 6]) {
    await api(vikramToken, 'POST', `/availability/doctor/${vikramId}`, { dayOfWeek: dow, startTime: '09:00', endTime: '18:00' }).catch(() => {});
  }

  const mkPatient = (name, age, gender) => api(docToken, 'POST', '/patients', { name, phone: rnd(), age, gender, chiefComplaint: 'Checkup' });
  const p1 = await mkPatient('Akhilesh Guhan', 21, 'MALE');
  const p2 = await mkPatient('Meera Nair', 34, 'FEMALE');
  const p3 = await mkPatient('Priya Sharma', 29, 'FEMALE');
  const p4 = await mkPatient('Sanjay Kumar', 41, 'MALE');
  const p5 = await mkPatient('Rohan Das', 52, 'MALE');

  const book = (token, patientId, doctorId, hhmm, durationMinutes, procedureHint) =>
    api(token, 'POST', '/appointments', { patientId, doctorId, startsAt: at(hhmm), durationMinutes, procedureHint }).catch((e) => console.warn('book skipped', e.message));

  await book(docToken, p1.id, ashaId, '09:00', 30, 'Cleaning');
  await book(docToken, p2.id, ashaId, '10:00', 45, 'RCT');
  await book(docToken, p3.id, ashaId, '11:30', 30, 'Filling');
  await book(vikramToken, p4.id, vikramId, '09:30', 30, 'New patient consult');
  await book(vikramToken, p5.id, vikramId, '10:30', 60, 'Crown fitting');

  // ── Screenshots ─────────────────────────────────────────────────────────────────────────────
  const docPage = await docCtx.newPage();
  const recpPage = await recpCtx.newPage();

  await docPage.goto(`${WEB}/schedule?date=${date}`, { waitUntil: 'networkidle' });
  await sleep(1200);
  await docPage.screenshot({ path: `${OUT}/1-doctor-day-view.png` });
  console.log('📸 1 doctor day view');

  await recpPage.goto(`${WEB}/schedule?date=${date}`, { waitUntil: 'networkidle' });
  await sleep(1200);
  await recpPage.screenshot({ path: `${OUT}/2-receptionist-multi-doctor.png` });
  console.log('📸 2 receptionist multi-doctor');

  // New appointment sheet (tap FAB) — on the doctor page.
  await docPage.click('button[aria-label="New appointment"]');
  await sleep(900);
  await docPage.screenshot({ path: `${OUT}/3-new-appointment-sheet.png` });
  console.log('📸 3 new appointment sheet');
  await docPage.keyboard.press('Escape').catch(() => {});

  // Appointment detail (tap the first block).
  await docPage.reload({ waitUntil: 'networkidle' });
  await sleep(1000);
  await docPage.locator('button:has-text("Akhilesh")').first().click({ timeout: 5000 }).catch(() => {});
  await sleep(800);
  await docPage.screenshot({ path: `${OUT}/4-appointment-detail.png` });
  console.log('📸 4 appointment detail');

  await browser.close();
  console.log(`\n✅ Screenshots saved to ${OUT}/\n`);
}

main().catch((e) => {
  console.error('❌ Phase 6 screenshots failed:', e);
  process.exit(1);
});
