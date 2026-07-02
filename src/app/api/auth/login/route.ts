import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { verifyPassword, decrypt } from '@/lib/crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'nalam-dev-secret-CHANGE-IN-PRODUCTION';

/* ── Credential store (demo — in production this would be a DB lookup) ── */
const CREDENTIALS: Record<string, {
  password: string;
  role: 'patient' | 'clinician' | 'hdesk';
  staffId: string;
  name?: string;
  branch?: string;
  clinicianRole?: string;
}> = {
  'karthik@nalam.ai':  { password: '123', role: 'patient',   staffId: 'P001',              name: 'Karthik' },
  'monissha@nalam.ai': { password: '123', role: 'clinician',  staffId: 'dr_monissha', clinicianRole: 'specialist' },
  'dhanush@nalam.ai':  { password: '123', role: 'clinician',  staffId: 'dr_dhanush',  clinicianRole: 'emergency' },
  // Apollo Hospital doctors
  'arun@nalam.ai':     { password: '123', role: 'clinician',  staffId: 'dr_arun',     clinicianRole: 'specialist' },
  'kavitha@nalam.ai':  { password: '123', role: 'clinician',  staffId: 'dr_kavitha',  clinicianRole: 'specialist' },
  'suresh@nalam.ai':   { password: '123', role: 'clinician',  staffId: 'dr_suresh',   clinicianRole: 'specialist' },
  // Kauvery Hospital doctors
  'venkat@nalam.ai':   { password: '123', role: 'clinician',  staffId: 'dr_venkat',   clinicianRole: 'specialist' },
  'priya@nalam.ai':    { password: '123', role: 'clinician',  staffId: 'dr_priya',    clinicianRole: 'specialist' },
  'ramesh@nalam.ai':   { password: '123', role: 'clinician',  staffId: 'dr_ramesh',   clinicianRole: 'specialist' },
  // Govt Hospital doctors
  'anita@nalam.ai':    { password: '123', role: 'clinician',  staffId: 'dr_anita',    clinicianRole: 'specialist' },
  // Hospital desk logins
  'apollo@nalam.ai':   { password: '123', role: 'hdesk',      staffId: 'apollo@nalam.ai',  branch: 'Apollo Hospital' },
  'kauvery@nalam.ai':  { password: '123', role: 'hdesk',      staffId: 'kauvery@nalam.ai', branch: 'Kauvery Hospital' },
  'govt@nalam.ai':     { password: '123', role: 'hdesk',      staffId: 'govt@nalam.ai',    branch: 'Govt Hospital' },
};

export async function POST(request: Request) {
  try {
    const { username, password, hdeskStaffId } = await request.json();
    const uname = (username ?? '').toLowerCase().trim();
    const cred = CREDENTIALS[uname];
    
    let resolvedRole: 'patient' | 'clinician' | 'hdesk' | null = null;
    let resolvedStaffId = '';
    let branch = undefined;
    let clinicianRole = undefined;
    let patientName: string | null = null;

    if (cred && cred.password === password) {
      resolvedRole = cred.role;
      resolvedStaffId = cred.role === 'hdesk' ? (hdeskStaffId || cred.staffId) : cred.staffId;
      branch = cred.branch;
      clinicianRole = cred.clinicianRole;
      if (cred.role === 'patient' && (cred as any).name) patientName = (cred as any).name;
    } else {
      // Try querying Patient table by ID (username is now the patient ID)
      const patient = await prisma.patient.findUnique({ where: { id: uname } });
      if (patient && patient.password_hash && verifyPassword(password, patient.password_hash)) {
        resolvedRole = 'patient';
        resolvedStaffId = patient.id;
        patientName = decrypt(patient.name_enc);
      } else {
        // Try querying Doctor table by ID (username is now the doctor ID)
        const doctor = await prisma.doctor.findUnique({ where: { id: uname } });
        if (doctor && doctor.password_hash && verifyPassword(password, doctor.password_hash)) {
          resolvedRole = 'clinician';
          resolvedStaffId = doctor.id;
        }
      }
    }

    if (!resolvedRole) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign({
      sub: uname,
      role: resolvedRole,
      staffId: resolvedStaffId,
      ...(branch        ? { branch }              : {}),
      ...(clinicianRole ? { clinicianRole } : {}),
    }, JWT_SECRET, { expiresIn: '8h' });

    const res = NextResponse.json({
      success: true,
      role: resolvedRole,
      staffId: resolvedStaffId,
      branch: branch ?? null,
      clinicianRole: clinicianRole ?? null,
      patientName: patientName ?? null,
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
