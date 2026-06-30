import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { STARTER_TEMPLATES } from '../src/starter-templates.js';

// Load the repo-root .env so the seed has DATABASE_URL + PHI_ENCRYPTION_KEY.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

/**
 * Mirror of apps/api/src/lib/encryption.ts:encryptField.
 * Format: base64( [1B version][12B iv][ciphertext][16B tag] ).
 * Kept in sync intentionally so seeded PHI is readable by the API's decryptField.
 */
function encryptField(plaintext: string): string {
  const b64 = process.env.PHI_ENCRYPTION_KEY;
  if (!b64) throw new Error('PHI_ENCRYPTION_KEY is required to seed encrypted PHI');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('PHI_ENCRYPTION_KEY must decode to exactly 32 bytes');
  const version = Number(process.env.PHI_KEY_VERSION ?? '1') & 0xff;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([version]), iv, ciphertext, tag]).toString('base64');
}

async function main() {
  console.warn('🌱 Seeding Odovox demo data…');

  // --- Users ---------------------------------------------------------------
  const doctor = await prisma.user.upsert({
    where: { phone: '9000000001' },
    update: {},
    create: { phone: '9000000001', name: 'Dr. Asha Menon' },
  });

  const receptionist = await prisma.user.upsert({
    where: { phone: '9000000002' },
    update: {},
    create: { phone: '9000000002', name: 'Ravi Kumar' },
  });

  // --- Clinic --------------------------------------------------------------
  const clinic = await prisma.clinic.upsert({
    where: { joinCode: 'SMILE7' },
    update: {},
    create: {
      name: 'Smile Dental Care',
      joinCode: 'SMILE7',
      addressLine: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      contactPhone: '8000000000',
      openingTime: '09:00',
      closingTime: '20:00',
      lunchStart: '13:30',
      lunchEnd: '14:30',
      weeklyOffDays: [0],
      chairsCount: 2,
      timezone: 'Asia/Kolkata',
    },
  });

  await prisma.clinicMember.upsert({
    where: { clinicId_userId: { clinicId: clinic.id, userId: doctor.id } },
    update: {},
    create: {
      clinicId: clinic.id,
      userId: doctor.id,
      role: 'DOCTOR',
      isAdmin: true,
      status: 'ACTIVE',
      qualification: 'BDS, MDS (Endodontics)',
      registrationNumberEnc: encryptField('KA-DENT-12345'),
      specialization: 'Root Canal Therapy',
    },
  });

  await prisma.clinicMember.upsert({
    where: { clinicId_userId: { clinicId: clinic.id, userId: receptionist.id } },
    update: {},
    create: {
      clinicId: clinic.id,
      userId: receptionist.id,
      role: 'RECEPTIONIST',
      status: 'ACTIVE',
    },
  });

  // --- Doctor availability (Phase 6) — Mon-Sat 09:00-18:00, Sunday off. Idempotent re-seed. ---
  await prisma.doctorAvailability.createMany({
    data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      clinicId: clinic.id,
      doctorId: doctor.id,
      dayOfWeek,
      startTime: '09:00',
      endTime: '18:00',
    })),
    skipDuplicates: true,
  });

  // --- Rooms (stable ids so a re-seed is idempotent + referenceable below) --
  const room1 = await prisma.room.upsert({
    where: { id: `seed-room-${clinic.id}-1` },
    update: {},
    create: { id: `seed-room-${clinic.id}-1`, clinicId: clinic.id, name: 'Room 1', number: '1' },
  });
  await prisma.room.upsert({
    where: { id: `seed-room-${clinic.id}-2` },
    update: {},
    create: { id: `seed-room-${clinic.id}-2`, clinicId: clinic.id, name: 'Room 2', number: '2' },
  });

  // --- Patients (with encrypted PHI) --------------------------------------
  const patientSeed = [
    {
      patientCode: 'PT-0001',
      name: 'Meera Nair',
      phone: '9876543210',
      age: 34,
      gender: 'FEMALE' as const,
      bloodGroup: 'O+',
      address: 'Indiranagar, Bengaluru',
      medicalHistory: 'Hypertension, controlled with medication.',
      allergies: 'Penicillin',
      medicalFlags: ['HYPERTENSION'],
    },
    {
      patientCode: 'PT-0002',
      name: 'Arjun Reddy',
      phone: '9123456780',
      age: 28,
      gender: 'MALE' as const,
      bloodGroup: 'B+',
      address: 'Koramangala, Bengaluru',
      medicalHistory: null,
      allergies: null,
      medicalFlags: [],
    },
    {
      patientCode: 'PT-0003',
      name: 'Fatima Sheikh',
      phone: '9988776655',
      age: 45,
      gender: 'FEMALE' as const,
      bloodGroup: 'A+',
      address: 'Whitefield, Bengaluru',
      medicalHistory: 'Type 2 diabetes.',
      allergies: 'None known',
      medicalFlags: ['DIABETES'],
    },
  ];

  for (const p of patientSeed) {
    await prisma.patient.upsert({
      where: { clinicId_patientCode: { clinicId: clinic.id, patientCode: p.patientCode } },
      update: {},
      create: {
        clinicId: clinic.id,
        patientCode: p.patientCode,
        name: p.name,
        phone: p.phone,
        age: p.age,
        gender: p.gender,
        bloodGroup: p.bloodGroup,
        addressEnc: p.address ? encryptField(p.address) : null,
        medicalHistoryEnc: p.medicalHistory ? encryptField(p.medicalHistory) : null,
        allergiesEnc: p.allergies ? encryptField(p.allergies) : null,
        medicalFlags: p.medicalFlags,
        status: 'ACTIVE',
        createdById: doctor.id,
      },
    });
  }

  const firstPatient = await prisma.patient.findFirstOrThrow({
    where: { clinicId: clinic.id, patientCode: 'PT-0001' },
  });

  // --- Lab vendor + sample cases (Phase 7) --------------------------------
  const DAY_MS = 24 * 60 * 60 * 1000;
  const labVendor = await prisma.labVendor.upsert({
    where: { id: `seed-labvendor-${clinic.id}` },
    update: {},
    create: {
      id: `seed-labvendor-${clinic.id}`,
      clinicId: clinic.id,
      name: 'Saveetha Dental Lab',
      contactPhoneEnc: encryptField('9840012345'),
      contactPersonName: 'Mr. Karthik',
      addressEnc: encryptField('Poonamallee High Rd, Chennai 600077'),
      email: 'orders@saveethalab.in',
      defaultTurnaroundDays: 7,
      specialties: ['crown', 'bridge', 'denture'],
      notes: 'Primary crown & bridge lab.',
      createdById: doctor.id,
    },
  });

  const labCaseCount = await prisma.labCase.count({ where: { clinicId: clinic.id } });
  if (labCaseCount === 0) {
    const now = Date.now();
    // 1) DRAFT — impression just taken, not sent.
    await prisma.labCase.create({
      data: {
        clinicId: clinic.id,
        patientId: firstPatient.id,
        doctorId: doctor.id,
        vendorId: labVendor.id,
        caseNumber: 'LC-SM0001AA',
        type: 'CROWN',
        teeth: [26],
        material: 'Zirconia',
        shade: 'A2',
        description: 'Crown for missing molar.',
        impressionTakenAt: new Date(now),
        status: 'DRAFT',
        costPaise: 250000,
        patientChargePaise: 1500000,
        notesEnc: encryptField('Patient prefers a natural shade.'),
        createdById: doctor.id,
      },
    });
    // 2) SENT — waiting at vendor.
    await prisma.labCase.create({
      data: {
        clinicId: clinic.id,
        patientId: firstPatient.id,
        doctorId: doctor.id,
        vendorId: labVendor.id,
        caseNumber: 'LC-SM0002BB',
        type: 'BRIDGE',
        teeth: [14, 15, 16],
        material: 'PFM',
        shade: 'A3',
        description: '3-unit posterior bridge.',
        impressionTakenAt: new Date(now - 2 * DAY_MS),
        sentAt: new Date(now - 2 * DAY_MS),
        expectedReturnAt: new Date(now + 5 * DAY_MS),
        status: 'SENT',
        costPaise: 600000,
        createdById: doctor.id,
      },
    });
    // 3) READY — returned, awaiting delivery (surfaces on Doctor Home Needs You).
    await prisma.labCase.create({
      data: {
        clinicId: clinic.id,
        patientId: firstPatient.id,
        doctorId: doctor.id,
        vendorId: labVendor.id,
        caseNumber: 'LC-SM0003CC',
        type: 'DENTURE_PARTIAL',
        teeth: [34, 35, 36, 37],
        material: 'Acrylic',
        shade: 'A2',
        description: 'Lower partial denture.',
        impressionTakenAt: new Date(now - 9 * DAY_MS),
        sentAt: new Date(now - 9 * DAY_MS),
        expectedReturnAt: new Date(now - 2 * DAY_MS),
        returnedAt: new Date(now - 1 * DAY_MS),
        status: 'READY',
        costPaise: 450000,
        patientChargePaise: 1800000,
        createdById: doctor.id,
      },
    });
  }

  // --- Inventory categories + items + movements (Phase 7) ------------------
  const catDefs = [
    { key: 'consumables', name: 'Consumables', iconName: 'box', sortOrder: 0 },
    { key: 'anaesthetics', name: 'Anaesthetics', iconName: 'syringe', sortOrder: 1 },
    { key: 'instruments', name: 'Instruments', iconName: 'wrench', sortOrder: 2 },
    { key: 'xray', name: 'X-ray', iconName: 'scan', sortOrder: 3 },
  ];
  const catByKey: Record<string, string> = {};
  for (const c of catDefs) {
    const row = await prisma.inventoryCategory.upsert({
      where: { clinicId_name: { clinicId: clinic.id, name: c.name } },
      update: {},
      create: {
        id: `seed-invcat-${c.key}-${clinic.id}`,
        clinicId: clinic.id,
        name: c.name,
        iconName: c.iconName,
        sortOrder: c.sortOrder,
        createdById: doctor.id,
      },
    });
    catByKey[c.key] = row.id;
  }

  const EXP_2026 = new Date('2026-12-31T00:00:00.000Z');
  const itemDefs = [
    { key: 'ligno', name: 'Lignocaine 2% carpule', cat: 'anaesthetics', unit: 'carpule', stock: 20, reorder: 10, expiry: EXP_2026 },
    { key: 'gloves', name: 'Latex gloves L', cat: 'consumables', unit: 'piece', stock: 200, reorder: 100 },
    { key: 'composite', name: 'Composite resin A2', cat: 'consumables', unit: 'piece', stock: 2, reorder: 5 }, // LOW STOCK demo
    { key: 'needles', name: 'Disposable needles 30G', cat: 'consumables', unit: 'piece', stock: 50, reorder: 30 },
    { key: 'suction', name: 'Suction tips', cat: 'consumables', unit: 'piece', stock: 300, reorder: 100 },
    { key: 'burs', name: 'Dental burs assorted', cat: 'instruments', unit: 'piece', stock: 25, reorder: 10 },
    { key: 'probe', name: 'Periodontal probe', cat: 'instruments', unit: 'piece', stock: 5, reorder: 3 },
    { key: 'films', name: 'X-ray films size 2', cat: 'xray', unit: 'piece', stock: 100, reorder: 50 },
  ];
  const itemByKey: Record<string, string> = {};
  for (const it of itemDefs) {
    const row = await prisma.inventoryItem.upsert({
      where: { id: `seed-invitem-${it.key}-${clinic.id}` },
      update: {},
      create: {
        id: `seed-invitem-${it.key}-${clinic.id}`,
        clinicId: clinic.id,
        categoryId: catByKey[it.cat]!,
        name: it.name,
        unitOfMeasure: it.unit,
        currentStock: it.stock,
        reorderLevel: it.reorder,
        expiryDate: it.expiry ?? null,
        createdById: doctor.id,
      },
    });
    itemByKey[it.key] = row.id;
  }

  const movementCount = await prisma.inventoryMovement.count({ where: { clinicId: clinic.id } });
  if (movementCount === 0) {
    const now = Date.now();
    await prisma.inventoryMovement.createMany({
      data: [
        { clinicId: clinic.id, itemId: itemByKey['ligno']!, kind: 'PURCHASE', quantity: 30, pricePerUnitPaise: 1200, totalPricePaise: 36000, batchNumber: 'LIG-2026-01', byUserId: doctor.id, createdAt: new Date(now - 28 * DAY_MS) },
        { clinicId: clinic.id, itemId: itemByKey['gloves']!, kind: 'PURCHASE', quantity: 300, pricePerUnitPaise: 800, totalPricePaise: 240000, byUserId: receptionist.id, createdAt: new Date(now - 21 * DAY_MS) },
        { clinicId: clinic.id, itemId: itemByKey['ligno']!, kind: 'CONSUMPTION', quantity: -10, procedureName: 'RCT', byUserId: doctor.id, createdAt: new Date(now - 14 * DAY_MS) },
        { clinicId: clinic.id, itemId: itemByKey['gloves']!, kind: 'CONSUMPTION', quantity: -100, procedureName: 'General', byUserId: doctor.id, createdAt: new Date(now - 7 * DAY_MS) },
        { clinicId: clinic.id, itemId: itemByKey['composite']!, kind: 'CONSUMPTION', quantity: -8, procedureName: 'Restorations', byUserId: doctor.id, createdAt: new Date(now - 3 * DAY_MS) },
      ],
    });
  }

  // --- Phase 3: sample consultations --------------------------------------
  // Akhilesh Guhan is the voice-demo patient (the RCT-on-26 narrative). We seed two
  // consultations so a fresh DB shows both a confirmed record and a pending verification card.
  const akhilesh = await prisma.patient.upsert({
    where: { clinicId_patientCode: { clinicId: clinic.id, patientCode: 'PT-0004' } },
    update: {},
    create: {
      clinicId: clinic.id,
      patientCode: 'PT-0004',
      name: 'Akhilesh Guhan',
      phone: '9001234567',
      age: 34,
      gender: 'MALE',
      bloodGroup: 'O+',
      addressEnc: encryptField('Jayanagar, Bengaluru'),
      medicalFlags: [],
      chiefComplaint: 'Ongoing root canal, upper left',
      status: 'ACTIVE',
      createdById: doctor.id,
    },
  });

  // (1) CONFIRMED — RCT on 26, third sitting, Amoxicillin, review next week.
  //     Visit sits in CHECKOUT: doctor confirmed, receptionist payment pending (demo bill below).
  const confirmedVisit = await prisma.visit.upsert({
    where: { id: `seed-visit-${clinic.id}-rct` },
    update: {},
    create: {
      id: `seed-visit-${clinic.id}-rct`,
      clinicId: clinic.id,
      patientId: akhilesh.id,
      doctorId: doctor.id,
      assignedDoctorId: doctor.id,
      status: 'CHECKOUT',
      tokenNumber: 1,
      checkedInAt: new Date(Date.now() - 75 * 60 * 1000),
      calledInAt: new Date(Date.now() - 60 * 60 * 1000),
      checkoutStartedAt: new Date(Date.now() - 30 * 60 * 1000),
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 30 * 60 * 1000),
      chiefComplaint: 'Ongoing root canal, upper left',
    },
  });

  // Demo bill for the checkout visit so the receptionist's "Take payment" shows an amount.
  await prisma.bill.upsert({
    where: { id: `seed-bill-${clinic.id}-rct` },
    update: {},
    create: {
      id: `seed-bill-${clinic.id}-rct`,
      visitId: confirmedVisit.id,
      patientId: akhilesh.id,
      items: [{ description: 'Root canal therapy — 26 (3 sittings)', amountPaise: 350000 }],
      totalPaise: 350000,
      paidPaise: 0,
      status: 'PENDING',
    },
  });

  await prisma.consultation.upsert({
    where: { id: `seed-consult-${clinic.id}-rct` },
    update: {},
    create: {
      id: `seed-consult-${clinic.id}-rct`,
      visitId: confirmedVisit.id,
      rawTranscriptEnc: encryptField(
        'RCT on 26 completed, third sitting. Amoxicillin 500mg TID for 5 days. Review next week.',
      ),
      structuredData: {
        procedure: 'RCT',
        teeth: [26],
        sittingCurrent: 3,
        sittingTotal: 4,
        status: 'COMPLETED',
        prescriptions: [
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5, instructions: null },
        ],
        followUp: { afterDays: 7, procedureHint: null },
        toothStatusUpdates: [{ tooth: 26, status: 'RCT', note: null }],
        notes: null,
        clarifications: [],
        safetyWarnings: [],
      },
      languageCode: 'en-IN',
      provider: 'mock+mock',
      sttLatencyMs: 820,
      extractionLatencyMs: 1180,
      safetyWarnings: [],
      status: 'CONFIRMED',
      confirmedById: doctor.id,
      confirmedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  // (2) PENDING_REVIEW — a filling on 46, waiting for the doctor's verification card.
  //     Visit is IN_CHAIR in Room 1 — the live "now treating" patient on /consult.
  const pendingVisit = await prisma.visit.upsert({
    where: { id: `seed-visit-${clinic.id}-pending` },
    update: {},
    create: {
      id: `seed-visit-${clinic.id}-pending`,
      clinicId: clinic.id,
      patientId: akhilesh.id,
      doctorId: doctor.id,
      assignedDoctorId: doctor.id,
      roomId: room1.id,
      status: 'IN_CHAIR',
      tokenNumber: 2,
      checkedInAt: new Date(Date.now() - 20 * 60 * 1000),
      calledInAt: new Date(Date.now() - 5 * 60 * 1000),
      startedAt: new Date(),
      chiefComplaint: 'Sensitivity, lower right',
    },
  });

  await prisma.consultation.upsert({
    where: { id: `seed-consult-${clinic.id}-pending` },
    update: {},
    create: {
      id: `seed-consult-${clinic.id}-pending`,
      visitId: pendingVisit.id,
      rawTranscriptEnc: encryptField(
        'Composite filling on 46, caries removed. Ibuprofen 400mg BD for 3 days after food. Review in 2 weeks.',
      ),
      structuredData: {
        procedure: 'Filling',
        teeth: [46],
        sittingCurrent: 1,
        sittingTotal: 1,
        status: 'COMPLETED',
        prescriptions: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 3, instructions: 'after food' },
        ],
        followUp: { afterDays: 14, procedureHint: 'Review' },
        toothStatusUpdates: [{ tooth: 46, status: 'FILLED', note: null }],
        notes: null,
        clarifications: [],
        safetyWarnings: [],
      },
      languageCode: 'en-IN',
      provider: 'mock+mock',
      sttLatencyMs: 760,
      extractionLatencyMs: 1230,
      safetyWarnings: [],
      status: 'PENDING_REVIEW',
    },
  });

  // (3) WAITING — Arjun Reddy checked in for a routine cleaning, in Dr. Asha's queue.
  const arjun = await prisma.patient.findFirstOrThrow({
    where: { clinicId: clinic.id, patientCode: 'PT-0002' },
  });
  const waitingVisit = await prisma.visit.upsert({
    where: { id: `seed-visit-${clinic.id}-waiting` },
    update: {},
    create: {
      id: `seed-visit-${clinic.id}-waiting`,
      clinicId: clinic.id,
      patientId: arjun.id,
      doctorId: doctor.id,
      assignedDoctorId: doctor.id,
      status: 'WAITING',
      tokenNumber: 3,
      checkedInAt: new Date(Date.now() - 8 * 60 * 1000),
      chiefComplaint: 'Routine cleaning',
    },
  });

  // --- Queue events (so a fresh DB shows a populated activity feed) ---------
  const queueEventCount = await prisma.queueEvent.count({ where: { clinicId: clinic.id } });
  if (queueEventCount === 0) {
    await prisma.queueEvent.createMany({
      data: [
        {
          clinicId: clinic.id,
          visitId: waitingVisit.id,
          patientId: arjun.id,
          type: 'CHECKED_IN',
          byUserId: receptionist.id,
          createdAt: new Date(Date.now() - 8 * 60 * 1000),
        },
        {
          clinicId: clinic.id,
          visitId: pendingVisit.id,
          patientId: akhilesh.id,
          type: 'CALLED_IN',
          byUserId: doctor.id,
          metadata: { roomId: room1.id },
          createdAt: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          clinicId: clinic.id,
          visitId: confirmedVisit.id,
          patientId: akhilesh.id,
          type: 'CHECKOUT_STARTED',
          byUserId: doctor.id,
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      ],
    });
  }

  // --- Phase 5: starter prescription templates -----------------------------
  for (const t of STARTER_TEMPLATES) {
    await prisma.prescriptionTemplate.upsert({
      where: { id: `seed-tpl-${clinic.id}-${t.slug}` },
      update: {},
      create: {
        id: `seed-tpl-${clinic.id}-${t.slug}`,
        clinicId: clinic.id,
        createdById: doctor.id,
        name: t.name,
        description: t.description,
        tags: t.tags,
        reviewAfterDays: t.reviewAfterDays,
        medicines: t.medicines as unknown as object,
      },
    });
  }

  console.warn('✅ Seed complete:');
  console.warn(`   Clinic: ${clinic.name} (joinCode ${clinic.joinCode})`);
  console.warn(`   Queue: 1 WAITING (Arjun) · 1 IN_CHAIR (Akhilesh, Room 1) · 1 CHECKOUT (Akhilesh, ₹3,500)`);
  console.warn(`   Doctor: ${doctor.name} | Receptionist: ${receptionist.name}`);
  console.warn(
    `   Patients: ${patientSeed.length + 1} | Lab: 1 vendor + 3 cases (DRAFT/SENT/READY) | Inventory: 4 categories, 8 items (1 low-stock), 5 movements`,
  );
  console.warn('   Consultations: 1 CONFIRMED (RCT 26) + 1 PENDING_REVIEW (filling 46) on Akhilesh Guhan');
  console.warn(`   Prescription templates: ${STARTER_TEMPLATES.length} starters (RCT pack, Post-extraction, …)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('❌ Seed failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
