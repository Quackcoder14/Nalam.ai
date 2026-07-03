import { NextResponse } from 'next/server';
import { addMedicalRecord } from '@/lib/data';
import { requireRole } from '@/lib/auth';
import { sendPushToUser } from '@/lib/sendPush';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  // Only hospital desk staff (hdesk) may inject records via OCR
  const auth = requireRole(request, ['hdesk']);
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden: only hospital desk may add records' }, { status: 403 });

  try {
    const body = await request.json();
    const { patientId, type, provider, diagnosis, notes, labResults, doctorName, hospitalDesk } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    if (!provider || !provider.trim()) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }

    // Build a rich provider string showing hospital desk + doctor
    let richProvider = provider.trim();
    if (hospitalDesk) {
      richProvider = hospitalDesk;
    }
    if (doctorName) {
      richProvider = richProvider + ` — Dr. ${doctorName}`;
    }

    // Persist to MySQL with AES-256-GCM encryption on all clinical fields
    const record = await addMedicalRecord({
      patient_id: patientId,
      type:        type        || 'Document Scan',
      provider:    richProvider,
      diagnosis:   diagnosis   || '',
      notes:       notes       || '',
      lab_results: labResults  || '',
    });

    // Notify patient that a new record was added to their vault
    sendPushToUser(patientId, {
      title: '📁 New Health Record Added',
      body: `A new record has been added to your health vault by ${richProvider}.`,
      url: '/dashboard/records',
    }).catch(() => {});

    // Create clinical alert in patient dashboard (hospital-specific, not broadcast)
    await prisma.clinicalAlert.create({
      data: {
        patient_id: patientId,
        severity: 'info',
        title: 'New Health Record',
        message: `A new document scan record has been added to your vault by ${richProvider}.${diagnosis ? ` Diagnosis: ${diagnosis}.` : ''}`,
        // @ts-ignore - hospital field will exist after migration
        hospital: hospitalDesk || null,
        // @ts-ignore - broadcast field will exist after migration
        broadcast: false, // Document scan alerts are hospital-specific
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, record });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to add record';
    console.error('Failed to add record:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
