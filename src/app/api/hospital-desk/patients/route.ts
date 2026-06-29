import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
import { requireRole } from '@/lib/auth';
import { hashPassword } from '@/lib/crypto';

type IntakeRecord = {
  date?: string;
  type?: string;
  provider?: string;
  department?: string;
  doctorName?: string;
  diagnosis?: string;
  notes?: string;
  labResults?: string;
  medications?: string;
  procedures?: string;
  followUpDate?: string;
};

const clean = (value: unknown) => String(value ?? '').trim();
const optionalEnc = (value: unknown) => {
  const text = clean(value);
  return text ? encrypt(text) : null;
};

function makePatientId(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'PT';
  return `${initials}${Date.now().toString().slice(-6)}`;
}

export async function POST(request: Request) {
  const auth = requireRole(request, ['hdesk']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const name = clean(body.name);
    const dob = clean(body.dob);
    const gender = clean(body.gender);
    const mobile = clean(body.mobile);
    const password = clean(body.password);
    const patientId = clean(body.id) || makePatientId(name);

    if (!name || !dob || !gender || !mobile) {
      return NextResponse.json({ error: 'name, dob, gender, and mobile are required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const loginEmail = name.toLowerCase().replace(/\s+/g, '') + '@nalam.ai';

    const existing = await prisma.patient.findUnique({ where: { id: patientId } });
    if (existing) {
      return NextResponse.json({ error: `Patient ID ${patientId} already exists` }, { status: 409 });
    }

    const records = Array.isArray(body.records) ? body.records as IntakeRecord[] : [];

    const created = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          id: patientId,
          login_email: loginEmail,
          password_hash: hashPassword(password),
          name_enc: encrypt(name),
          dob_enc: encrypt(dob),
          gender_enc: encrypt(gender),
          contact_enc: encrypt(clean(body.contact) || mobile),
          mobile_enc: encrypt(mobile),
          email_enc: optionalEnc(body.email),
          address_enc: optionalEnc(body.address),
          city_enc: optionalEnc(body.city),
          district_enc: optionalEnc(body.district || 'Chennai'),
          state_enc: optionalEnc(body.state || 'Tamil Nadu'),
          pincode_enc: optionalEnc(body.pincode),
          guardian_name_enc: optionalEnc(body.guardianName),
          emergency_name_enc: optionalEnc(body.emergencyName),
          emergency_relation_enc: optionalEnc(body.emergencyRelation),
          emergency_phone_enc: optionalEnc(body.emergencyPhone),
          occupation_enc: optionalEnc(body.occupation),
          marital_status_enc: optionalEnc(body.maritalStatus),
          preferred_language_enc: optionalEnc(body.preferredLanguage || 'Tamil'),
          insurance_provider_enc: optionalEnc(body.insuranceProvider),
          insurance_policy_enc: optionalEnc(body.insurancePolicy),
          aadhaar_last4_enc: optionalEnc(body.aadhaarLast4),
          blood_type_enc: encrypt(clean(body.bloodType) || 'Unknown'),
          allergies_enc: encrypt(clean(body.allergies) || 'None known'),
          chronic_conditions_enc: optionalEnc(body.chronicConditions),
          current_medications_enc: optionalEnc(body.currentMedications),
          past_surgeries_enc: optionalEnc(body.pastSurgeries),
          family_history_enc: optionalEnc(body.familyHistory),
          lifestyle_notes_enc: optionalEnc(body.lifestyleNotes),
          consent_emergency: Boolean(body.consentEmergency ?? true),
          consent_specialist: Boolean(body.consentSpecialist ?? true),
          consent_research: Boolean(body.consentResearch ?? false),
        },
      });

      const createdRecords = [];
      for (const record of records.filter(r => clean(r.diagnosis) || clean(r.notes) || clean(r.labResults))) {
        createdRecords.push(await tx.medicalRecord.create({
          data: {
            patient_id: patientId,
            date: clean(record.date) || new Date().toISOString().slice(0, 10),
            type_enc: encrypt(clean(record.type) || 'Initial Intake'),
            provider_enc: encrypt(clean(record.provider) || auth.session.branch || 'Hospital Desk'),
            department_enc: optionalEnc(record.department),
            doctor_name_enc: optionalEnc(record.doctorName),
            diagnosis_enc: encrypt(clean(record.diagnosis) || 'Initial registration'),
            notes_enc: optionalEnc(record.notes),
            lab_results_enc: optionalEnc(record.labResults),
            medications_enc: optionalEnc(record.medications),
            procedures_enc: optionalEnc(record.procedures),
            follow_up_date: clean(record.followUpDate) || null,
          },
        }));
      }

      return { patient, records: createdRecords };
    });

    return NextResponse.json({ success: true, patientId: created.patient.id, loginEmail, records: created.records.length });
  } catch (error: unknown) {
    console.error('Patient intake failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Patient intake failed' }, { status: 500 });
  }
}
