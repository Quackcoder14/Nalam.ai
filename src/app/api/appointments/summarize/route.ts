import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  try {
    const { reason, patientName, doctorName, doctorSpecialty, urgency } = await request.json();
    if (!reason) return NextResponse.json({ error: 'No reason provided' }, { status: 400 });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a clinical documentation AI. Generate a concise, professional appointment request summary for a doctor. 
          Keep it under 120 words. Include: chief complaint, clinical context, and urgency. 
          Write in third person (e.g., "Patient reports..."). Return only the summary text, no JSON, no headers.`
        },
        {
          role: 'user',
          content: `Patient: ${patientName || 'Patient'}
Doctor: ${doctorName || 'Doctor'} (${doctorSpecialty || ''})
Urgency: ${urgency || 'Routine'}
Patient's reason: "${reason}"`
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || reason;
    return NextResponse.json({ summary });
  } catch (e: any) {
    console.error('Summarize error:', e);
    return NextResponse.json({ summary: request.body ? '' : '' , error: e.message }, { status: 500 });
  }
}
