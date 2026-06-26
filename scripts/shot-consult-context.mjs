// Visual proof for Phase 4.5 Issues 2+3+4: receptionist checks a patient in with a chief complaint
// + an x-ray, doctor calls them in and opens the consultation → screenshot the rich context card.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';

const API = 'http://localhost:4000';
const WEB = 'http://localhost:3000';
const OUT = 'docs/phase4-screenshots';
mkdirSync(OUT, { recursive: true });
const r = (n) => Math.floor(Math.random() * n);
const phone = () => `9${Array.from({ length: 9 }, () => r(10)).join('')}`;

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body ?? {}) });
  const j = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(j.error)}`);
  return j.data;
}
async function get(path, token) {
  return (await (await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } })).json()).data;
}
async function signIn(p) {
  await post('/auth/otp/request', { phone: p });
  return (await post('/auth/otp/verify', { phone: p, otp: '123456' })).accessToken;
}

async function main() {
  const recp = await signIn('9000000002'); // seed receptionist
  const doc = await signIn('9000000001'); // seed doctor
  const doctorId = (await get('/auth/me', doc)).user.id;

  // Patient with an allergy + medical flag.
  const patient = await post('/patients', { name: 'Akhilesh Guhan', phone: phone(), age: 21, gender: 'MALE', allergies: 'Penicillin', medicalFlags: ['Diabetes'], chiefComplaint: '' }, recp);

  // Walk-in with a chief complaint (Issue 2), assigned to the doctor.
  const visit = await post('/visits', { patientId: patient.id, doctorId, chiefComplaint: 'Tooth pain on upper left, sensitive to cold for the past 3 days' }, recp);

  // Attach an x-ray at check-in (Issue 3).
  const png = readFileSync('/tmp/xray.png');
  const { uploadUrl, storageKey } = await post('/media/presign', { filename: 'pano.png', mimeType: 'image/png', sizeBytes: png.length, patientId: patient.id }, recp);
  await fetch(uploadUrl, { method: 'PUT', body: png, headers: { 'Content-Type': 'image/png' } });
  await post('/media', { patientId: patient.id, visitId: visit.id, storageKey, type: 'XRAY', mimeType: 'image/png', sizeBytes: png.length }, recp);

  // Doctor calls in (→ IN_CHAIR, starts the in-chair timer) + starts the consultation.
  await post(`/visits/${visit.id}/call-in`, {}, doc);
  const { consultationId } = await post('/consultations', { patientId: patient.id, visitId: visit.id }, doc);

  // Browser: log the doctor in (sets the refresh cookie), open the consult page, screenshot.
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
  await ctx.request.post(`${API}/auth/otp/request`, { data: { phone: '9000000001' } });
  await ctx.request.post(`${API}/auth/otp/verify`, { data: { phone: '9000000001', otp: '123456' } });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/consult/${consultationId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Chief complaint', { timeout: 15000 }).catch(() => {});
  await new Promise((res) => setTimeout(res, 1200));
  await page.screenshot({ path: `${OUT}/45-consult-context.png` });
  console.log(`📸 ${OUT}/45-consult-context.png`);
  await browser.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error('❌', e.message); process.exit(1); });
