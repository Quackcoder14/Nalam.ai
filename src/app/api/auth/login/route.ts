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
  // More patients
  'priya@nalam.ai':    { password: '123', role: 'patient',   staffId: 'P002',              name: 'Priya Sharma' },
  'ramesh@nalam.ai':   { password: '123', role: 'patient',   staffId: 'P003',              name: 'Ramesh Kumar' },
  'anitha@nalam.ai':   { password: '123', role: 'patient',   staffId: 'P004',              name: 'Anitha Devi' },
  'suresh@nalam.ai':   { password: '123', role: 'patient',   staffId: 'P005',              name: 'Suresh Babu' },
  'divya@nalam.ai':    { password: '123', role: 'patient',   staffId: 'P006',              name: 'Divya Lakshmi' },
  'vijay@nalam.ai':    { password: '123', role: 'patient',   staffId: 'P007',              name: 'Vijay Kumar' },
  'kavitha@nalam.ai':  { password: '123', role: 'patient',   staffId: 'P008',              name: 'Kavitha Rajan' },
  'arun@nalam.ai':     { password: '123', role: 'patient',   staffId: 'P009',              name: 'Arun Prakash' },
  'meena@nalam.ai':    { password: '123', role: 'patient',   staffId: 'P010',              name: 'Meena Sundaram' },
  'monissha@nalam.ai': { password: '123', role: 'clinician',  staffId: 'dr_monissha', clinicianRole: 'specialist', name: 'Dr. Monissha' },
  'dhanush@nalam.ai':  { password: '123', role: 'clinician',  staffId: 'dr_dhanush',  clinicianRole: 'emergency', name: 'Dr. Dhanush' },
  // Apollo Hospital doctors
  'dr.arun@nalam.ai':     { password: '123', role: 'clinician',  staffId: 'dr_arun',     clinicianRole: 'specialist', name: 'Dr. Arun' },
  'dr.kavitha@nalam.ai':  { password: '123', role: 'clinician',  staffId: 'dr_kavitha',  clinicianRole: 'specialist', name: 'Dr. Kavitha' },
  'dr.suresh@nalam.ai':   { password: '123', role: 'clinician',  staffId: 'dr_suresh',   clinicianRole: 'specialist', name: 'Dr. Suresh' },
  // Kauvery Hospital doctors
  'dr.venkat@nalam.ai':   { password: '123', role: 'clinician',  staffId: 'dr_venkat',   clinicianRole: 'specialist', name: 'Dr. Venkat' },
  'dr.priya@nalam.ai':    { password: '123', role: 'clinician',  staffId: 'dr_priya',    clinicianRole: 'specialist', name: 'Dr. Priya' },
  'dr.ramesh@nalam.ai':   { password: '123', role: 'clinician',  staffId: 'dr_ramesh',   clinicianRole: 'specialist', name: 'Dr. Ramesh' },
  // Govt Hospital doctors
  'dr.anita@nalam.ai':    { password: '123', role: 'clinician',  staffId: 'dr_anita',    clinicianRole: 'specialist', name: 'Dr. Anita' },
  // Hospital desk logins (username + staff ID + password)
  'apollo@nalam.ai':   { password: '123', role: 'hdesk', staffId: '', branch: 'Apollo Hospital', name: 'Apollo Hospital Staff' },
  'kauvery@nalam.ai':  { password: '123', role: 'hdesk', staffId: '', branch: 'Kauvery Hospital', name: 'Kauvery Hospital Staff' },
  'govt@nalam.ai':     { password: '123', role: 'hdesk', staffId: '', branch: 'Govt Hospital', name: 'Govt Hospital Staff' },
};

// Staff IDs allowed for each hospital username
const HDESK_STAFF_IDS: Record<string, string[]> = {
  'apollo@nalam.ai': ['APOLLO-001', 'APOLLO-002'],
  'kauvery@nalam.ai': ['KAUVERY-001', 'KAUVERY-002'],
  'govt@nalam.ai': ['GOVT-001', 'GOVT-002'],
};

export async function POST(request: Request) {
  try {
    const { username, password, hdeskStaffId } = await request.json();
    const uname = (username ?? '').toLowerCase().trim();
    const cred = CREDENTIALS[uname];
    
    let resolvedRole: 'patient' | 'clinician' | 'hdesk' | 'family' | null = null;
    let resolvedStaffId = '';
    let branch = undefined;
    let clinicianRole = undefined;
    let patientName: string | null = null;
    let familyName: string | null = null;

    // Handle hospital desk login with username, staff ID, and password
    if (hdeskStaffId && password) {
      const hdeskStaffIdUpper = hdeskStaffId.toUpperCase().trim();
      
      // Check if the username exists in credentials and is a hospital desk login
      if (CREDENTIALS[uname] && CREDENTIALS[uname].role === 'hdesk') {
        // Validate password and check if staff ID is allowed for this username
        if (CREDENTIALS[uname].password === password) {
          const allowedStaffIds = HDESK_STAFF_IDS[uname] || [];
          if (allowedStaffIds.includes(hdeskStaffIdUpper)) {
            resolvedRole = 'hdesk';
            resolvedStaffId = hdeskStaffIdUpper;
            branch = CREDENTIALS[uname].branch;
            patientName = CREDENTIALS[uname].name || null;
          }
        }
      }
    } else if (cred && cred.password === password) {
      resolvedRole = cred.role;
      resolvedStaffId = cred.staffId;
      branch = cred.branch;
      clinicianRole = cred.clinicianRole;
      if (cred.role === 'patient' && (cred as any).name) patientName = (cred as any).name;
      if (cred.role === 'clinician' && (cred as any).name) patientName = (cred as any).name;
      if (cred.role === 'hdesk' && (cred as any).name) patientName = (cred as any).name || null;
    } else {
      // Try querying FamilyAccount table by email
      const family = await prisma.familyAccount.findUnique({ where: { email: uname } });
      if (family && family.password_hash && verifyPassword(password, family.password_hash)) {
        resolvedRole = 'family';
        resolvedStaffId = family.id;
        familyName = decrypt(family.name_enc);
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
            patientName = decrypt(doctor.full_name_enc);
          }
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
      ...(resolvedRole === 'family' ? { familyId: resolvedStaffId } : {}),
      ...(branch        ? { branch }              : {}),
      ...(clinicianRole ? { clinicianRole } : {}),
    }, JWT_SECRET, { expiresIn: '30d' });

    const res = NextResponse.json({
      success: true,
      role: resolvedRole,
      staffId: resolvedStaffId,
      ...(resolvedRole === 'family' ? { familyId: resolvedStaffId } : {}),
      branch: branch ?? null,
      clinicianRole: clinicianRole ?? null,
      patientName: patientName ?? null,
      familyName: familyName ?? null,
      token, // also return the raw JWT so clients can use Bearer auth as fallback
    });

    // Use Next.js cookies API — reliably sets HttpOnly cookies in App Router
    res.cookies.set('nalam_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      secure: process.env.NODE_ENV === 'production',
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
