import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, joinReceptionist } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

const vendorPayload = (over: Record<string, unknown> = {}) => ({
  name: 'Saveetha Dental Lab',
  contactPhone: '9840012345',
  contactPersonName: 'Mr. Karthik',
  address: 'Poonamallee High Rd, Chennai',
  defaultTurnaroundDays: 7,
  specialties: ['crown', 'bridge'],
  ...over,
});

describe('Lab vendor CRUD', () => {
  it('creates, lists, edits and archives a vendor', async () => {
    const doc = await createDoctorWithClinic(app);

    const created = await app.inject({
      method: 'POST',
      url: '/lab/vendors',
      headers: authHeader(doc.accessToken),
      payload: vendorPayload(),
    });
    expect(created.statusCode).toBe(201);
    const vendor = created.json().data;
    expect(vendor.name).toBe('Saveetha Dental Lab');
    // Create response (detail-grade) reveals the decrypted phone.
    expect(vendor.contactPhone).toBe('9840012345');

    const list = await app.inject({
      method: 'GET',
      url: '/lab/vendors',
      headers: authHeader(doc.accessToken),
    });
    expect(list.statusCode).toBe(200);
    const items = list.json().data.items;
    expect(items.some((v: { id: string }) => v.id === vendor.id)).toBe(true);
    // List view masks contact PII.
    expect(items.find((v: { id: string }) => v.id === vendor.id).contactPhone).toBeNull();

    const patched = await app.inject({
      method: 'PATCH',
      url: `/lab/vendors/${vendor.id}`,
      headers: authHeader(doc.accessToken),
      payload: { defaultTurnaroundDays: 10, name: 'Saveetha Dental Lab (Updated)' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data.defaultTurnaroundDays).toBe(10);

    const archived = await app.inject({
      method: 'DELETE',
      url: `/lab/vendors/${vendor.id}`,
      headers: authHeader(doc.accessToken),
    });
    expect(archived.statusCode).toBe(200);

    // Archived vendor drops out of the list.
    const list2 = await app.inject({ method: 'GET', url: '/lab/vendors', headers: authHeader(doc.accessToken) });
    expect(list2.json().data.items.some((v: { id: string }) => v.id === vendor.id)).toBe(false);
  });

  it('stores phone + address encrypted at rest (opaque in DB)', async () => {
    const doc = await createDoctorWithClinic(app);
    const res = await app.inject({
      method: 'POST',
      url: '/lab/vendors',
      headers: authHeader(doc.accessToken),
      payload: vendorPayload({ contactPhone: '9876543210', address: '42 Anna Salai' }),
    });
    const vendorId = res.json().data.id;

    const row = await runWithContext({ clinicId: doc.clinicId }, async () => {
      return await app.prisma.labVendor.findFirstOrThrow({ where: { id: vendorId } });
    });
    expect(row.contactPhoneEnc).not.toContain('9876543210');
    expect(row.addressEnc).not.toContain('Anna Salai');
    // Ciphertext is base64 and materially longer than the plaintext.
    expect(row.contactPhoneEnc.length).toBeGreaterThan(20);
  });
});

describe('Lab vendor RBAC', () => {
  it('receptionist cannot create a vendor (403)', async () => {
    const doc = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doc.joinCode);
    const res = await app.inject({
      method: 'POST',
      url: '/lab/vendors',
      headers: authHeader(recp.accessToken),
      payload: vendorPayload(),
    });
    expect(res.statusCode).toBe(403);
  });

  it('receptionist cannot archive a vendor (403)', async () => {
    const doc = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doc.joinCode);
    const created = await app.inject({
      method: 'POST',
      url: '/lab/vendors',
      headers: authHeader(doc.accessToken),
      payload: vendorPayload(),
    });
    const vendorId = created.json().data.id;
    const res = await app.inject({
      method: 'DELETE',
      url: `/lab/vendors/${vendorId}`,
      headers: authHeader(recp.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });
});
