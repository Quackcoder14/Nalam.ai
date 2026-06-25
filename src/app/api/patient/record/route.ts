import { NextResponse } from 'next/server';
import { addMedicalRecord } from '@/lib/data';
import { requireRole } from '@/lib/auth';

export async function POST(request: Request) {
  // Only hospital desk staff (hdesk) may inject records via OCR
  const auth = requireRole(request, ['hdesk']);
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden: only hospital desk may add records' }, { status: 403 });

  try {
    const body = await request.json();
    const { patientId, type, provider, diagnosis, notes, labResults } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    if (!provider || !provider.trim()) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }

    // Persist to MySQL with AES-256-GCM encryption on all clinical fields
    const record = await addMedicalRecord({
      patient_id: patientId,
      type:        type        || 'Document Scan',
      provider:    provider.trim(),
      diagnosis:   diagnosis   || '',
      notes:       notes       || '',
      lab_results: labResults  || '',
    });

    return NextResponse.json({ success: true, record });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to add record';
    console.error('Failed to add record:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
