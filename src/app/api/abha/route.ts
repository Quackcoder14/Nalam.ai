import { NextResponse } from 'next/server';
import { encrypt, decrypt } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';

/** Validate & normalise raw input to 14-digit string */
function normaliseAbha(raw: string): string | null {
  const clean = raw.replace(/[^0-9]/g, '');
  return clean.length === 14 ? clean : null;
}

/** Format 14-digit string as XX-XXXX-XXXX-XXXX */
function formatAbha(digits: string): string {
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
}

/** Mask last segment: XX-XXXX-XXXX-•••• */
function maskAbha(digits: string): string {
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-••••`;
}

/* ── GET /api/abha?patientId=P001 ──────────────────────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

  try {
    const row = await prisma.patient.findUnique({ where: { id: patientId } });
    if (row?.abha_id_enc) {
      const plain = decrypt(row.abha_id_enc);
      return NextResponse.json({ verified: true, masked: maskAbha(plain), formatted: formatAbha(plain) });
    }
    return NextResponse.json({ verified: false, masked: null, formatted: null });
  } catch (e: any) {
    return NextResponse.json({ error: 'Database error', details: e.message }, { status: 500 });
  }
}

/* ── POST /api/abha  body: { patientId, abha_id } ─────────────────────── */
export async function POST(request: Request) {
  try {
    const { patientId, abha_id } = await request.json();
    if (!patientId || !abha_id)
      return NextResponse.json({ error: 'patientId and abha_id are required' }, { status: 400 });

    const digits = normaliseAbha(abha_id);
    if (!digits)
      return NextResponse.json({ error: 'Invalid ABHA ID — must be 14 digits (e.g. 91-1234-5678-0000)' }, { status: 422 });

    const encrypted = encrypt(digits);

    await prisma.patient.update({
      where: { id: patientId },
      data: { abha_id_enc: encrypted },
    });

    return NextResponse.json({ success: true, masked: maskAbha(digits), formatted: formatAbha(digits) });
  } catch (e: any) {
    console.error('ABHA POST error:', e);
    return NextResponse.json({ error: 'Failed to save ABHA ID', details: e.message }, { status: 500 });
  }
}
