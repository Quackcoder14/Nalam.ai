// API Route: POST /api/agents/place-info
// Uses Groq to look up a hospital or pharmacy's phone number and opening hours.
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { name, address, type } = await req.json();
    if (!name) return NextResponse.json({ phone: null, hours: null });

    const prompt = `You are a medical facility directory assistant for Tamil Nadu, India.
For the following ${type === 'hospital' ? 'hospital' : 'pharmacy'}, provide ONLY:
1. Phone number (Indian format, e.g. 044-XXXXXXXX or +91-XXXXXXXXXX)
2. Opening hours (e.g. "Open 24 hours" or "Mon-Sat: 8AM-8PM")

Facility: ${name}
Address: ${address}

Respond in this EXACT JSON format with no extra text:
{"phone":"<number or null>","hours":"<hours or null>"}

If you are not confident about specific details, return null for that field. Do not guess.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 80,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '{}';
    // Extract JSON from response
    const jsonMatch = content.match(/\{[^}]+\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return NextResponse.json({
      phone: data.phone || null,
      hours: data.hours || null,
    });
  } catch (err: any) {
    console.error('[place-info]', err.message);
    return NextResponse.json({ phone: null, hours: null });
  }
}
