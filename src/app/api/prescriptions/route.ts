import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patientId, patientName, date, medications } = body;

    if (!patientId || !patientName || !medications || !Array.isArray(medications)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    if (medications.length === 0) {
      return NextResponse.json({ error: 'No medications provided' }, { status: 400 });
    }

    // Validate each medication
    for (const med of medications) {
      if (!med.name || !med.quantity || !med.days) {
        return NextResponse.json({ error: 'Each medication must have name, quantity, and days' }, { status: 400 });
      }
    }

    // Format medications as a readable string
    const medicationText = medications.map(med => {
      const schedule = [];
      if (med.schedule.morning) schedule.push(`Morning: ${med.schedule.morning} food`);
      if (med.schedule.afternoon) schedule.push(`Afternoon: ${med.schedule.afternoon} food`);
      if (med.schedule.night) schedule.push(`Night: ${med.schedule.night} food`);
      
      const scheduleStr = schedule.length > 0 ? ` (${schedule.join(', ')})` : '';
      const instructions = med.instructions ? ` - ${med.instructions}` : '';
      
      return `${med.name} ${med.dosage || ''} - Qty: ${med.quantity}, Days: ${med.days}${scheduleStr}${instructions}`;
    }).join('\n');

    // Create prescription text content
    const prescriptionContent = `PRESCRIPTION\n\nPatient: ${patientName}\nDate: ${new Date(date).toLocaleDateString()}\n\nMedications:\n${medicationText}\n\nPrescribed by: Clinician`;

    // Create a PatientFile entry for the prescription (so it appears in My Records)
    const file = await prisma.patientFile.create({
      data: {
        patient_id: patientId,
        filename_enc: encrypt(`Prescription_${new Date(date).toISOString().split('T')[0]}.txt`),
        file_type: 'document',
        file_data_enc: encrypt(prescriptionContent),
        source: 'clinician',
        uploaded_by: 'clinician',
        file_size_bytes: prescriptionContent.length,
        created_at: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Prescription uploaded successfully to My Records',
      fileId: file.id 
    });
  } catch (error) {
    console.error('Prescription upload error:', error);
    return NextResponse.json({ error: 'Failed to upload prescription' }, { status: 500 });
  }
}
