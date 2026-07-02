import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // Delete all MedicalRecord entries with diagnosis_enc = 'AI Consultation Log'
    const result = await prisma.medicalRecord.deleteMany({
      where: {
        diagnosis_enc: 'AI Consultation Log'
      }
    });

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.count,
      message: `Deleted ${result.count} AI consultation log entries from timeline`
    });
  } catch (error: any) {
    console.error('Error cleaning up AI logs:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to cleanup AI logs' 
    }, { status: 500 });
  }
}
