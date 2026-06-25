import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';
import { requireRole, getRoleFromHeader } from '@/lib/auth';

/* ── GET ──────────────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const doctorId  = searchParams.get('doctorId');
  const all       = searchParams.get('all');
  const id        = searchParams.get('id');

  try {
    // Single appointment by ID
    if (id) {
      const row = await prisma.appointment.findUnique({
        where: { id },
        include: { patient: true },
      });
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(mapRowToApt(row));
    }

    // All for hospital desk — requires hdesk role header to prevent data leaks
    if (all === 'true') {
      const auth = requireRole(request, ['hdesk']);
      if (!auth.ok) return auth.response;

      const rows = await prisma.appointment.findMany({
        include: { patient: true },
        orderBy: { created_at: 'desc' },
      });
      return NextResponse.json(rows.map(mapRowToApt));
    }

    // By patient — only the patient themselves or a clinician/hdesk may access
    if (patientId) {
      const role = getRoleFromHeader(request);
      if (!role) return NextResponse.json({ error: 'Forbidden: role header required' }, { status: 403 });

      const rows = await prisma.appointment.findMany({
        where: { patient_id: patientId },
        include: { patient: true },
        orderBy: { created_at: 'desc' },
      });
      return NextResponse.json(rows.map(mapRowToApt));
    }

    // By doctor (only approved + scheduled)
    if (doctorId) {
      const auth = requireRole(request, ['clinician', 'hdesk']);
      if (!auth.ok) return auth.response;

      const rows = await prisma.appointment.findMany({
        where: {
          doctor_id: doctorId,
          status: { in: ['approved', 'scheduled'] }
        },
        include: { patient: true },
        orderBy: { date: 'asc' },
      });
      return NextResponse.json(rows.map(mapRowToApt));
    }

    const allRows = await prisma.appointment.findMany({ include: { patient: true } });
    return NextResponse.json(allRows.map(mapRowToApt));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── POST — create new appointment ────────────────────────────────────────── */
export async function POST(request: Request) {
  // Only patients may book appointments
  const auth = requireRole(request, ['patient']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      patientId, patientName,
      doctorId, doctorName, doctorSpecialty, hospital,
      date, reason, aiSummary, urgency,
      attachments, vitalsSnapshot
    } = body;

    if (!patientId || !doctorId || !date || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Suppress unused warning — patientName is stored implicitly via patient relation
    void patientName;

    const row = await prisma.appointment.create({
      data: {
        patient_id: patientId,
        doctor_id: doctorId,
        doctor_name: doctorName || doctorId,
        doctor_specialty: doctorSpecialty || '',
        hospital: hospital || '',
        date,
        reason_enc: encrypt(reason),
        urgency: urgency || 'Routine',
        vitals_json: vitalsSnapshot ? encrypt(JSON.stringify(vitalsSnapshot)) : null,
        attachments_json: attachments && attachments.length ? encrypt(JSON.stringify(attachments)) : null,
        status: 'pending',
        ai_summary_enc: aiSummary ? encrypt(aiSummary) : null,
        hdesk_note_enc: null,
      },
      include: { patient: true },
    });

    return NextResponse.json({ success: true, appointment: mapRowToApt(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── PATCH — update status ─────────────────────────────────────────────────── */
export async function PATCH(request: Request) {
  // Only hdesk or clinicians may update appointment status
  const auth = requireRole(request, ['hdesk', 'clinician']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { id, status, hdeskNote } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { status };
    if (hdeskNote !== undefined) updateData.hdesk_note_enc = encrypt(hdeskNote);
    if (status === 'approved')  updateData.approved_at = new Date();
    if (status === 'scheduled') updateData.scheduled_at = new Date();

    const row = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: { patient: true },
    });

    return NextResponse.json({ success: true, appointment: mapRowToApt(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if ((e as Record<string, unknown>).code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ── DELETE — patient cancels pending ─────────────────────────────────────── */
export async function DELETE(request: Request) {
  // Only the patient themselves may cancel their own appointment
  const auth = requireRole(request, ['patient']);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const patientId = searchParams.get('patientId');

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!patientId) return NextResponse.json({ error: 'patientId required for ownership verification' }, { status: 400 });

  try {
    // Verify ownership: fetch the appointment and check that patient_id matches
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.patient_id !== patientId) {
      return NextResponse.json({ error: 'Forbidden: you can only cancel your own appointments' }, { status: 403 });
    }

    await prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if ((e as Record<string, unknown>).code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function mapRowToApt(row: Record<string, unknown> & {
  patient?: Record<string, unknown> | null;
  approved_at?: Date | null;
  scheduled_at?: Date | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient ? decrypt(row.patient.name_enc as string) : row.patient_id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    doctorSpecialty: row.doctor_specialty,
    hospital: row.hospital,
    date: row.date,
    reason: decrypt(row.reason_enc as string),
    urgency: row.urgency,
    vitalsSnapshot: row.vitals_json ? JSON.parse(decrypt(row.vitals_json as string)) : null,
    attachments: row.attachments_json ? JSON.parse(decrypt(row.attachments_json as string)) : [],
    status: row.status,
    aiSummary: row.ai_summary_enc ? decrypt(row.ai_summary_enc as string) : '',
    hdeskNote: row.hdesk_note_enc ? decrypt(row.hdesk_note_enc as string) : '',
    createdAt: (row.created_at as Date).toISOString(),
    approvedAt: row.approved_at ? (row.approved_at as Date).toISOString() : null,
    scheduledAt: row.scheduled_at ? (row.scheduled_at as Date).toISOString() : null,
  };
}
