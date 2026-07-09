import { NextResponse } from 'next/server';

const ROOK_CLIENT_UUID = process.env.NEXT_PUBLIC_ROOK_CLIENT_UUID;
const ROOK_SECRET_KEY  = process.env.NEXT_PUBLIC_ROOK_SECRET_KEY;
const ROOK_BASE        = 'https://api.rook-connect.review';

export async function POST(request: Request) {
  try {
    const { patientId, dataSource, baseUrl } = await request.json();
    
    if (!ROOK_CLIENT_UUID || !ROOK_SECRET_KEY) {
      return NextResponse.json({ error: 'Rook API credentials not configured' }, { status: 500 });
    }

    if (!patientId || !dataSource) {
      return NextResponse.json({ error: 'patientId and dataSource are required' }, { status: 400 });
    }

    // Generate Basic Auth token
    const token = Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString('base64');
    
    // IMPORTANT: Rook appends /client_uuid/<uuid>/user_id/<id> to the redirect_url.
    // So our callback page must be at /rook-callback, not /dashboard directly.
    // Final URL will be: {baseUrl}/rook-callback/client_uuid/<uuid>/user_id/<patientId>
    const redirectUrl = `${baseUrl}/rook-callback`;

    const url = new URL(
      `${ROOK_BASE}/api/v1/user_id/${patientId}/data_source/${dataSource}/authorizer`
    );
    url.searchParams.append('redirect_url', redirectUrl);

    const rookResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${token}`,
        'Accept':        'application/json',
        'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }
    });

    if (!rookResponse.ok) {
      const errorText = await rookResponse.text();
      console.error('Rook API error:', rookResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to generate authorization URL from Rook', detail: errorText },
        { status: rookResponse.status }
      );
    }

    const data = await rookResponse.json();
    
    // If already authorized, data.authorized === true and no authorization_url
    if (data.authorized) {
      return NextResponse.json({
        success:    true,
        authorized: true,
        message:    'Device already connected',
        authUrl:    null,
        patientId,
      });
    }

    if (!data.authorization_url) {
      console.error('Rook API response:', data);
      return NextResponse.json({ error: 'No authorization URL returned from Rook' }, { status: 500 });
    }

    return NextResponse.json({
      success:    true,
      authorized: false,
      message:    'Rook OAuth connection initiated',
      authUrl:    data.authorization_url,
      patientId,
    });
  } catch (error) {
    console.error('Rook connect error:', error);
    return NextResponse.json({ error: 'Failed to initiate Rook connection' }, { status: 500 });
  }
}

// GET: Check if a patient is already authorized for a data source
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId  = searchParams.get('patientId');
    const dataSource = searchParams.get('dataSource');

    if (!ROOK_CLIENT_UUID || !ROOK_SECRET_KEY || !patientId) {
      return NextResponse.json({ authorized: false });
    }

    const token = Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString('base64');
    const res = await fetch(
      `${ROOK_BASE}/api/v2/user_id/${patientId}/data_sources/authorized`,
      {
        headers: {
          'Authorization': `Basic ${token}`,
          'Accept':        'application/json',
          'User-Agent':    'Mozilla/5.0',
        }
      }
    );

    if (!res.ok) return NextResponse.json({ authorized: false });
    const data = await res.json();
    
    // data.data_sources is an array of { data_source, authorized, image }
    if (dataSource && data.data_sources) {
      const found = data.data_sources.find(
        (s: any) => s.data_source?.toLowerCase() === dataSource.toLowerCase()
      );
      return NextResponse.json({ authorized: found?.authorized ?? false, sources: data.data_sources });
    }

    const anyAuthorized = data.data_sources?.some((s: any) => s.authorized) ?? false;
    return NextResponse.json({ authorized: anyAuthorized, sources: data.data_sources });
  } catch {
    return NextResponse.json({ authorized: false });
  }
}
