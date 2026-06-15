// src/lib/data.ts
// Data access layer — reads/writes via Prisma (Supabase) with AES-256-GCM encryption.

import { encrypt, decrypt } from './crypto';

/* ─── Type Definitions (same external shape as before) ─────────────────── */
export interface Patient {
  id: string;
  name: string;
  dob: string;
  gender: string;
  contact: string;
  mobile: string;
  blood_type?: string;
  allergies?: string;
  consent_emergency: string;
  consent_specialist: string;
  consent_research: string;
}

export interface MedicalRecord {
  record_id: string;
  patient_id: string;
  date: string;
  type: string;
  provider: string;
  diagnosis: string;
  notes: string;
  lab_results: string;
}

/* ─── MySQL helpers ─────────────────────────────────────────────────────── */
async function getPrisma() {
  const { prisma } = await import('./prisma');
  return prisma;
}

function rowToPatient(row: any): Patient {
  return {
    id:                row.id,
    name:              decrypt(row.name_enc),
    dob:               decrypt(row.dob_enc),
    gender:            decrypt(row.gender_enc),
    contact:           decrypt(row.contact_enc),
    mobile:            decrypt(row.mobile_enc ?? ''),
    blood_type:        decrypt(row.blood_type_enc),
    allergies:         decrypt(row.allergies_enc),
    consent_emergency: row.consent_emergency ? 'true' : 'false',
    consent_specialist: row.consent_specialist ? 'true' : 'false',
    consent_research:  row.consent_research   ? 'true' : 'false',
  };
}

function rowToRecord(row: any): MedicalRecord {
  return {
    record_id:   row.id,
    patient_id:  row.patient_id,
    date:        row.date,
    type:        decrypt(row.type_enc),
    provider:    decrypt(row.provider_enc),
    diagnosis:   decrypt(row.diagnosis_enc),
    notes:       decrypt(row.notes_enc ?? ''),
    lab_results: decrypt(row.lab_results_enc ?? ''),
  };
}

/* ─── Public API ────────────────────────────────────────────────────────── */

export async function getPatients(): Promise<Patient[]> {
  const db = await getPrisma();
  const rows = await db.patient.findMany();
  return rows.map(rowToPatient);
}

// Alias used by the clinician portal patient selector
export const getAllPatients = getPatients;

export async function getPatientById(id: string): Promise<Patient | null> {
  const db  = await getPrisma();
  const row = await db.patient.findUnique({ where: { id } });
  return row ? rowToPatient(row) : null;
}

export async function getMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
  const db   = await getPrisma();
  const rows = await db.medicalRecord.findMany({
    where: { patient_id: patientId },
    orderBy: { date: 'desc' },
  });
  return rows.map(rowToRecord);
}

export async function updatePatientConsent(
  id: string, emergency: string, specialist: string, research: string
): Promise<boolean> {
  const db = await getPrisma();
  await db.patient.update({
    where: { id },
    data: {
      consent_emergency:  emergency  === 'true',
      consent_specialist: specialist === 'true',
      consent_research:   research   === 'true',
    },
  });
  return true;
}

export async function addMedicalRecord(record: {
  patient_id: string; type: string; provider: string;
  diagnosis: string; notes: string; lab_results: string;
}): Promise<MedicalRecord> {
  const db  = await getPrisma();
  const row = await db.medicalRecord.create({
    data: {
      patient_id:      record.patient_id,
      date:            new Date().toISOString().split('T')[0],
      type_enc:        encrypt(record.type),
      provider_enc:    encrypt(record.provider),
      diagnosis_enc:   encrypt(record.diagnosis),
      notes_enc:       encrypt(record.notes),
      lab_results_enc: encrypt(record.lab_results),
    },
  });
  return rowToRecord(row);
}

export async function addAuditEntry(entry: {
  patient_id: string; clinician: string; reason: string; context_type: string;
}): Promise<void> {
  const db = await getPrisma();
  await db.auditLog.create({
    data: {
      patient_id:    entry.patient_id,
      clinician_enc: encrypt(entry.clinician),
      reason_enc:    encrypt(entry.reason),
      context_type:  entry.context_type,
    },
  });
}

export async function getAuditEntries(patientId: string): Promise<Array<{ clinician: string; reason: string; timestamp: string; }>> {
  const db   = await getPrisma();
  const rows = await db.auditLog.findMany({
    where: { patient_id: patientId },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  return rows.map(r => ({
    clinician:  decrypt(r.clinician_enc),
    reason:     decrypt(r.reason_enc),
    timestamp:  r.created_at.toISOString(),
  }));
}
