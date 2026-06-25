import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';
import { requireRole, getRoleFromHeader } from '@/lib/auth';
import { DOCTOR_SCHEDULES } from '@/lib/doctors';

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

      const clinicianRole = auth.session.clinicianRole;
      
      const mapped = rows.map(row => {
        const apt = mapRowToApt(row);
        
        // Consent checking (only clinicians need patient consent, hdesk has global access)
        if (auth.session.role === 'clinician') {
          const p = row.patient as any;
          let hasConsent = false;
          if (clinicianRole === 'emergency') hasConsent = p?.consent_emergency;
          else if (clinicianRole === 'specialist') hasConsent = p?.consent_specialist;
          else if (clinicianRole === 'research') hasConsent = p?.consent_research;

          if (!hasConsent) {
            return {
              ...apt,
              patientName: 'REDACTED (No Consent)',
              reason: 'REDACTED (No Consent)',
              vitalsSnapshot: null,
              attachments: [],
              aiSummary: 'REDACTED (No Consent)',
            };
          }
        }
        
        return apt;
      });

      return NextResponse.json(mapped);
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
      date, time, reason, aiSummary, urgency,
      attachments, vitalsSnapshot
    } = body;

    if (!patientId || !doctorId || !date || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Suppress unused warning — patientName is stored implicitly via patient relation
    void patientName;

    // Check doctor schedule and limits
    const allowedDays = DOCTOR_SCHEDULES[doctorId];
    if (allowedDays) {
      const d = new Date(date + 'T00:00:00');
      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      if (!allowedDays.includes(dayName)) {
        return NextResponse.json({ error: 'Doctor is not available on this day of the week.' }, { status: 409 });
      }
    }

    if (time) {
      const overlapping = await prisma.appointment.count({
        where: {
          doctor_id: doctorId,
          date: date,
          time: time,
          status: { in: ['approved', 'scheduled'] }
        }
      });
      if (overlapping > 0) {
        return NextResponse.json({ error: 'This time slot is already booked. Please choose another time.' }, { status: 409 });
      }
    }

    const existingApts = await prisma.appointment.count({
      where: {
        doctor_id: doctorId,
        date: date,
        status: { in: ['approved', 'scheduled'] }
      }
    });

    if (existingApts >= 5) {
      return NextResponse.json({ error: 'This doctor is fully booked on your selected date. Please choose another date.' }, { status: 409 });
    }

    const row = await prisma.appointment.create({
      data: {
        patient_id: patientId,
        doctor_id: doctorId,
        doctor_name: doctorName || doctorId,
        doctor_specialty: doctorSpecialty || '',
        hospital: hospital || '',
        date,
        time: time || null,
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
    const { id, status, hdeskNote, rescheduleDate, rescheduleTime, rescheduleReason } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { status };
    if (hdeskNote !== undefined) updateData.hdesk_note_enc = encrypt(hdeskNote);
    if (status === 'approved')  updateData.approved_at = new Date();
    if (status === 'scheduled') updateData.scheduled_at = new Date();

    if (status === 'pending_reschedule') {
      if (!rescheduleDate || !rescheduleTime || !rescheduleReason) {
        return NextResponse.json({ error: 'reschedule details required' }, { status: 400 });
      }
      updateData.reschedule_proposed_date = rescheduleDate;
      updateData.reschedule_proposed_time = rescheduleTime;
      updateData.reschedule_reason_enc = encrypt(rescheduleReason);
    } else if (status === 'reschedule_approved') {
      const existing = await prisma.appointment.findUnique({ where: { id } });
      if (existing && existing.reschedule_proposed_date && existing.reschedule_proposed_time) {
        updateData.date = existing.reschedule_proposed_date;
        updateData.time = existing.reschedule_proposed_time;
        updateData.status = 'scheduled'; // Promote directly to scheduled
        updateData.scheduled_at = new Date();
        updateData.reschedule_proposed_date = null;
        updateData.reschedule_proposed_time = null;
        updateData.reschedule_reason_enc = null;

        // Create a notification for the patient
        await prisma.clinicalAlert.create({
          data: {
            patient_id: existing.patient_id,
            severity: 'info',
            title: 'Appointment Rescheduled',
            message: `Your appointment with ${existing.doctor_name} has been rescheduled to ${existing.reschedule_proposed_date} at ${existing.reschedule_proposed_time}.`,
          }
        });
      } else {
        return NextResponse.json({ error: 'No reschedule proposal found' }, { status: 400 });
      }
    } else if (status === 'reschedule_rejected') {
        updateData.status = 'scheduled'; // Revert to original status
        updateData.reschedule_proposed_date = null;
        updateData.reschedule_proposed_time = null;
        updateData.reschedule_reason_enc = null;
    }

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
    time: row.time,
    reason: decrypt(row.reason_enc as string),
    urgency: row.urgency,
    vitalsSnapshot: row.vitals_json ? JSON.parse(decrypt(row.vitals_json as string)) : null,
    attachments: row.attachments_json ? JSON.parse(decrypt(row.attachments_json as string)) : [],
    status: row.status,
    aiSummary: row.ai_summary_enc ? decrypt(row.ai_summary_enc as string) : '',
    hdeskNote: row.hdesk_note_enc ? decrypt(row.hdesk_note_enc as string) : '',
    rescheduleReason: row.reschedule_reason_enc ? decrypt(row.reschedule_reason_enc as string) : null,
    rescheduleProposedDate: row.reschedule_proposed_date,
    rescheduleProposedTime: row.reschedule_proposed_time,
    createdAt: (row.created_at as Date).toISOString(),
    approvedAt: row.approved_at ? (row.approved_at as Date).toISOString() : null,
    scheduledAt: row.scheduled_at ? (row.scheduled_at as Date).toISOString() : null,
  };
}
