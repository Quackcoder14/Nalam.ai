import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get('audio') as File;
    const lang = formData.get('lang') as string || 'en';

    if (!audio) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // For now, return a placeholder response
    // In production, this would call a speech-to-text service like OpenAI Whisper, Google Speech-to-Text, etc.
    // For now, we'll just return a mock response since we don't have a speech-to-text service configured
    
    return NextResponse.json({ 
      text: '[Voice transcription not configured - speech-to-text service needed]',
      error: 'Speech-to-text service not configured'
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
