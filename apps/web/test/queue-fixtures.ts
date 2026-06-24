import type { QueueDoctor, QueueSnapshot, VisitWithPatient } from '@odovox/types';

let seq = 0;

/** A complete, valid VisitWithPatient with sensible defaults; override any field. */
export function makeVisit(over: Partial<VisitWithPatient> = {}): VisitWithPatient {
  seq += 1;
  return {
    id: over.id ?? `visit-${seq}`,
    clinicId: 'clinic-1',
    status: 'WAITING',
    tokenNumber: seq,
    priority: 0,
    lifecycleVersion: 0,
    chiefComplaint: 'Toothache',
    assignedDoctorId: 'doc-1',
    doctorId: 'doc-1',
    doctorName: 'Dr. Asha',
    roomId: null,
    roomName: null,
    patient: {
      id: `patient-${seq}`,
      name: 'Akhilesh Guhan',
      age: 34,
      patientCode: `PT-${seq}`,
      phone: '9000000000',
      medicalFlags: [],
    },
    consultationId: null,
    consultationStatus: null,
    recording: false,
    billTotalPaise: null,
    billDuePaise: null,
    checkedInAt: new Date('2026-06-24T09:00:00Z'),
    calledInAt: null,
    checkoutStartedAt: null,
    createdAt: new Date('2026-06-24T09:00:00Z'),
    ...over,
  };
}

export function makeDoctor(over: Partial<QueueDoctor> = {}): QueueDoctor {
  return { id: 'doc-1', name: 'Dr. Asha', available: true, ...over };
}

export function makeSnapshot(over: Partial<QueueSnapshot> = {}): QueueSnapshot {
  return {
    visits: [],
    doctors: [makeDoctor()],
    rooms: [],
    serverTime: new Date('2026-06-24T09:00:00Z'),
    ...over,
  };
}
