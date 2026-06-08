/**
 * scripts/seed.mjs
 * Plain ESM seed — no ts-node, no module resolution issues.
 * Run with:  node scripts/seed.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCipheriv, randomBytes } from 'crypto';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── Load env vars ────────────────────────────────────────────────────────────
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });
// .env.local no longer has DATABASE_URL, so just load ENCRYPTION_KEY from it
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const KEY_HEX = process.env.ENCRYPTION_KEY;
if (!KEY_HEX || KEY_HEX.length < 64) {
  console.error('❌ ENCRYPTION_KEY missing or too short in .env / .env.local');
  process.exit(1);
}
const KEY = Buffer.from(KEY_HEX.slice(0, 64), 'hex');

// ── Encryption helper (mirrors src/lib/crypto.ts) ────────────────────────────
function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

// ── CSV parser (tiny, no dependency) ────────────────────────────────────────
function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding nalam.ai database...\n');

  // Patients
  const patients = parseCsv(path.join(__dirname, '../datasets/patients.csv'));
  let pCount = 0;
  for (const p of patients) {
    await prisma.patient.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id:                 p.id,
        name_enc:           encrypt(p.name),
        dob_enc:            encrypt(p.dob),
        gender_enc:         encrypt(p.gender),
        contact_enc:        encrypt(p.contact      || ''),
        blood_type_enc:     encrypt(p.blood_type   || ''),
        allergies_enc:      encrypt(p.allergies    || ''),
        consent_emergency:  p.consent_emergency  === 'true',
        consent_specialist: p.consent_specialist === 'true',
        consent_research:   p.consent_research   === 'true',
      },
    });
    pCount++;
    console.log(`  ✅ Patient ${p.id}: ${p.name}`);
  }

  // Medical Records
  const records = parseCsv(path.join(__dirname, '../datasets/medical_records.csv'));
  let rCount = 0;
  for (const r of records) {
    const rid = r.record_id || `${r.patient_id}-${r.date}-${rCount}`;
    try {
      await prisma.medicalRecord.upsert({
        where: { id: rid },
        update: {},
        create: {
          id:              rid,
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
    } catch (e) {
      console.warn(`  ⚠️  Skipped record ${rid}: ${e.message}`);
    }
  }

  console.log(`\n🎉 Seed complete!`);
  console.log(`   Patients:        ${pCount}`);
  console.log(`   Medical records: ${rCount}`);
}

main()
  .catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
