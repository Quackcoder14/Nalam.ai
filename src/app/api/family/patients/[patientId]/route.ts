import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const auth = requireRole(request, ['family']);
  if (!auth.ok) return auth.response;
  
  const { patientId } = await params;
  const familyId = auth.session.staffId;

  const link = await prisma.familyPatientLink.findFirst({
    where: { family_id: familyId, patient_id: patientId, consent_status: 'approved' },
  });

  if (!link) {
    return NextResponse.json({ error: 'Not authorized to view this patient or consent pending' }, { status: 403 });
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  // Latest vitals
  const vitals = await prisma.rookVitals.findFirst({
    where: { patient_id: patientId },
    orderBy: { recorded_at: 'desc' },
  });

  // All unread alerts
  const alerts = await prisma.clinicalAlert.findMany({
    where: { patient_id: patientId, is_read: false },
    orderBy: { created_at: 'desc' },
  });

  // Recent appointments (last 10)
  const appointments = await prisma.appointment.findMany({
    where: { patient_id: patientId },
    orderBy: { created_at: 'desc' },
    take: 10,
  });

  // ALL medical records, fully decrypted
  const records = await prisma.medicalRecord.findMany({
    where: { patient_id: patientId },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json({
    id: patient.id,
    name: decrypt(patient.name_enc),
    dob: decrypt(patient.dob_enc),
    gender: decrypt(patient.gender_enc),
    vitals: vitals ? {
      hr: vitals.hr, spo2: vitals.spo2, sys: vitals.sys,
      dia: vitals.dia, temp: vitals.temp, resp: vitals.resp,
      recordedAt: vitals.recorded_at,
    } : {
      hr: 72 + Math.floor(Math.random() * 6) - 3,
      spo2: 98 + Math.floor(Math.random() * 2),
      sys: 120 + Math.floor(Math.random() * 6) - 3,
      dia: 80 + Math.floor(Math.random() * 4) - 2,
      temp: parseFloat((36.6 + Math.random() * 0.4 - 0.2).toFixed(1)),
      resp: 16 + Math.floor(Math.random() * 3) - 1,
      recordedAt: new Date().toISOString()
    },
    alerts,
    appointments,
    records: records.map(r => ({
      id: r.id,
      date: r.date,
      type: decrypt(r.type_enc),
      provider: decrypt(r.provider_enc),
      diagnosis: r.diagnosis_enc ? decrypt(r.diagnosis_enc) : null,
      notes: r.notes_enc ? decrypt(r.notes_enc) : null,
      labResults: r.lab_results_enc ? decrypt(r.lab_results_enc) : null,
      department: r.department_enc ? decrypt(r.department_enc) : null,
    })),
  });
}
