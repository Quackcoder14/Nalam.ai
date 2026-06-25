import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nalam-dev-secret-CHANGE-IN-PRODUCTION';

/* ── Credential store (demo — in production this would be a DB lookup) ── */
const CREDENTIALS: Record<string, {
  password: string;
  role: 'patient' | 'clinician' | 'hdesk';
  staffId: string;
  branch?: string;
  clinicianRole?: string;
}> = {
  'karthik@nalam.ai':  { password: '123', role: 'patient',   staffId: 'P001' },
  'monissha@nalam.ai': { password: '123', role: 'clinician',  staffId: 'dr_monissha', clinicianRole: 'specialist' },
  'dhanush@nalam.ai':  { password: '123', role: 'clinician',  staffId: 'dr_dhanush',  clinicianRole: 'emergency' },
  'apollo@nalam.ai':   { password: '123', role: 'hdesk',      staffId: 'apollo@nalam.ai',  branch: 'Apollo Hospitals' },
  'fortis@nalam.ai':   { password: '123', role: 'hdesk',      staffId: 'fortis@nalam.ai',  branch: 'Fortis Healthcare' },
  'manipal@nalam.ai':  { password: '123', role: 'hdesk',      staffId: 'manipal@nalam.ai', branch: 'Manipal Hospitals' },
};

export async function POST(request: Request) {
  try {
    const { username, password, hdeskStaffId } = await request.json();
    const uname = (username ?? '').toLowerCase().trim();
    const cred = CREDENTIALS[uname];

    if (!cred || cred.password !== password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const resolvedStaffId = cred.role === 'hdesk' ? (hdeskStaffId || cred.staffId) : cred.staffId;

    const token = jwt.sign({
      sub: uname,
      role: cred.role,
      staffId: resolvedStaffId,
      ...(cred.branch        ? { branch: cred.branch }              : {}),
      ...(cred.clinicianRole ? { clinicianRole: cred.clinicianRole } : {}),
    }, JWT_SECRET, { expiresIn: '8h' });

    const res = NextResponse.json({
      success: true,
      role: cred.role,
      staffId: resolvedStaffId,
      branch: cred.branch ?? null,
      clinicianRole: cred.clinicianRole ?? null,
      token, // also return the raw JWT so clients can use Bearer auth as fallback
    });

    // Use Next.js cookies API — reliably sets HttpOnly cookies in App Router
    res.cookies.set('nalam_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
      secure: process.env.NODE_ENV === 'production',
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
