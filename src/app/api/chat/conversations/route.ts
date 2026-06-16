import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hospital = searchParams.get('hospital');

  if (!hospital) return NextResponse.json({ error: 'hospital required' }, { status: 400 });

  try {
    // To get distinct conversations securely even if Prisma client is stale, use raw SQL
    const messages = await prisma.$queryRaw<any[]>`
      SELECT m.*, p.name_enc as patient_name 
      FROM "chat_messages" m 
      LEFT JOIN "patients" p ON m.patient_id = p.id
      WHERE m.hospital = ${hospital}
      ORDER BY m.created_at DESC
    `;

    const convMap = new Map<string, any>();

    for (const m of messages) {
      if (!convMap.has(m.patient_id)) {
        convMap.set(m.patient_id, {
          patientId: m.patient_id,
          patientName: m.patient_name ? decrypt(m.patient_name) : 'Unknown',
          lastMessage: m.type === 'text' ? decrypt(m.content_enc) : `[${m.type}]`,
          timestamp: m.created_at,
          unreadCount: 0,
        });
      }

      // Count unread messages sent by patient to desk
      if (m.sender === 'patient' && !m.is_read) {
        convMap.get(m.patient_id).unreadCount++;
      }
    }

    return NextResponse.json(Array.from(convMap.values()));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
