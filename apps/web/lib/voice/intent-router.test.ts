import { describe, expect, it } from 'vitest';
import { routeVoiceCommand } from './intent-router';

/** Phase 9.7 W1.3 — Home voice command hero routes ≥5 intents by leading verb. */
describe('home voice command router', () => {
  it('routes each spoken intent to its surface', () => {
    expect(routeVoiceCommand('Start consultation for Ramesh')).toMatchObject({
      intent: 'consult',
      href: '/consult?patient=Ramesh',
    });
    expect(routeVoiceCommand('record findings')).toMatchObject({ intent: 'consult', href: '/consult' });
    expect(routeVoiceCommand('Book cleaning next Monday 10am')).toMatchObject({ intent: 'book' });
    expect(routeVoiceCommand('Book cleaning next Monday 10am').href).toContain('/schedule?dictate=1&q=');
    expect(routeVoiceCommand('Add 100 gloves to inventory')).toMatchObject({ intent: 'inventory-purchase' });
    expect(routeVoiceCommand('used 5 carpules today')).toMatchObject({ intent: 'inventory-consume' });
    expect(routeVoiceCommand('New patient Lakshmi 9876543210')).toMatchObject({
      intent: 'new-patient',
      href: '/patients/new?voice=1',
    });
    expect(routeVoiceCommand('search Akhilesh')).toMatchObject({
      intent: 'search',
      href: '/patients?search=Akhilesh',
    });
  });

  it('falls back to patient search for unclear commands (never dead-ends)', () => {
    const route = routeVoiceCommand('Akhilesh crown status?');
    expect(route.intent).toBe('unclear');
    expect(route.href).toBe(`/patients?search=${encodeURIComponent('Akhilesh crown status')}`);
    expect(routeVoiceCommand('   ')).toMatchObject({ intent: 'unclear', href: '/patients' });
  });
});
