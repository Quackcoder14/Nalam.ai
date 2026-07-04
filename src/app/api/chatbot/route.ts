import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getSessionFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { message, conversationId, lang = 'en', patientContextId, patientData, records: clientRecords, intervention: clientIntervention } = body;
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
        const upcomingAppointments = appointments.filter((apt: any) => apt.date >= today);
        
        if (todayAppointments.length > 0) {
          appointmentsContext = `\n\nToday's Appointments:\n${todayAppointments.map((apt: any) => 
            `- ${apt.time || 'TBD'}: ${apt.patient_name} (${apt.patient_id}) - ${apt.reason_enc || 'Consultation'}`
          ).join('\n')}`;
        }
        
        if (upcomingAppointments.length > 0) {
          appointmentsContext += `\n\nUpcoming Appointments:\n${upcomingAppointments.slice(0, 5).map((apt: any) => 
            `- ${apt.date} at ${apt.time || 'TBD'}: ${apt.patient_name} (${apt.patient_id})`
          ).join('\n')}`;
        }

        // --- NEW LOGIC: Only fetch patient info if explicitly approved in this session ---
        if (patientContextId) {
          const p = await prisma.patient.findUnique({ where: { id: patientContextId } });
          const m = await prisma.medicalRecord.findMany({
            where: { patient_id: patientContextId },
            orderBy: { date: 'desc' },
            take: 3
          });
          
          if (p) {
            patientContext = `\n\n=== APPROVED PATIENT CONTEXT ===\nYou are currently discussing the case for Patient ID: ${p.id}.
Name: ${p.name_enc}
DOB: ${p.dob_enc} | Gender: ${p.gender_enc}
Blood Type: ${p.blood_type_enc}
Allergies: ${p.allergies_enc}
Chronic Conditions: ${p.chronic_conditions_enc || 'None'}
Current Meds: ${p.current_medications_enc || 'None'}\n\nRecent Records:\n${m.map((r: any) => `- [${r.date}] ${r.type_enc}: ${r.diagnosis_enc || 'N/A'}\n  Labs: ${r.lab_results_enc || r.lab_results || 'N/A'}`).join('\n')}\n===============================\n`;
          }
        }

      } catch (e) {
        console.error('[Chatbot] Failed to fetch clinician context:', e);
      }

      context = `You are a clinical AI assistant for a doctor. Your role is to help the doctor manage their schedule and analyze patient cases.
${patientContext ? `\nYou have an active patient context. Use this patient's data to answer the doctor's questions accurately. If the doctor asks for a diagnosis or treatment plan, base it strictly on the provided records.` : `\nYou currently DO NOT have a specific patient selected. If the doctor asks about a patient, inform them they need to search and load the patient context first.`}
${appointmentsContext}

IMPORTANT: You must respond in JSON format with this structure:
{
  "message": "your response text here",
  "is_emergency": false,
  "emergency_actions": null
}`;
    } else {
      // ── PATIENT CHATBOT ─────────────────────────────────────────────────
      try {
        // Fetch live patient info + appointments from DB
        const [patientDb, appointments] = await Promise.all([
          prisma.patient.findUnique({ where: { id: userId } }),
          prisma.appointment.findMany({
            where: { patient_id: userId },
            orderBy: { date: 'asc' },
          }),
        ]);

        // Fetch recent records
        const dbRecords = await prisma.medicalRecord.findMany({
          where: { patient_id: userId },
          orderBy: { date: 'desc' },
          take: 8,
        });

        const patient = patientDb;
        const today = new Date().toISOString().split('T')[0];
        const todayApts = appointments.filter((a: any) => a.date === today);
        const upcomingApts = appointments.filter((a: any) => a.date > today);
        const pastApts = appointments.filter((a: any) => a.date < today).slice(-3);

        // Build rich context sections
        const patientProfile = patient
          ? `NAME: ${(patientData as any)?.name ?? patient.name_enc ?? 'Unknown'}
DOB: ${patient.dob_enc ?? 'Unknown'} | Gender: ${(patientData as any)?.gender ?? patient.gender_enc ?? 'Unknown'}
Blood Type: ${patient.blood_type_enc ?? 'Unknown'}
Allergies: ${patient.allergies_enc ?? 'None known'}
Chronic Conditions: ${patient.chronic_conditions_enc ?? 'None on record'}
Current Medications: ${patient.current_medications_enc ?? 'None on record'}
ABHA ID: ${patient.abha_id_enc ?? 'Not registered'}`
          : 'Patient profile not available.';

        const todaySection = todayApts.length > 0
          ? `TODAY'S APPOINTMENTS:\n${todayApts.map((a: any) => `  • ${a.time ?? 'TBD'}: ${a.reason_enc ?? 'Consultation'} with Dr. ${a.doctor_name} at ${a.hospital} [${a.status}]`).join('\n')}`
          : 'No appointments today.';

        const upcomingSection = upcomingApts.length > 0
          ? `UPCOMING APPOINTMENTS:\n${upcomingApts.slice(0, 5).map((a: any) => `  • ${a.date} at ${a.time ?? 'TBD'}: ${a.reason_enc ?? 'Consultation'} with Dr. ${a.doctor_name} at ${a.hospital} [${a.status}]`).join('\n')}`
          : 'No upcoming appointments scheduled.';

        const pastSection = pastApts.length > 0
          ? `RECENT PAST APPOINTMENTS:\n${pastApts.map((a: any) => `  • ${a.date}: ${a.reason_enc ?? 'Consultation'} with Dr. ${a.doctor_name} [${a.status}]`).join('\n')}`
          : '';

        const recordsSection = dbRecords.length > 0
          ? `RECENT MEDICAL RECORDS (last 8):\n${dbRecords.map((r: any) => `  • [${r.date}] ${r.type_enc ?? ''}: ${r.diagnosis_enc ?? 'N/A'} | Labs: ${r.lab_results_enc ?? r.lab_results ?? 'N/A'}`).join('\n')}`
          : 'No medical records on file.';

        const interventionSection = clientIntervention
          ? `CURRENT AI HEALTH ASSESSMENT:
  Risk Level: ${(clientIntervention as any).riskLevel} (Score: ${(clientIntervention as any).risk_score}/10)
  Detected Pattern: ${(clientIntervention as any).detectedPattern}
  Recommended Actions: ${(clientIntervention as any).actionPlan}
  Latest Vitals: BP ${(clientIntervention as any).vitals?.systolic}/${(clientIntervention as any).vitals?.diastolic} mmHg | HbA1c ${(clientIntervention as any).vitals?.hba1c}% | eGFR ${(clientIntervention as any).vitals?.egfr} ml/min`
          : '';

        context = `You are Nalam AI, a compassionate and professional health assistant for this specific patient. You have full access to their health profile, appointments, and medical records below. Always refer to this data to give personalised, accurate answers.

══ PATIENT HEALTH PROFILE ══
${patientProfile}

══ APPOINTMENTS ══
${todaySection}
${upcomingSection}
${pastSection}

══ MEDICAL HISTORY ══
${recordsSection}

${interventionSection ? `══ HEALTH RISK ASSESSMENT ══\n${interventionSection}` : ''}

══ YOUR BEHAVIOUR RULES ══
1. PERSONALIZED: Always use the patient's actual data above to give specific, relevant answers. Never say "I don't have your data" — you do.
2. SAFE BOUNDARIES: You CANNOT prescribe medications, adjust dosages, diagnose new conditions, or recommend stopping existing medicines. If asked, clearly redirect: "Please discuss medication changes with your doctor."
3. PROFESSIONAL: Use simple, clear language a patient can understand. Avoid excessive jargon.
4. SCOPE: You CAN answer: appointment details, explain diagnoses/test results already in the record, explain what risk levels mean, provide general wellness advice, remind about scheduled appointments, explain what doctors said.
5. REFERRAL: For any concern that needs clinical judgment, always recommend contacting the treating doctor or visiting the hospital.
6. EMERGENCY DETECTION: If the patient's message contains ANY of these signals, set is_emergency=true IMMEDIATELY: chest pain, heart attack, stroke, can't breathe, difficulty breathing, severe bleeding, unconscious, collapsed, fainted, seizure, severe allergic reaction, anaphylaxis, poisoning, overdose, suicidal thoughts, self-harm, sudden severe headache, sudden loss of vision, sudden weakness on one side, difficulty speaking, coughing blood, vomiting blood, severe abdominal pain, severe burn, broken bone with bone visible, choking, drowning, electric shock, or any statement implying immediate physical danger.

IMPORTANT: You must respond in JSON format with this exact structure:
{
  "message": "your response here (friendly, structured with line breaks for clarity)",
  "is_emergency": false,
  "emergency_actions": null
}
For emergencies: set is_emergency to true and emergency_actions to ["call_ambulance", "alert_family"] and give immediate safety instructions first.`;

      } catch (e) {
        console.error('[Chatbot] Failed to fetch patient data:', e);
        context = `You are Nalam AI, a professional health assistant. Help the patient with general health questions. Always recommend consulting a doctor for clinical decisions. Do NOT prescribe medicines or make diagnoses.

IMPORTANT: Respond in JSON: {"message": "...", "is_emergency": false, "emergency_actions": null}
For emergencies (chest pain, difficulty breathing, severe bleeding, loss of consciousness, etc.) set is_emergency to true and emergency_actions to ["call_ambulance","alert_family"].`;
      }
    } // end else (patient role)

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
