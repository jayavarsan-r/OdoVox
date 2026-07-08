import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.6 Issue 15: creating a patient must flow into the queue. For receptionists (and the
 * ?walkin=1 entry) the create button opens an "Add to queue?" sheet — doctor picker + priority —
 * whose Add creates a WAITING visit. Skip stays available for pre-registrations.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'app', '(app)', 'patients', 'new', 'page.tsx'), 'utf8');
const sheet = readFileSync(join(webRoot, 'components', 'queue', 'add-to-queue-sheet.tsx'), 'utf8');

describe('new patient → add to queue', () => {
  it('receptionists and the walk-in entry get the queue step after create', () => {
    expect(page).toMatch(/offerQueue = walkinParam \|\| role === 'RECEPTIONIST' \|\| role === 'ADMIN'/);
    expect(page).toMatch(/if \(offerQueue\) \{\s*setQueueFor\(/);
  });

  it('the sheet creates the visit through the walk-in mutation (WAITING visit)', () => {
    expect(sheet).toMatch(/useWalkIn\(\)/);
    expect(sheet).toMatch(/buildWalkInBody\(\{ patientId: patient\.id, doctorId, chiefComplaint: complaint, priority \}\)/);
  });

  it('adding routes to /today so the receptionist sees the queue', () => {
    expect(page).toMatch(/router\.replace\(added \? '\/today'/);
  });

  it('hydrates the doctor list even outside /today', () => {
    expect(sheet).toMatch(/useQueueSnapshot\('all'\)/);
  });
});
