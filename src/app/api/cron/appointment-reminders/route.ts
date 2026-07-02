import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/sendPush';

/**
 * GET /api/cron/appointment-reminders
 *
 * Finds all appointments scheduled for tomorrow and sends a push reminder to each patient.
 * Protected by CRON_SECRET env variable.
 *
 * To wire up with Vercel Cron, add to vercel.json:
 * { "crons": [{ "path": "/api/cron/appointment-reminders", "schedule": "0 8 * * *" }] }
 * And set CRON_SECRET in your environment variables.
 *
 * The Authorization header must be: "Bearer <CRON_SECRET>"
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Require CRON_SECRET if configured
  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Find all upcoming appointments for tomorrow
    const appointments = await prisma.appointment.findMany({
      where: {
        date: tomorrowStr,
        status: { in: ['approved', 'scheduled'] },
      },
      include: { patient: true },
    });

    const results: Array<{ patientId: string; status: string }> = [];

    for (const apt of appointments) {
      try {
        await sendPushToUser(apt.patient_id, {
          title: '📅 Appointment Reminder',
          body: `Reminder: You have an appointment tomorrow (${tomorrowStr}) with ${apt.doctor_name} at ${apt.hospital}${apt.time ? ` at ${apt.time}` : ''}.`,
          url: '/appointments/requests',
        });

        // Also create a clinical alert so they see it in-app
        await prisma.clinicalAlert.create({
          data: {
            patient_id: apt.patient_id,
            severity: 'info',
            title: 'Upcoming Appointment Tomorrow',
            message: `You have an appointment tomorrow with ${apt.doctor_name} at ${apt.hospital}${apt.time ? ` at ${apt.time}` : ''}. Please be on time.`,
          },
        });

        results.push({ patientId: apt.patient_id, status: 'notified' });
      } catch (err) {
        console.error(`Failed to notify patient ${apt.patient_id}:`, err);
        results.push({ patientId: apt.patient_id, status: 'failed' });
      }
    }

    return NextResponse.json({
      success: true,
      date: tomorrowStr,
      appointmentsFound: appointments.length,
      results,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
