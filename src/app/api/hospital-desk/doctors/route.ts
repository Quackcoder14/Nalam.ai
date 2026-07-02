import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt, encrypt, hashPassword } from '@/lib/crypto';
import { requireRole } from '@/lib/auth';
import { DOCTOR_SCHEDULES, getNextSlots } from '@/lib/doctors';
import type { Doctor } from '@prisma/client';

const clean = (value: unknown) => String(value ?? '').trim();
const optionalEnc = (value: unknown) => {
  const text = clean(value);
  return text ? encrypt(text) : null;
};

function slugDoctor(name: string, registrationNumber: string) {
  const slug = name.toLowerCase().replace(/^dr\.?\s*/i, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `dr_${slug || 'doctor'}_${registrationNumber.replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase()}`;
}

function mapDoctor(row: Doctor) {
  const days = row.available_days_json ? JSON.parse(row.available_days_json) : (DOCTOR_SCHEDULES[row.id] || []);
  return {
    id: row.id,
    name: decrypt(row.full_name_enc),
    specialty: row.specialty,
    department: row.department,
    hospital: row.hospital,
    designation: row.designation,
    registrationNumber: row.registration_number,
    registrationCouncil: row.registration_council,
    registrationYear: row.registration_year,
    qualification: decrypt(row.qualification_enc),
    experience: row.experience_years ? `${row.experience_years} years` : '',
    languages: row.languages_json ? JSON.parse(row.languages_json) : ['Tamil', 'English'],
    slots: days,
    timeSlots: row.time_slots_json ? JSON.parse(row.time_slots_json) : [],
    status: row.status,
  };
}

export async function GET(request: Request) {
  try {
    const auth = requireRole(request, ['hdesk', 'clinician', 'patient']);
    if (!auth.ok) return auth.response;

    // Filter by hospital if session has hospital info (for hospital desk isolation)
    const hospital = auth.session.branch;
    const whereClause = hospital ? { hospital, status: 'active' } : { status: 'active' };

    const rows = await prisma.doctor.findMany({
      where: whereClause,
      orderBy: [{ hospital: 'asc' }, { specialty: 'asc' }, { created_at: 'desc' }],
    });
    return NextResponse.json({ doctors: rows.map(mapDoctor) });
  } catch (error: unknown) {
    console.error('Doctor roster failed:', error);
    return NextResponse.json({ doctors: [] });
  }
}

export async function POST(request: Request) {
  const auth = requireRole(request, ['hdesk']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const fullName = clean(body.fullName);
    const registrationNumber = clean(body.registrationNumber);
    const password = clean(body.password);
    const registrationCouncil = clean(body.registrationCouncil || 'Tamil Nadu Medical Council');
    const qualification = clean(body.qualification);
    const specialty = clean(body.specialty);
    const department = clean(body.department || specialty);
    const hospital = clean(body.hospital || auth.session.branch || 'Nalam Partner Hospital');

    if (!fullName || !registrationNumber || !registrationCouncil || !qualification || !specialty || !hospital) {
      return NextResponse.json({ error: 'fullName, registrationNumber, registrationCouncil, qualification, specialty, and hospital are required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const id = clean(body.id) || slugDoctor(fullName, registrationNumber);
    const loginEmail = fullName.toLowerCase().replace(/\s+/g, '') + '@nalam.ai';
    const availableDays = Array.isArray(body.availableDays) ? body.availableDays : [];
    const languages = Array.isArray(body.languages) ? body.languages : ['Tamil', 'English'];
    const modes = Array.isArray(body.consultationModes) ? body.consultationModes : ['In-person'];
    const timeSlots = Array.isArray(body.timeSlots) ? body.timeSlots : [];

    const doctor = await prisma.doctor.create({
      data: {
        id,
        password_hash: hashPassword(password),
        full_name_enc: encrypt(fullName),
        gender_enc: optionalEnc(body.gender),
        dob_enc: optionalEnc(body.dob),
        mobile_enc: optionalEnc(body.mobile),
        email_enc: optionalEnc(body.email),
        registration_number: registrationNumber,
        registration_council: registrationCouncil,
        registration_year: clean(body.registrationYear) || null,
        qualification_enc: encrypt(qualification),
        specialty,
        department,
        designation: clean(body.designation) || null,
        hospital,
        experience_years: body.experienceYears === '' || body.experienceYears == null ? null : Number(body.experienceYears),
        languages_json: JSON.stringify(languages),
        consultation_modes_json: JSON.stringify(modes),
        available_days_json: JSON.stringify(availableDays),
        time_slots_json: JSON.stringify(timeSlots),
        room_number_enc: optionalEnc(body.roomNumber),
        address_enc: optionalEnc(body.address),
        district: clean(body.district || 'Chennai') || null,
        state: clean(body.state || 'Tamil Nadu') || 'Tamil Nadu',
        pincode: clean(body.pincode) || null,
        status: clean(body.status || 'active') || 'active',
      },
    });

    return NextResponse.json({ success: true, doctor: mapDoctor(doctor), loginEmail });
  } catch (error: unknown) {
    console.error('Doctor registration failed:', error);
    const message = error instanceof Error ? error.message : 'Doctor registration failed';
    const status = message.includes('Unique constraint') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
