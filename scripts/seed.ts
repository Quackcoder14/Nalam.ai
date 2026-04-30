/**
 * scripts/seed.ts
 * 
 * One-time migration: reads CSV files and inserts encrypted rows into MySQL.
 * Run with:  npx ts-node --project tsconfig.json scripts/seed.ts
 */
import * as fs   from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load both env files — .env has DATABASE_URL for Prisma; .env.local has ENCRYPTION_KEY
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

import { PrismaClient } from '@prisma/client';
import { encrypt }      from '../src/lib/crypto';
import Papa             from 'papaparse';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting nalam.ai DB seed...\n');

  // ── Patients ────────────────────────────────────────────────────────────────
  const patientsCsv = fs.readFileSync(path.join(__dirname, '../datasets/patients.csv'), 'utf-8');
  const patients    = (Papa.parse(patientsCsv, { header: true, skipEmptyLines: true }).data) as any[];

  let pCount = 0;
  for (const p of patients) {
    await prisma.patient.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id:                p.id,
        name_enc:          encrypt(p.name),
        dob_enc:           encrypt(p.dob),
        gender_enc:        encrypt(p.gender),
        contact_enc:       encrypt(p.contact   || ''),
        blood_type_enc:    encrypt(p.blood_type || ''),
        allergies_enc:     encrypt(p.allergies  || ''),
        consent_emergency:  p.consent_emergency  === 'true',
        consent_specialist: p.consent_specialist === 'true',
        consent_research:   p.consent_research   === 'true',
      },
    });
    pCount++;
    console.log(`  ✅ Patient: ${p.id} (name encrypted)`);
  }

  // ── Medical Records ─────────────────────────────────────────────────────────
  const recordsCsv = fs.readFileSync(path.join(__dirname, '../datasets/medical_records.csv'), 'utf-8');
  const records    = (Papa.parse(recordsCsv, { header: true, skipEmptyLines: true }).data) as any[];

  let rCount = 0;
  for (const r of records) {
    try {
      await prisma.medicalRecord.upsert({
        where: { id: r.record_id || `${r.patient_id}-${r.date}-${rCount}` },
        update: {},
        create: {
          id:              r.record_id || `${r.patient_id}-${r.date}-${rCount}`,
          patient_id:      r.patient_id,
          date:            r.date,
          type_enc:        encrypt(r.type        || 'Visit'),
          provider_enc:    encrypt(r.provider    || ''),
          diagnosis_enc:   encrypt(r.diagnosis   || ''),
          notes_enc:       encrypt(r.notes       || ''),
          lab_results_enc: encrypt(r.lab_results || ''),
        },
      });
      rCount++;
    } catch (e: any) {
      console.warn(`  ⚠️  Skipped record ${r.record_id}: ${e.message}`);
    }
  }

  console.log(`\n🎉 Seed complete!`);
  console.log(`   Patients:       ${pCount}`);
  console.log(`   Medical records: ${rCount}`);
  console.log(`\n💡 Verify encryption with MySQL:`);
  console.log(`   SELECT id, name_enc FROM patients LIMIT 3;`);
  console.log(`   You should see ciphertext, not plain names.\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
