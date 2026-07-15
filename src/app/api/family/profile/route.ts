import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/* ── GET /api/family/profile ──────────────────────────────────────── */
export async function GET(request: Request) {
  const auth = requireRole(request, ['family']);
  if (!auth.ok) return auth.response;
  const familyId = auth.session.staffId;

  const row = await prisma.familyAccount.findUnique({ where: { id: familyId } });
  if (!row) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const safe = (enc: string | null | undefined) => {
    if (!enc) return '';
    try { return decrypt(enc); } catch { return ''; }
  };

  return NextResponse.json({
    profile: {
      name:    safe(row.name_enc),
      email:   row.email,
      mobile:  safe(row.mobile_enc),
      dob:     safe((row as any).dob_enc),
      gender:  safe((row as any).gender_enc),
      address: safe((row as any).address_enc),
      city:    safe((row as any).city_enc),
      state:   safe((row as any).state_enc),
    }
  });
}

/* ── PATCH /api/family/profile ────────────────────────────────────── */
export async function PATCH(request: Request) {
  const auth = requireRole(request, ['family']);
  if (!auth.ok) return auth.response;
  const familyId = auth.session.staffId;

  const body = await request.json();

  const encOrNull = (v: string | undefined) =>
    v !== undefined ? (v.trim() ? encrypt(v.trim()) : null) : undefined;

  const data: Record<string, any> = {};
  if (body.name    !== undefined) data.name_enc    = encrypt((body.name ?? '').trim());
  if (body.mobile  !== undefined) data.mobile_enc  = encOrNull(body.mobile);
  if (body.dob     !== undefined) data.dob_enc     = encOrNull(body.dob);
  if (body.gender  !== undefined) data.gender_enc  = encOrNull(body.gender);
  if (body.address !== undefined) data.address_enc = encOrNull(body.address);
  if (body.city    !== undefined) data.city_enc    = encOrNull(body.city);
  if (body.state   !== undefined) data.state_enc   = encOrNull(body.state);

  // Email update — check uniqueness first
  if (body.email !== undefined) {
    const newEmail = (body.email ?? '').toLowerCase().trim();
    if (newEmail) {
      const existing = await prisma.familyAccount.findUnique({ where: { email: newEmail } });
      if (existing && existing.id !== familyId)
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      data.email = newEmail;
    }
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  await prisma.familyAccount.update({ where: { id: familyId }, data });
  return NextResponse.json({ success: true });
}
