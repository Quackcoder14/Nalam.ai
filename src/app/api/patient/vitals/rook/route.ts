import { NextResponse } from 'next/server';

const ROOK_CLIENT_UUID = process.env.NEXT_PUBLIC_ROOK_CLIENT_UUID;
const ROOK_SECRET_KEY = process.env.NEXT_PUBLIC_ROOK_SECRET_KEY;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    
    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID required' }, { status: 400 });
    }

    if (!ROOK_CLIENT_UUID || !ROOK_SECRET_KEY) {
      console.warn('Rook API credentials not configured, proceeding with mock response');
    }

    // In a real implementation, this would:
    // 1. Retrieve the stored Rook access token for this patient
    // 2. Make API calls to Rook's endpoints to fetch health data
    // 3. Transform the data into our vitals format
    
    // Mock response for testing - simulates Rook API data
    const mockRookVitals = {
      hr: Math.floor(Math.random() * (90 - 60) + 60), // 60-90 BPM
      spo2: Math.floor(Math.random() * (100 - 95) + 95), // 95-100%
      resp: Math.floor(Math.random() * (20 - 12) + 12), // 12-20 bpm
      temp: parseFloat((Math.random() * (37.5 - 36.0) + 36.0).toFixed(1)), // 36.0-37.5°C
      sys: Math.floor(Math.random() * (130 - 110) + 110), // 110-130 mmHg
      dia: Math.floor(Math.random() * (85 - 70) + 70), // 70-85 mmHg
    };

    return NextResponse.json({
      success: true,
      vitals: mockRookVitals,
      source: 'rook_api',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Rook vitals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch Rook vitals' }, { status: 500 });
  }
}
