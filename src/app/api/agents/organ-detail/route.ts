import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  try {
    const { organ, medication, dosage, effect, lang = 'en' } = await request.json();
    if (!organ || !medication) return NextResponse.json({ error: 'Missing organ or medication' }, { status: 400 });

    const medWithDosage = dosage ? `${medication} ${dosage}` : medication;
    const langInstruction = lang === 'ta'
      ? 'Write your entire response in Tamil (தமிழில் எழுதவும்).'
      : 'Write your response in clear, simple English.';

    const effectContext = effect === 'good'
      ? `This drug has a BENEFICIAL effect on the ${organ}.`
      : effect === 'bad'
      ? `This drug has a SIDE-EFFECT or RISK on the ${organ}.`
      : `This drug has no significant direct effect on the ${organ}.`;

    const prompt = `
You are a clinical pharmacology expert assisting a medical doctor.

A doctor is reviewing how the medicine "${medWithDosage}" specifically affects the patient's ${organ}.
${effectContext}

${langInstruction}

Please provide a highly structured, concise clinical summary formatted with bullet points:
- **Mechanism of Action**: How this drug affects the ${organ} specifically.
- **Clinical Presentation**: What signs or symptoms the patient might exhibit regarding this organ.
- **Monitoring & Precautions**: Key labs, vitals, or clinical signs to monitor for this organ.
- **Risk Assessment**: Clinical severity of the effect on this organ and when to intervene.

Keep the explanation clinical yet concise and easily scannable (under 150 words). Use standard medical terminology.
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });

    const explanation = completion.choices[0]?.message?.content?.trim() || '';
    return NextResponse.json({ explanation });
  } catch (err) {
    console.error('Organ detail error:', err);
    return NextResponse.json({ explanation: '' }, { status: 500 });
  }
}
