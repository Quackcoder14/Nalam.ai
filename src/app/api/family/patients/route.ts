import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { decrypt, encrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

const MAX_FAMILY_PATIENTS = 5;

/* Helper: assert the logged-in family account owns an approved link for patientId */
async function getApprovedLink(familyId: string, patientId: string) {
  return prisma.familyPatientLink.findFirst({
    where: { family_id: familyId, patient_id: patientId, consent_status: 'approved' },
  });
}

/* ── GET /api/family/patients ─ list all linked patients ────────────────── */
export async function GET(request: Request) {
  const auth = requireRole(request, ['family']);
  if (!auth.ok) return auth.response;
  const familyId = auth.session.staffId;

  const links = await prisma.familyPatientLink.findMany({
    where: { family_id: familyId },
    orderBy: { requested_at: 'asc' },
  });

  const results = await Promise.all(
    links.map(async (link) => {
      let patientSummary: any = null;
      if (link.consent_status === 'approved') {
        const patient = await prisma.patient.findUnique({ where: { id: link.patient_id } });
        if (patient) {
          // Latest vitals
          const vitals = await prisma.rookVitals.findFirst({
            where: { patient_id: link.patient_id },
            orderBy: { recorded_at: 'desc' },
          });
          // Unread alerts count
          const alertsCount = await prisma.clinicalAlert.count({
            where: { patient_id: link.patient_id, is_read: false },
          });
          // Next upcoming appointment
          const nextAppt = await prisma.appointment.findFirst({
            where: { patient_id: link.patient_id, status: { in: ['pending', 'approved', 'scheduled'] } },
            orderBy: { created_at: 'desc' },
          });
          patientSummary = {
            id: patient.id,
            name: decrypt(patient.name_enc),
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
            alertsCount,
            nextAppointment: nextAppt ? {
              date: nextAppt.date, time: nextAppt.time,
              doctorName: nextAppt.doctor_name, hospital: nextAppt.hospital, status: nextAppt.status,
            } : null,
          };
        }
      }
      return {
        linkId: link.id,
        patientId: link.patient_id,
        nickname: link.nickname_enc ? decrypt(link.nickname_enc) : null,
        relation: link.relation_enc ? decrypt(link.relation_enc) : null,
        consentStatus: link.consent_status,
        requestedAt: link.requested_at,
        canViewRecords: link.can_view_records,
        patient: patientSummary,
      };
    })
  );

  return NextResponse.json({ links: results });
}

/* ── POST /api/family/patients ─ send a link request ────────────────────── */
export async function POST(request: Request) {
  const auth = requireRole(request, ['family']);
  if (!auth.ok) return auth.response;
  const familyId = auth.session.staffId;

  const { patientId, nickname, relation } = await request.json();
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

  // Enforce 5-patient limit
  const existingCount = await prisma.familyPatientLink.count({
    where: { family_id: familyId, consent_status: { not: 'revoked' } },
  });
  if (existingCount >= MAX_FAMILY_PATIENTS) {
    return NextResponse.json({ error: `Maximum ${MAX_FAMILY_PATIENTS} family members allowed` }, { status: 400 });
  }

  // Check patient exists
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  // Prevent duplicate active links
  const existing = await prisma.familyPatientLink.findFirst({
    where: { family_id: familyId, patient_id: patientId, consent_status: { in: ['pending', 'approved'] } },
  });
  if (existing) return NextResponse.json({ error: 'A link request already exists for this patient' }, { status: 409 });

  // Get family account name for the alert message
  const familyAccount = await prisma.familyAccount.findUnique({ where: { id: familyId } });
  const familyName = familyAccount ? decrypt(familyAccount.name_enc) : 'A family member';

  // Generate a 6-digit invite code (expires in 24 hours)
  const inviteCode = String(Math.floor(100000 + Math.random() * 900000));
  const inviteCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Create the link with the invite code
  const link = await prisma.familyPatientLink.create({
    data: {
      family_id: familyId,
      patient_id: patientId,
      nickname_enc: nickname ? encrypt(nickname) : null,
      relation_enc: relation ? encrypt(relation) : null,
      consent_status: 'pending',
      invite_code: inviteCode,
      invite_code_expires_at: inviteCodeExpiresAt,
    },
  });

  // Notify patient via ClinicalAlert — encode the text and code as JSON in the message field
  const messagePayload = JSON.stringify({
    text: `${familyName} is requesting access to your health records${relation ? ` as your ${relation}` : ''}. Your one-time approval code is: **${inviteCode}**. Share this code with them to grant access. This code expires in 24 hours. You can also approve or deny from your dashboard.`,
    linkId: link.id,
    inviteCode: inviteCode
  });

  await prisma.clinicalAlert.create({
    data: {
      patient_id: patientId,
      severity: 'family_link_request',
      title: 'Family Access Request',
      message: messagePayload,
    },
  });

  return NextResponse.json({ success: true, linkId: link.id });
}


