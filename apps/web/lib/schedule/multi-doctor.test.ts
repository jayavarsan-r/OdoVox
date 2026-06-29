import { describe, expect, it } from 'vitest';
import { appointmentsForDoctor, deriveDoctorColumns } from './multi-doctor';
import type { ScheduleAppointment } from '@odovox/types';

function appt(over: Partial<ScheduleAppointment>): ScheduleAppointment {
  return {
    id: over.id ?? 'a', clinicId: 'c', patientId: 'p', patientName: 'P',
    doctorId: over.doctorId ?? 'd1', doctorName: over.doctorName ?? 'Dr A', roomId: null, roomName: null,
    startsAt: new Date('2026-06-25T04:30:00Z'), endsAt: new Date('2026-06-25T05:00:00Z'),
    durationMinutes: 30, status: over.status ?? 'SCHEDULED', procedureHint: null, notes: null,
    seriesId: null, seriesIndex: null, seriesTotal: null, treatmentPlanId: null, sittingNumber: null,
    originalStartsAt: null, rescheduleCount: 0,
  } as ScheduleAppointment;
}

describe('deriveDoctorColumns', () => {
  it('unions known doctors with appointment doctors, ordered by name, with active counts', () => {
    const cols = deriveDoctorColumns(
      [appt({ doctorId: 'd1', doctorName: 'Asha' }), appt({ id: 'b', doctorId: 'd2', doctorName: 'Vikram' }), appt({ id: 'c', doctorId: 'd2', doctorName: 'Vikram', status: 'CANCELLED' })],
      [{ id: 'd1', name: 'Asha' }],
    );
    expect(cols.map((c) => c.name)).toEqual(['Asha', 'Vikram']);
    expect(cols.find((c) => c.doctorId === 'd1')!.count).toBe(1);
    expect(cols.find((c) => c.doctorId === 'd2')!.count).toBe(1); // cancelled excluded
  });

  it('filters appointments for a single doctor', () => {
    const list = [appt({ doctorId: 'd1' }), appt({ id: 'b', doctorId: 'd2' })];
    expect(appointmentsForDoctor(list, 'd1')).toHaveLength(1);
  });
});
