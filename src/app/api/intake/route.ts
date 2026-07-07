import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || (session.role !== 'clinician' && session.role !== 'hdesk')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { patientId, hospital } = await request.json();
    if (!patientId || !hospital) {
      return NextResponse.json({ error: 'Missing patientId or hospital' }, { status: 400 });
    }

    const intake = await prisma.intakeRequest.create({
      data: {
        patient_id: patientId,
        hospital,
        status: 'pending',
      }
    });

    return NextResponse.json(intake);
  } catch (error) {
    console.error('Create Intake Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role'); // "patient", "desk", "doctor"

    if (role === 'patient') {
      const intakes = await prisma.intakeRequest.findMany({
        where: { patient_id: session.staffId, status: 'pending' },
        orderBy: { created_at: 'desc' }
      });
      return NextResponse.json(intakes);
    } 
    else if (role === 'desk') {
      const hospital = searchParams.get('hospital');
      if (!hospital) return NextResponse.json({ error: 'Hospital required' }, { status: 400 });
      
      const intakes = await prisma.intakeRequest.findMany({
        where: { hospital, status: { in: ['pending', 'submitted', 'routed'] } },
        orderBy: { created_at: 'desc' },
        include: { patient: { select: { name_enc: true, dob_enc: true, gender_enc: true } } }
      });
      return NextResponse.json(intakes);
    }
    else if (role === 'doctor') {
      const past = searchParams.get('past') === '1';
      const intakes = await prisma.intakeRequest.findMany({
        where: { 
          routed_doctor_id: session.staffId, 
          status: past ? 'cleared' : 'routed' 
        },
        orderBy: { updated_at: 'desc' },
        include: { patient: { select: { name_enc: true, id: true } } }
      });
      return NextResponse.json(intakes);
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  } catch (error) {
    console.error('Fetch Intake Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
