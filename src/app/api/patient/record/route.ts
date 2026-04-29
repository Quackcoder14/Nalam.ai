import { NextResponse } from 'next/server';
import { addMedicalRecord } from '@/lib/data';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patientId, type, provider, diagnosis, notes, labResults } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    // Persist to MySQL with AES-256-GCM encryption on all clinical fields
    const record = await addMedicalRecord({
      patient_id: patientId,
      type:        type        || 'Document Scan',
      provider:    provider    || 'nalam.ai OCR Engine',
      diagnosis:   diagnosis   || '',
      notes:       notes       || '',
      lab_results: labResults  || '',
    });

    return NextResponse.json({ success: true, record });
  } catch (e: any) {
    console.error('Failed to add record:', e);
    return NextResponse.json({ error: e.message || 'Failed to add record' }, { status: 500 });
  }
}
