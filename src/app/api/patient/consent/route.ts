import { NextResponse } from 'next/server';
import { updatePatientConsent } from '@/lib/data';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, emergency, specialist, research } = body;

    if (!id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
    }

    await updatePatientConsent(id, String(emergency), String(specialist), String(research));
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
  }
}
