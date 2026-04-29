import { NextResponse } from 'next/server';
import { getPatientById, getMedicalRecords } from '@/lib/data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
  }

  const patient = await getPatientById(id);
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const records = await getMedicalRecords(id);

  return NextResponse.json({ patient, records });
}
