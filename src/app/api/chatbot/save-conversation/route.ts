import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest, requireRole } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['clinician', 'hdesk']);
    if (!auth.ok) return auth.response;

    const { patientId } = await request.json();
    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 });

    const doctorId = auth.session.staffId;

    // Find the latest chatbot conversation for this clinician
    const conversation = await prisma.chatbotConversation.findFirst({
      where: { 
        user_id: doctorId,
        user_role: 'clinician'
      },
      orderBy: { updated_at: 'desc' },
      include: {
        messages: {
          orderBy: { created_at: 'asc' }
        }
      }
    });

    if (!conversation || conversation.messages.length === 0) {
      return NextResponse.json({ message: 'No conversation found to save' }, { status: 200 });
    }

    if (conversation.messages.length < 2) {
      return NextResponse.json({ message: 'Conversation too short to save' }, { status: 200 });
    }

    // Build Transcript Text
    let transcriptText = `AI Clinical Assistant Conversation\nPatient ID: ${patientId}\nClinician ID: ${doctorId}\nDate: ${new Date().toLocaleString('en-IN')}\n\n`;
    
    // We only take the user and assistant messages
    const actualMessages = conversation.messages.filter(m => m.role === 'user' || m.role === 'assistant');
    
    // If the conversation is empty after filtering
    if (actualMessages.length === 0) {
      return NextResponse.json({ message: 'No substantial conversation found to save' }, { status: 200 });
    }

    actualMessages.forEach(m => {
      const roleName = m.role === 'user' ? 'Clinician' : 'AI Assistant';
      transcriptText += `[${roleName}] (${new Date(m.created_at).toLocaleTimeString('en-IN')}):\n${m.content}\n\n`;
    });

    const fileData = 'data:text/plain;base64,' + Buffer.from(transcriptText).toString('base64');
    const fileSizeBytes = Buffer.byteLength(transcriptText, 'utf8');

    const { encrypt } = await import('@/lib/crypto');
    const file = await prisma.patientFile.create({
      data: {
        patient_id: patientId,
        filename_enc: encrypt(`AI_Consultation_${new Date().toISOString().split('T')[0]}.txt`),
        file_type: 'document',
        file_data_enc: encrypt(fileData),
        source: 'clinician',
        uploaded_by: doctorId,
        file_size_bytes: fileSizeBytes,
      },
    });

    return NextResponse.json({ success: true, fileId: file.id });
  } catch (error: any) {
    console.error('Error saving conversation:', error);
    return NextResponse.json({ error: error.message || 'Failed to save conversation' }, { status: 500 });
  }
}
