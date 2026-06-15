import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';

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

    // All for hospital desk (pending + approved + rejected + cancelled)
    if (all === 'true') {
      const rows = await prisma.appointment.findMany({
        include: { patient: true },
        orderBy: { created_at: 'desc' },
      });
      return NextResponse.json(rows.map(mapRowToApt));
    }

    // By patient
    if (patientId) {
      const rows = await prisma.appointment.findMany({
        where: { patient_id: patientId },
        include: { patient: true },
        orderBy: { created_at: 'desc' },
      });
      return NextResponse.json(rows.map(mapRowToApt));
    }

    // By doctor (only approved + scheduled)
    if (doctorId) {
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ── POST — create new appointment ────────────────────────────────────────── */
export async function POST(request: Request) {
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ── PATCH — update status ─────────────────────────────────────────────────── */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, hdeskNote } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    }

    const updateData: any = { status };
    if (hdeskNote !== undefined) updateData.hdesk_note_enc = encrypt(hdeskNote);
    if (status === 'approved')  updateData.approved_at = new Date();
    if (status === 'scheduled') updateData.scheduled_at = new Date();

    const row = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: { patient: true },
    });

    return NextResponse.json({ success: true, appointment: mapRowToApt(row) });
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ── DELETE — patient cancels pending ─────────────────────────────────────── */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    await prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function mapRowToApt(row: any) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient ? decrypt(row.patient.name_enc) : row.patient_id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    doctorSpecialty: row.doctor_specialty,
    hospital: row.hospital,
    date: row.date,
    reason: decrypt(row.reason_enc),
    urgency: row.urgency,
    vitalsSnapshot: row.vitals_json ? JSON.parse(decrypt(row.vitals_json)) : null,
    attachments: row.attachments_json ? JSON.parse(decrypt(row.attachments_json)) : [],
    status: row.status,
    aiSummary: row.ai_summary_enc ? decrypt(row.ai_summary_enc) : '',
    hdeskNote: row.hdesk_note_enc ? decrypt(row.hdesk_note_enc) : '',
    createdAt: row.created_at.toISOString(),
    approvedAt: row.approved_at ? row.approved_at.toISOString() : null,
    scheduledAt: row.scheduled_at ? row.scheduled_at.toISOString() : null,
  };
}
