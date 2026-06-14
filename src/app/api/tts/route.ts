import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text');
  const lang = searchParams.get('lang') || 'en';

  if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });

  try {
    // tw-ob is the standard client parameter for Google Dictionary/Translate TTS that is more permissive
    const url = `https://translate.googleapis.com/translate_tts?client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      throw new Error(`TTS fetch failed: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error: any) {
    console.error('TTS proxy error:', error);
    return NextResponse.json({ error: 'Failed to proxy TTS' }, { status: 500 });
  }
}
