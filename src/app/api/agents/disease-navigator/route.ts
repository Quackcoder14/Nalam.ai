import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const langLabel = (lang: string) => lang === 'ta' ? 'Tamil (தமிழ்)' : 'English';

export async function POST(request: Request) {
  try {
    const { disease, patient, records, lang = 'en' } = await request.json();

    if (!disease) {
      return NextResponse.json({ error: 'disease is required.' }, { status: 400 });
    }

    const patientContext = patient ? `Patient Info:
Name: ${patient.name}, Age/DOB: ${patient.dob}, Gender: ${patient.gender}
Medical History:
${records?.map((r: any) => `- ${r.date}: ${r.diagnosis || r.type} (Provider: ${r.provider})`).join('\n')}` : `Generalized Mode (No specific patient context provided). Please provide generalized clinical protocols and symptoms for a typical patient in the Tamil Nadu demographic.`;

    const systemPrompt = `You are an expert Clinical Decision Support AI for the Tamil Nadu region in India.
Your task is to analyze the disease and provide highly detailed, pointwise clinical guidelines.

${patientContext}

Disease to Analyze: "${disease}"

Output EXACTLY three fields in JSON format, where each field is a SINGLE MARKDOWN STRING (do not use arrays):
1. "symptoms": Describe the common symptoms for this disease. Provide EXACTLY 4 to 5 concise bullet points. If patient context is provided, tailor them to how this patient might experience them.
2. "protocol": Detail the clinical protocol to follow, including vital sign anomalies to watch for and immediate treatment methods. Provide EXACTLY 4 to 5 concise bullet points.
3. "medicine": Recommend the standard medication(s) and exact dosage for treating this disease. Provide EXACTLY 4 to 5 concise bullet points. If patient context is provided, consider their existing conditions.

IMPORTANT CONSTRAINTS:
- The output MUST be entirely written in ${langLabel(lang)}. Do not mix languages.
- Format the JSON strictly as requested.
- Make the output highly concise, consisting ONLY of 4 to 5 main key points per section using standard markdown bullets like "- " or "• ". Do not add long introductory or concluding paragraphs.
- If writing in Tamil, transliterate medical drug names clearly if no standard Tamil equivalent exists.

Return ONLY a raw JSON object with keys "symptoms", "protocol", and "medicine". No markdown fences.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(raw);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Disease Navigator API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate protocol' }, { status: 500 });
  }
}
