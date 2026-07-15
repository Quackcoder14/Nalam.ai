import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/* ── POST /api/family/patients/resend  ─ regenerate OTP & notify patient ─── */
export async function POST(request: Request) {
  const auth = requireRole(request, ['family']);
  if (!auth.ok) return auth.response;
  const familyId = auth.session.staffId;

  const { linkId } = await request.json();
  if (!linkId) return NextResponse.json({ error: 'linkId required' }, { status: 400 });

  const link = await prisma.familyPatientLink.findUnique({ where: { id: linkId } });
  if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  if (link.family_id !== familyId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  if (link.consent_status !== 'pending') return NextResponse.json({ error: 'Link is not pending' }, { status: 409 });

  // Generate new 6-digit code
  const newCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.familyPatientLink.update({
    where: { id: linkId },
    data: { invite_code: newCode, invite_code_expires_at: expiresAt },
  });

  // Get family name for the alert
  const familyAccount = await prisma.familyAccount.findUnique({ where: { id: familyId } });
  const familyName = familyAccount ? decrypt(familyAccount.name_enc) : 'A family member';
  const relation = link.relation_enc ? decrypt(link.relation_enc) : null;

  // Mark old pending family_link_request alerts as read to avoid clutter
  const oldAlerts = await prisma.clinicalAlert.findMany({
    where: { patient_id: link.patient_id, severity: 'family_link_request', is_read: false },
  });
  for (const alert of oldAlerts) {
    try {
      const parsed = JSON.parse(alert.message);
      if (parsed.linkId === linkId) {
        await prisma.clinicalAlert.update({ where: { id: alert.id }, data: { is_read: true } });
      }
    } catch {}
  }

  // Send fresh alert with new code
  const messagePayload = JSON.stringify({
    text: `${familyName} is requesting access to your health records${relation ? ` as your ${relation}` : ''} (resent). Your new one-time approval code is: **${newCode}**. Share this code with them to grant access. This code expires in 24 hours.`,
    linkId: link.id,
    inviteCode: newCode,
  });

  await prisma.clinicalAlert.create({
    data: {
      patient_id: link.patient_id,
      severity: 'family_link_request',
      title: 'Family Access Request (Resent)',
      message: messagePayload,
    },
  });

  return NextResponse.json({ success: true, newCode });
}
