import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

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
      status: 'ACTIVE',
      qualification: 'BDS, MDS (Endodontics)',
      registrationNumber: 'KA-DENT-12345',
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

  // --- Rooms ---------------------------------------------------------------
  const existingRooms = await prisma.room.count({ where: { clinicId: clinic.id } });
  if (existingRooms === 0) {
    await prisma.room.createMany({
      data: [
        { clinicId: clinic.id, name: 'Operatory 1', number: '1' },
        { clinicId: clinic.id, name: 'Operatory 2', number: '2' },
      ],
    });
  }

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
        address: p.address,
        medicalHistoryEnc: p.medicalHistory ? encryptField(p.medicalHistory) : null,
        allergiesEnc: p.allergies ? encryptField(p.allergies) : null,
        medicalFlags: p.medicalFlags,
        createdById: doctor.id,
      },
    });
  }

  const firstPatient = await prisma.patient.findFirstOrThrow({
    where: { clinicId: clinic.id, patientCode: 'PT-0001' },
  });

  // --- Lab partner + open lab case ----------------------------------------
  const labPartner = await prisma.labPartner.upsert({
    where: { id: `seed-lab-${clinic.id}` },
    update: {},
    create: {
      id: `seed-lab-${clinic.id}`,
      clinicId: clinic.id,
      name: 'PrecisionDent Lab',
      contact: '7000000000',
      address: 'Jayanagar, Bengaluru',
    },
  });

  const labCaseCount = await prisma.labCase.count({ where: { clinicId: clinic.id } });
  if (labCaseCount === 0) {
    await prisma.labCase.create({
      data: {
        clinicId: clinic.id,
        patientId: firstPatient.id,
        doctorId: doctor.id,
        partnerId: labPartner.id,
        caseType: 'PFM Crown',
        toothNumbers: [26],
        status: 'IN_PROGRESS',
        notes: 'Shade A2.',
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        events: {
          create: [{ status: 'CREATED', createdById: doctor.id, notes: 'Case opened' }],
        },
      },
    });
  }

  // --- Low-stock inventory item -------------------------------------------
  await prisma.inventoryItem.upsert({
    where: { id: `seed-inv-${clinic.id}` },
    update: {},
    create: {
      id: `seed-inv-${clinic.id}`,
      clinicId: clinic.id,
      name: 'Lignocaine 2% (with adrenaline)',
      category: 'MEDICINE',
      unit: 'cartridge',
      currentStock: 3,
      lowStockThreshold: 10,
      trackExpiry: true,
      notes: 'Below threshold — reorder.',
    },
  });

  console.warn('✅ Seed complete:');
  console.warn(`   Clinic: ${clinic.name} (joinCode ${clinic.joinCode})`);
  console.warn(`   Doctor: ${doctor.name} | Receptionist: ${receptionist.name}`);
  console.warn(`   Patients: ${patientSeed.length} | Lab partner + 1 open case | 1 low-stock item`);
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
