import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const translateCache = new Map<string, any[]>();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'en';
    const patientId = searchParams.get('patientId')?.trim();
    const fast = searchParams.get('fast') === '1';
    const past = searchParams.get('past') === '1';

    let alerts = await prisma.clinicalAlert.findMany({
      where: {
        is_read: past ? true : false,
        ...(patientId ? { patient_id: patientId } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: past ? 50 : (patientId ? 50 : 20),
    });

    if (lang === 'ta' && !fast && alerts.length > 0) {
      // Use the IDs and updated_at to form a cache key
      const cacheKey = alerts.map(a => `${a.id}`).join(',');
      if (translateCache.has(cacheKey)) {
        alerts = translateCache.get(cacheKey)!;
      } else {
        const prompt = `Translate the 'title' and 'message' fields of the following JSON array of medical alerts into Tamil (தமிழ்). 
Keep the JSON structure exactly the same, including all keys. Only translate the VALUES of 'title' and 'message'.

JSON:
${JSON.stringify(alerts, null, 2)}`;

        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a medical translator. Always respond with raw valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
        });

        const raw = completion.choices[0]?.message?.content ?? '[]';
        try {
          const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
          alerts = JSON.parse(cleaned);
          translateCache.set(cacheKey, alerts);
        } catch (e) {
          console.error("Translation JSON parse failed", e);
        }
      }
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { patientId, severity, title, message } = body;

    if (!patientId || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const alert = await prisma.clinicalAlert.create({
      data: {
        patient_id: patientId,
        severity: severity || 'info',
        title,
        message,
      }
    });

    return NextResponse.json({ success: true, alert });
  } catch (error) {
    console.error('Failed to create alert:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const alert = await prisma.clinicalAlert.update({
      where: { id },
      data: { is_read: true }
    });
    return NextResponse.json({ success: true, alert });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}
