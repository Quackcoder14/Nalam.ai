import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { hashPassword, encrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'nalam-dev-secret-CHANGE-IN-PRODUCTION';

export async function POST(request: Request) {
  try {
    const { email, password, name, mobile } = await request.json();
    const normalizedEmail = (email ?? '').toLowerCase().trim();
    const cleanName = (name ?? '').trim();
    const cleanPassword = (password ?? '').trim();

    if (!normalizedEmail || !cleanPassword || !cleanName) {
      return NextResponse.json({ error: 'email, password, and name are required' }, { status: 400 });
    }
    if (cleanPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const existing = await prisma.familyAccount.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const account = await prisma.familyAccount.create({
      data: {
        email: normalizedEmail,
        password_hash: hashPassword(cleanPassword),
        name_enc: encrypt(cleanName),
        mobile_enc: mobile ? encrypt(mobile.trim()) : null,
      },
    });

    const token = jwt.sign(
      { sub: normalizedEmail, role: 'family', staffId: account.id, familyId: account.id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const res = NextResponse.json({
      success: true,
      role: 'family',
      staffId: account.id,
      familyId: account.id,
      familyName: cleanName,
      token,
    });

    res.cookies.set('nalam_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === 'production',
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
