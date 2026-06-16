import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const role = searchParams.get('role'); // 'patient' or 'desk'
  const hospital = searchParams.get('hospital');

  if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 });

  try {
    let unreadCount = 0;
    
    if (role === 'patient') {
      if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });
      const rows = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM "chat_messages" WHERE patient_id = ${patientId} AND sender = 'desk' AND is_read = false`;
      unreadCount = Number(rows[0]?.count || 0);
    } else if (role === 'desk') {
      if (!hospital) return NextResponse.json({ error: 'hospital required' }, { status: 400 });
      const rows = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM "chat_messages" WHERE hospital = ${hospital} AND sender = 'patient' AND is_read = false`;
      unreadCount = Number(rows[0]?.count || 0);
    }

    return NextResponse.json({ unreadCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { patientId, hospital, role } = await request.json();
    if (!patientId || !hospital || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // If role is patient, mark messages from desk as read.
    // If role is desk, mark messages from patient as read.
    const senderToMark = role === 'patient' ? 'desk' : 'patient';

    await prisma.$executeRaw`
      UPDATE "chat_messages" 
      SET is_read = true 
      WHERE patient_id = ${patientId} 
      AND hospital = ${hospital} 
      AND sender = ${senderToMark} 
      AND is_read = false
    `;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
