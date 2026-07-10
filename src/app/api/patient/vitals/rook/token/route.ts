import { NextResponse } from 'next/server';

export async function GET() {
  const clientUuid = process.env.NEXT_PUBLIC_ROOK_CLIENT_UUID;
  const secretKey  = process.env.NEXT_PUBLIC_ROOK_SECRET_KEY;
  
  if (!clientUuid || !secretKey) {
    return NextResponse.json({ 
      error: 'Rook credentials not configured on server', 
      details: 'Missing NEXT_PUBLIC_ROOK_CLIENT_UUID or NEXT_PUBLIC_ROOK_SECRET_KEY in environment variables (check Vercel settings)'
    }, { status: 500 });
  }

  const token = Buffer.from(`${clientUuid}:${secretKey}`).toString('base64');
  
  return NextResponse.json({ token });
}
