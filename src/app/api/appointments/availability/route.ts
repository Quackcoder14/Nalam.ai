import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/appointments/availability?doctorId=dr_dhanush&date=2026-07-01
 * Returns booked time slots for a doctor on a given date.
 * Public endpoint — no PII exposed, only time strings.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get('doctorId');
  const date = searchParams.get('date');

  if (!doctorId || !date) {
    return NextResponse.json({ error: 'doctorId and date required' }, { status: 400 });
  }

  try {
    const rows = await prisma.appointment.findMany({
      where: {
        doctor_id: doctorId,
        date,
        status: { in: ['pending', 'approved', 'scheduled'] },
      },
      select: { time: true },
    });

    const bookedSlots = rows.map(r => r.time).filter(Boolean) as string[];
    const totalBooked = rows.length;

    return NextResponse.json({ bookedSlots, totalBooked, fullyBooked: totalBooked >= 5 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
