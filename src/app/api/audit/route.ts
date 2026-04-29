import { NextResponse } from 'next/server';

// In-memory audit log (persists per server process lifetime)
// In production this would be a database table
const auditLog: { patientId: string; clinician: string; reason: string; timestamp: string }[] = [
  { patientId: 'P001', clinician: 'Dr. Chen (Cardiology)', reason: 'Specialist Context Request', timestamp: new Date(Date.now() - 1000 * 60 * 47).toISOString() },
  { patientId: 'P001', clinician: 'General Hospital ER', reason: 'Emergency Access', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const entries = auditLog.filter(e => e.patientId === patientId).reverse();
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entry = {
      patientId: body.patientId,
      clinician: body.clinician || 'Unknown Clinician',
      reason: body.reason || 'Context Request',
      timestamp: new Date().toISOString(),
    };
    auditLog.push(entry);
    return NextResponse.json({ success: true, entry });
  } catch {
    return NextResponse.json({ error: 'Failed to log audit entry' }, { status: 500 });
  }
}
