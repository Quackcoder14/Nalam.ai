import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  try {
    const { transcript, lang = 'en', patientId = 'P001' } = await request.json();
    if (!transcript) return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });

    const systemPrompt = `
You are an empathetic, clinical AI triage assistant. The user is a patient describing their symptoms or condition.
You must analyze the transcript to determine if they need immediate medical help.

1. "severity": must be exactly "critical", "warning", or "normal".
2. "riskLevel": must be "High", "Medium", or "Low".
3. "responseMessage": Speak directly to the patient. Be highly empathetic and calming. Explain what might be happening in simple, reassuring terms so they understand what they are facing. If it's serious, calmly advise them on the next steps without causing panic. If it's minor, reassure them. Do not keep it too short; give them a comforting explanation. IMPORTANT: This message MUST be written in ${lang === 'ta' ? 'Tamil' : 'English'}.
4. "clinicalSummary": A brief, professional medical summary of the symptoms in English (for the doctor's eyes).

Return ONLY raw valid JSON, strictly matching this shape:
{
  "severity": "...",
  "riskLevel": "...",
  "responseMessage": "...",
  "clinicalSummary": "..."
}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transcript: "${transcript}"` }
      ],
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(raw);

    // If severe or warning, log an alert to the hospital desk
    if (result.severity === 'critical' || result.severity === 'warning') {
      try {
        await prisma.clinicalAlert.create({
          data: {
            patient_id: patientId,
            severity: result.severity,
            title: result.severity === 'critical' ? '🚨 Voice Triage Alert (Critical)' : '⚠️ Voice Triage Alert',
            message: `Patient reported: "${transcript}". AI Summary: ${result.clinicalSummary}`,
          }
        });
      } catch (err) {
        console.error('Failed to log voice triage alert to DB:', err);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Voice Triage Error:', error);
    return NextResponse.json({ error: 'Failed to process voice triage' }, { status: 500 });
  }
}
