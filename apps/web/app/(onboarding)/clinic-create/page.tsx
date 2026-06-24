import { redirect } from 'next/navigation';

/** Clinic creation is a 3-step wizard (Phase 2.5). Enter at step 1. */
export default function ClinicCreateIndex() {
  redirect('/clinic-create/step-1-basics');
}
