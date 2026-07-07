import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import Groq from 'groq-sdk';
import { encrypt, decrypt } from '@/lib/crypto';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, ...body } = await request.json();
    const { id } = await params;

    if (action === 'submit') {
      // Patient submits symptoms + questionnaire answers
      const { symptoms, questionnaire, lang = 'en' } = body;

      const symptomsText = symptoms || '';
      const qJson = JSON.stringify(questionnaire || {});

      // Generate AI clinical summary immediately
      const prompt = `You are a clinical intake assistant. Based on the following patient-reported symptoms and nurse triage questionnaire, generate a concise English clinical summary (3-5 sentences max) suitable for a doctor to read quickly before consultation.

SYMPTOMS: ${symptomsText}

QUESTIONNAIRE ANSWERS:
${Object.entries(questionnaire || {}).map(([q, a]) => `- ${q}: ${a}`).join('\n')}

Return ONLY the clinical summary text, no preamble.`;

      let aiSummary = '';
      try {
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 300,
        });
        aiSummary = completion.choices[0]?.message?.content?.trim() || '';
      } catch (e) {
        console.error('AI Summary generation failed:', e);
      }

      const updated = await prisma.intakeRequest.update({
        where: { id },
        data: {
          status: 'submitted',
          symptoms_text_enc: encrypt(symptomsText),
          questionnaire_json_enc: encrypt(qJson),
          ai_summary_enc: aiSummary ? encrypt(aiSummary) : null,
        }
      });

      return NextResponse.json(updated);
    }

    if (action === 'route') {
      // Desk routes to a doctor
      const { doctorId } = body;
      if (!doctorId) return NextResponse.json({ error: 'doctorId required' }, { status: 400 });

      const updated = await prisma.intakeRequest.update({
        where: { id },
        data: { status: 'routed', routed_doctor_id: doctorId }
      });
      return NextResponse.json(updated);
    }

    if (action === 'clear') {
      // Doctor clears (moves to past notifications)
      const updated = await prisma.intakeRequest.update({
        where: { id },
        data: { status: 'cleared' }
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Intake PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const intake = await prisma.intakeRequest.findUnique({
      where: { id },
      include: { patient: { select: { name_enc: true, id: true, dob_enc: true, gender_enc: true, blood_type_enc: true } } }
    });
    if (!intake) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Decrypt sensitive fields
    const decrypted = {
      ...intake,
      symptoms_text: intake.symptoms_text_enc ? decrypt(intake.symptoms_text_enc) : null,
      questionnaire: intake.questionnaire_json_enc ? JSON.parse(decrypt(intake.questionnaire_json_enc)) : null,
      ai_summary: intake.ai_summary_enc ? decrypt(intake.ai_summary_enc) : null,
      patient: intake.patient ? {
        ...intake.patient,
        name: decrypt(intake.patient.name_enc),
        dob: decrypt(intake.patient.dob_enc),
        gender: decrypt(intake.patient.gender_enc),
        blood_type: decrypt(intake.patient.blood_type_enc),
      } : null,
    };

    return NextResponse.json(decrypted);
  } catch (error) {
    console.error('Intake GET[id] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
