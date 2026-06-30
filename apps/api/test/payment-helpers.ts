import type { FastifyInstance } from 'fastify';
import { authHeader, createDoctorWithClinic, createPatient, joinReceptionist } from './helpers.js';

/** Create a clinic + receptionist + patient, and a FINALIZED bill of `totalPaise`. */
export async function finalizedBill(app: FastifyInstance, totalPaise = 1000000) {
  const doctor = await createDoctorWithClinic(app);
  const recp = await joinReceptionist(app, doctor.joinCode);
  const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
  const created = await app.inject({
    method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
    payload: { patientId, items: [{ kind: 'PROCEDURE', description: 'RCT', unitPricePaise: totalPaise }] },
  });
  const billId = created.json().data.id;
  await app.inject({ method: 'POST', url: `/bills/${billId}/finalize`, headers: authHeader(recp.accessToken) });
  return { doctor, recp, patientId, billId, totalPaise };
}
