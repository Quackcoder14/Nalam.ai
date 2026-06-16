import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';

/* ── GET /api/chat?patientId=P001&hospital=Apollo ──────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const hospital  = searchParams.get('hospital');

  if (!patientId || !hospital) {
    return NextResponse.json({ error: 'patientId and hospital are required' }, { status: 400 });
  }

  try {
    const rows = await prisma.chatMessage.findMany({
      where: { patient_id: patientId, hospital },
      orderBy: { created_at: 'asc' },
    });

    const messages = rows.map(r => ({
      id: r.id,
      patientId: r.patient_id,
      hospital: r.hospital,
      sender: r.sender,
      type: r.type,
      content: decrypt(r.content_enc),
      createdAt: r.created_at.toISOString(),
    }));

    return NextResponse.json(messages);
  } catch (e: any) {
    return NextResponse.json({ error: 'Database error', details: e.message }, { status: 500 });
  }
}

/* ── POST /api/chat ──────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const { patientId, hospital, sender, type, content } = await request.json();

    if (!patientId || !hospital || !sender || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const row = await prisma.chatMessage.create({
      data: {
        patient_id: patientId,
        hospital,
        sender,
        type: type || 'text',
        content_enc: encrypt(content),
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: row.id,
        patientId: row.patient_id,
        hospital: row.hospital,
        sender: row.sender,
        type: row.type,
        content: decrypt(row.content_enc),
        createdAt: row.created_at.toISOString(),
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to save message', details: e.message }, { status: 500 });
  }
}
