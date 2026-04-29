import { NextResponse } from 'next/server';
import { getPatientById, getMedicalRecords } from '@/lib/data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const contextType = searchParams.get('contextType') || 'unknown'; // e.g., 'emergency', 'specialist'
  const clinician = searchParams.get('clinician') || 'Clinician Portal';

  if (!id) {
    return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
  }

  const patient = await getPatientById(id);
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // Check Self-Sovereign Identity Consent Rules
  let hasConsent = false;
  if (contextType === 'specialist' && patient.consent_specialist === 'true') hasConsent = true;
  if (contextType === 'emergency' && patient.consent_emergency === 'true') hasConsent = true;
  if (contextType === 'research' && patient.consent_research === 'true') hasConsent = true;

  if (!hasConsent) {
    return NextResponse.json({ error: `Access Denied: Patient has not granted ${contextType} access.` }, { status: 403 });
  }

  // If consent granted, write to the audit log (fire-and-forget)
  const baseUrl = new URL(request.url).origin;
  fetch(`${baseUrl}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: id,
      clinician,
      reason: `${contextType.charAt(0).toUpperCase() + contextType.slice(1)} Context Request`,
    }),
  }).catch(() => {}); // Non-blocking

  // If consent is granted, "decrypt" and return the records
  const records = await getMedicalRecords(id);

  return NextResponse.json({ 
    success: true, 
    data: { patient, records } 
  });
}
