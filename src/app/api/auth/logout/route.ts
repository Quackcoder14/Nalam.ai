import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('nalam_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  // Note: localStorage clearing must be done on the client side
  // This is handled by the client calling this API and then clearing localStorage
  return res;
}
