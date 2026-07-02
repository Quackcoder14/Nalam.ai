import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, conversationId, lang = 'en', patientContextId } = await request.json();
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const userId = session.staffId;
    const userRole = session.role; // 'patient' or 'clinician'

    // Get or create conversation
    let conversation;
    let finalConversationId = conversationId;
    if (conversationId) {
      conversation = await prisma.chatbotConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { created_at: 'asc' } } },
      });
      if (!conversation || conversation.user_id !== userId || conversation.user_role !== userRole) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    } else {
      conversation = await prisma.chatbotConversation.create({
        data: {
          user_id: userId,
          user_role: userRole,
        },
        include: { messages: true },
      });
      finalConversationId = conversation.id;
    }

    // Store user message
    await prisma.chatbotMessage.create({
      data: {
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      },
    });

    // Build context based on user role
    let context = '';
    let isEmergency = false;

    if (userRole === 'clinician') {
      // Fetch clinician's appointments and ONLY the approved patient's context
      let appointmentsContext = '';
      let patientContext = '';
      
      try {
        // Fetch appointments for this doctor
        const appointments = await prisma.appointment.findMany({
          where: { doctor_id: userId },
          orderBy: { date: 'asc' },
        });

        // Build appointments context (all appointments)
        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = appointments.filter((apt: any) => apt.date === today);
        const upcomingAppointments = appointments.filter((apt: any) => apt.date > today);
        
        if (todayAppointments.length > 0) {
          appointmentsContext = `\n\nToday's Appointments:\n${todayAppointments.map((apt: any) => 
            `- ${apt.time || 'TBD'}: ${apt.patient_name} (${apt.urgency}) - ${apt.reason_enc || 'Consultation'}`
          ).join('\n')}`;
        }
        
        if (upcomingAppointments.length > 0) {
          appointmentsContext += `\n\nUpcoming Appointments:\n${upcomingAppointments.slice(0, 5).map((apt: any) => 
            `- ${apt.date} at ${apt.time || 'TBD'}: ${apt.patient_name} (${apt.urgency})`
          ).join('\n')}`;
        }

        if (appointments.length === 0) {
          appointmentsContext = '\n\nYou have no appointments scheduled.';
        }

        // Check if there's an approved patient context in the conversation or request body
        let approvedPatientId = patientContextId;

        // Fallback: look for the last message that might contain patient context info if not provided in request
        if (!approvedPatientId) {
          const lastMessage = conversation.messages[conversation.messages.length - 1];
          if (lastMessage && lastMessage.content.includes('Patient Context Approved:')) {
            // Extract patient ID from the context
            const patientIdMatch = lastMessage.content.match(/Patient ID: (\w+)/);
            if (patientIdMatch) {
              approvedPatientId = patientIdMatch[1];
            }
          }
        }

        if (approvedPatientId) {
          // Fetch only this patient's records
          const patient = await prisma.patient.findUnique({
            where: { id: approvedPatientId },
          });
          
          const patientRecords = await prisma.medicalRecord.findMany({
            where: { patient_id: approvedPatientId },
            orderBy: { date: 'desc' },
            take: 10,
          });

          if (patient) {
            patientContext = `\n\nCurrent Patient Context (Approved):\n- Patient: ${patient.name_enc} (${patient.id})\n- Blood Type: ${patient.blood_type_enc}\n- Allergies: ${patient.allergies_enc}\n- Chronic Conditions: ${patient.chronic_conditions_enc || 'None'}\n- Current Medications: ${patient.current_medications_enc || 'None'}\n\nRecent Medical Records:\n${patientRecords.map((r: any) => 
              `- ${r.date}: ${r.diagnosis_enc} (${r.type_enc})`
            ).join('\n')}`;
          }
        }

        console.log('[Chatbot] Fetched', appointments.length, 'appointments for doctor:', userId);
      } catch (e) {
        console.error('[Chatbot] Failed to fetch doctor data:', e);
      }

      context = `You are a professional medical AI assistant helping Dr. ${userId}.
You provide clinically accurate, professional responses.
${patientContext ? 'You currently have approved access to the patient context below. Only discuss this patient when asked.' : 'You do not currently have approved access to any patient context. You can discuss general medical topics and your schedule.'}
${appointmentsContext}${patientContext}

IMPORTANT: You must respond in JSON format with this structure:
{
  "message": "your response text here",
  "is_emergency": false,
  "emergency_actions": null
}`;
    } else {
      // Fetch patient's appointments directly from database
      let appointmentsContext = '';
      let patientInfo = '';
      
      try {
        // Fetch appointments for this patient
        const appointments = await prisma.appointment.findMany({
          where: { patient_id: userId },
          orderBy: { date: 'asc' },
        });

        // Fetch patient info
        const patient = await prisma.patient.findUnique({
          where: { id: userId },
        });

        // Build appointments context
        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = appointments.filter((apt: any) => apt.date === today);
        const upcomingAppointments = appointments.filter((apt: any) => apt.date >= today);
        
        if (todayAppointments.length > 0) {
          appointmentsContext = `\n\nToday's Appointments:\n${todayAppointments.map((apt: any) => 
            `- ${apt.time || 'TBD'}: ${apt.reason_enc || 'Consultation'} with Dr. ${apt.doctor_name} at ${apt.hospital}`
          ).join('\n')}`;
        }
        
        if (upcomingAppointments.length > 0) {
          appointmentsContext += `\n\nUpcoming Appointments:\n${upcomingAppointments.slice(0, 5).map((apt: any) => 
            `- ${apt.date} at ${apt.time || 'TBD'}: ${apt.reason_enc || 'Consultation'} with Dr. ${apt.doctor_name}`
          ).join('\n')}`;
        }

        if (appointments.length === 0) {
          appointmentsContext = '\n\nYou have no appointments scheduled.';
        }

        // Build patient info context
        if (patient) {
          patientInfo = `\n\nYour Profile:\n- Blood Type: ${patient.blood_type_enc}\n- Allergies: ${patient.allergies_enc}\n- Chronic Conditions: ${patient.chronic_conditions_enc || 'None'}\n- Current Medications: ${patient.current_medications_enc || 'None'}`;
        }

        console.log('[Chatbot] Fetched', appointments.length, 'appointments for patient:', userId);
      } catch (e) {
        console.error('[Chatbot] Failed to fetch patient data:', e);
      }

      context = `You are a medical AI assistant helping a patient.
Provide clear, simple medical information. Always recommend consulting a doctor for serious concerns.${appointmentsContext}${patientInfo}

IMPORTANT: You must respond in JSON format with this structure:
{
  "message": "your response text here - format it line by line with clear structure",
  "is_emergency": true/false,
  "emergency_actions": ["call_ambulance", "alert_family"] or null
}

Analyze the patient's message to determine if it indicates a medical emergency. Set is_emergency to true if the patient reports symptoms like chest pain, severe bleeding, difficulty breathing, loss of consciousness, fainting, or other urgent conditions. Provide immediate guidance to call emergency services for emergencies.`;
    }

    // Build conversation history
    const history = conversation.messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: context },
        ...history.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const aiResponse = completion.choices[0]?.message?.content?.trim() || '{"message":"I apologize, but I could not generate a response.","is_emergency":false,"emergency_actions":null}';

    // Parse AI response to extract emergency status
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch {
      parsedResponse = {
        message: aiResponse,
        is_emergency: false,
        emergency_actions: null,
      };
    }

    // Store assistant message
    await prisma.chatbotMessage.create({
      data: {
        conversation_id: conversation.id,
        role: 'assistant',
        content: parsedResponse.message,
      },
    });

    // Update conversation timestamp
    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: { updated_at: new Date() },
    });

    return NextResponse.json({
      message: parsedResponse.message,
      is_emergency: parsedResponse.is_emergency || false,
      emergency_actions: parsedResponse.emergency_actions || null,
      conversationId: finalConversationId,
    });
  } catch (err) {
    console.error('Chatbot error:', err);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}

// GET endpoint to retrieve conversation history
export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      // Return all conversations for the user
      const conversations = await prisma.chatbotConversation.findMany({
        where: {
          user_id: session.staffId,
          user_role: session.role,
        },
        include: {
          messages: {
            orderBy: { created_at: 'asc' },
            take: 50, // Limit to last 50 messages
          },
        },
        orderBy: { updated_at: 'desc' },
      });

      return NextResponse.json({ conversations });
    }

    // Return specific conversation
    const conversation = await prisma.chatbotConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!conversation || conversation.user_id !== session.staffId || conversation.user_role !== session.role) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    console.error('Chat history error:', err);
    return NextResponse.json({ error: 'Failed to retrieve chat history' }, { status: 500 });
  }
}
