import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const alerts = await prisma.clinicalAlert.findMany({
      where: { is_read: false },
      orderBy: { created_at: 'desc' },
      take: 20
    });
    return NextResponse.json({ alerts });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const alert = await prisma.clinicalAlert.update({
      where: { id },
      data: { is_read: true }
    });
    return NextResponse.json({ success: true, alert });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}
