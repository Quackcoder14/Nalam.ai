import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import crypto from 'crypto';

const OTP_TTL_MS = 2 * 60 * 1000; // 2 minutes

function hashOtp(otp: string) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/* ── POST /api/patient/records-otp ──────────────────────────────────────── */
export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action || 'generate';

  if (action === 'generate') {
    // Only clinician or hdesk can generate an OTP for a patient
    const auth = requireRole(request, ['clinician', 'hdesk']);
    if (!auth.ok) return auth.response;

    const patientId = String(body.patientId ?? '').trim();
    const requestorName = String(body.requestorName ?? auth.session.staffId).trim();

    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

    // Invalidate any existing active OTPs for this patient from this requestor
    await prisma.recordsOtp.updateMany({
      where: { patient_id: patientId, requestor_id: auth.session.staffId, used: false },
      data: { used: true },
    });

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const otpRecord = await prisma.recordsOtp.create({
      data: {
        patient_id: patientId,
        otp_hash: hashOtp(otp),
        requestor_id: auth.session.staffId,
        requestor_name: requestorName,
        expires_at: expiresAt,
      },
    });

    // Deliver OTP as a special in-app alert to the patient's dashboard
    const formatted = `${otp.slice(0, 3)} ${otp.slice(3)}`;
    const alert = await prisma.clinicalAlert.create({
      data: {
        patient_id: patientId,
        severity: 'otp',
        title: `Records Access Request`,
        message: `${requestorName} is requesting access to your medical records.\n\nYour OTP is: ${formatted}\n\nThis code is valid for 2 minutes. Do not share it unless you trust this person.`,
      },
    });

    // Trigger push notification for OTP alert
    try {
      const { sendWebPushNotifications } = await import('@/lib/webPush');
      await sendWebPushNotifications(
        { patientId, role: 'patient' },
        {
          title: `Records Access Request`,
          body: `${requestorName} is requesting access. Your OTP is: ${formatted}`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: alert.id,
          severity: 'otp',
        }
      );
    } catch (pushErr) {
      console.error('[Records OTP] Failed to send push notification:', pushErr);
    }

    return NextResponse.json({ success: true, otpId: otpRecord.id });
  }

  if (action === 'verify') {
    const auth = requireRole(request, ['clinician', 'hdesk']);
    if (!auth.ok) return auth.response;

    const patientId = String(body.patientId ?? '').trim();
    const otp = String(body.otp ?? '').replace(/\s/g, '').trim();

    if (!patientId || !otp) return NextResponse.json({ error: 'patientId and otp required' }, { status: 400 });

    // Find a valid, unused OTP matching this requestor + patient
    const record = await prisma.recordsOtp.findFirst({
      where: {
        patient_id: patientId,
        requestor_id: auth.session.staffId,
        used: false,
        expires_at: { gt: new Date() },
        otp_hash: hashOtp(otp),
      },
    });

    if (!record) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired OTP' }, { status: 401 });
    }

    // Mark as used (consumed — one-time only)
    await prisma.recordsOtp.update({ where: { id: record.id }, data: { used: true } });

    // Return the OTP record ID as an access token for file fetching
    return NextResponse.json({ valid: true, otpToken: record.id });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
