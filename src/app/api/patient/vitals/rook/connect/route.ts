import { NextResponse } from 'next/server';

const ROOK_CLIENT_UUID = process.env.NEXT_PUBLIC_ROOK_CLIENT_UUID;
const ROOK_SECRET_KEY = process.env.NEXT_PUBLIC_ROOK_SECRET_KEY;

export async function POST(request: Request) {
  try {
    const { patientId, dataSource, redirectUrl } = await request.json();
    
    if (!ROOK_CLIENT_UUID || !ROOK_SECRET_KEY) {
      return NextResponse.json({ error: 'Rook API credentials not configured' }, { status: 500 });
    }

    if (!patientId || !dataSource) {
      return NextResponse.json({ error: 'patientId and dataSource are required' }, { status: 400 });
    }

    // Generate Basic Auth token
    const token = Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString('base64');
    
    // Rook API sandbox URL
    const url = new URL(`https://api.rook-connect.review/api/v1/user_id/${patientId}/data_source/${dataSource}/authorizer`);
    if (redirectUrl) {
      url.searchParams.append('redirect_url', redirectUrl);
    }

    const rookResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!rookResponse.ok) {
      const errorText = await rookResponse.text();
      console.error('Rook API error:', rookResponse.status, errorText);
      return NextResponse.json({ error: 'Failed to generate authorization URL from Rook' }, { status: rookResponse.status });
    }

    const data = await rookResponse.json();
    
    // The response typically contains { authorization_url: "..." }
    if (!data.authorization_url) {
      console.error('Rook API response missing authorization_url:', data);
      return NextResponse.json({ error: 'Invalid response from Rook API' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Rook OAuth connection initiated',
      authUrl: data.authorization_url, 
      patientId
    });
  } catch (error) {
    console.error('Rook connect error:', error);
    return NextResponse.json({ error: 'Failed to initiate Rook connection' }, { status: 500 });
  }
}
