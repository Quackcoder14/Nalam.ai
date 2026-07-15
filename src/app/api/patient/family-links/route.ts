import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/* ── GET /api/patient/family-links ─ list links for the logged-in patient ─── */
export async function GET(request: Request) {
  const auth = requireRole(request, ['patient']);
  if (!auth.ok) return auth.response;
  
  const patientId = auth.session.staffId;

  const links = await prisma.familyPatientLink.findMany({
    where: { patient_id: patientId },
    include: { family: true },
    orderBy: { requested_at: 'desc' },
  });

  const results = links.map(link => ({
    id: link.id,
    familyId: link.family_id,
    familyName: decrypt(link.family.name_enc),
    nickname: link.nickname_enc ? decrypt(link.nickname_enc) : null,
    relation: link.relation_enc ? decrypt(link.relation_enc) : null,
    status: link.consent_status,
    requestedAt: link.requested_at,
    consentedAt: link.consented_at,
  }));

  return NextResponse.json({ links: results });
}

/* ── PATCH /api/patient/family-links ─ approve/revoke a link ────────────── */
export async function PATCH(request: Request) {
  const body = await request.json();
  const { linkId, action, inviteCode } = body;

  if (!linkId || !['approve', 'revoke', 'approve_by_code'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action or missing linkId' }, { status: 400 });
  }

  // approve_by_code: family member enters code → no patient auth needed, just code check
  if (action === 'approve_by_code') {
    if (!inviteCode) return NextResponse.json({ error: 'inviteCode required' }, { status: 400 });

    const link = await prisma.familyPatientLink.findUnique({ where: { id: linkId } });
    if (!link) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    if (link.consent_status !== 'pending') {
      return NextResponse.json({ error: 'Link is not pending' }, { status: 409 });
    }
    if (link.invite_code !== String(inviteCode)) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    if (link.invite_code_expires_at && new Date() > link.invite_code_expires_at) {
      return NextResponse.json({ error: 'Code has expired' }, { status: 400 });
    }

    await prisma.familyPatientLink.update({
      where: { id: linkId },
      data: { consent_status: 'approved', consented_at: new Date(), invite_code: null, can_view_records: true },
    });
    return NextResponse.json({ success: true, status: 'approved' });
  }

  // Normal approve/revoke: must be the patient who owns the link
  const auth = requireRole(request, ['patient']);
  if (!auth.ok) return auth.response;
  const patientId = auth.session.staffId;

  const link = await prisma.familyPatientLink.findUnique({ where: { id: linkId } });
  if (!link || link.patient_id !== patientId) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  const newStatus = action === 'approve' ? 'approved' : 'revoked';
  const consentedAt = action === 'approve' ? new Date() : link.consented_at;

  const updated = await prisma.familyPatientLink.update({
    where: { id: linkId },
    data: {
      consent_status: newStatus,
      consented_at: consentedAt,
      can_view_records: action === 'approve',
      // Clear the invite code once resolved
      invite_code: null,
    },
  });

  return NextResponse.json({ success: true, status: updated.consent_status });
}

