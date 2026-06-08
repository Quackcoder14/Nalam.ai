import { NextResponse } from 'next/server';

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8005';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${ML_URL}/xai/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (error: any) {
    // ML offline — return empty explanations
    return NextResponse.json({ explanations: [], top_driver: null, offline: true });
  }
}
