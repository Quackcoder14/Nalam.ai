import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/* ── GET /api/patient/profile ─────────────────────────────────────── */
export async function GET(request: Request) {
  const auth = requireRole(request, ['patient']);
  if (!auth.ok) return auth.response;
  const patientId = auth.session.staffId;

  const row = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!row) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

  const safe = (enc: string | null | undefined) => {
    if (!enc) return '';
    try { return decrypt(enc); } catch { return ''; }
  };

  return NextResponse.json({
    profile: {
      name:               safe(row.name_enc),
      dob:                safe(row.dob_enc),
      gender:             safe(row.gender_enc),
      mobile:             safe(row.mobile_enc),
      email:              safe(row.email_enc),
      address:            safe(row.address_enc),
      city:               safe(row.city_enc),
      district:           safe(row.district_enc),
      state:              safe(row.state_enc),
      pincode:            safe(row.pincode_enc),
      guardian_name:      safe(row.guardian_name_enc),
      emergency_name:     safe(row.emergency_name_enc),
      emergency_relation: safe(row.emergency_relation_enc),
      emergency_phone:    safe(row.emergency_phone_enc),
      occupation:         safe(row.occupation_enc),
      marital_status:     safe(row.marital_status_enc),
      blood_type:         safe(row.blood_type_enc),
      allergies:          safe(row.allergies_enc),
      chronic_conditions: safe(row.chronic_conditions_enc),
      current_medications:safe(row.current_medications_enc),
      past_surgeries:     safe(row.past_surgeries_enc),
      family_history:     safe(row.family_history_enc),
      insurance_provider: safe(row.insurance_provider_enc),
      insurance_policy:   safe(row.insurance_policy_enc),
    }
  });
}

/* ── PATCH /api/patient/profile ────────────────────────────────────── */
export async function PATCH(request: Request) {
  const auth = requireRole(request, ['patient']);
  if (!auth.ok) return auth.response;
  const patientId = auth.session.staffId;

  const body = await request.json();

  const enc = (v: string | undefined) => (v !== undefined && v !== '') ? encrypt(v.trim()) : undefined;
  const encOrNull = (v: string | undefined) => v !== undefined ? (v.trim() ? encrypt(v.trim()) : null) : undefined;

  const data: Record<string, any> = {};
  if (body.name               !== undefined) data.name_enc               = encrypt((body.name ?? '').trim());
  if (body.dob                !== undefined) data.dob_enc                = encrypt((body.dob ?? '').trim());
  if (body.gender             !== undefined) data.gender_enc             = encrypt((body.gender ?? '').trim());
  if (body.mobile             !== undefined) data.mobile_enc             = encOrNull(body.mobile);
  if (body.email              !== undefined) data.email_enc              = encOrNull(body.email);
  if (body.address            !== undefined) data.address_enc            = encOrNull(body.address);
  if (body.city               !== undefined) data.city_enc               = encOrNull(body.city);
  if (body.district           !== undefined) data.district_enc           = encOrNull(body.district);
  if (body.state              !== undefined) data.state_enc              = encOrNull(body.state);
  if (body.pincode            !== undefined) data.pincode_enc            = encOrNull(body.pincode);
  if (body.guardian_name      !== undefined) data.guardian_name_enc      = encOrNull(body.guardian_name);
  if (body.emergency_name     !== undefined) data.emergency_name_enc     = encOrNull(body.emergency_name);
  if (body.emergency_relation !== undefined) data.emergency_relation_enc = encOrNull(body.emergency_relation);
  if (body.emergency_phone    !== undefined) data.emergency_phone_enc    = encOrNull(body.emergency_phone);
  if (body.occupation         !== undefined) data.occupation_enc         = encOrNull(body.occupation);
  if (body.marital_status     !== undefined) data.marital_status_enc     = encOrNull(body.marital_status);
  if (body.blood_type         !== undefined) data.blood_type_enc         = encrypt((body.blood_type ?? '').trim());
  if (body.allergies          !== undefined) data.allergies_enc          = encrypt((body.allergies ?? '').trim());
  if (body.chronic_conditions !== undefined) data.chronic_conditions_enc = encOrNull(body.chronic_conditions);
  if (body.current_medications!== undefined) data.current_medications_enc= encOrNull(body.current_medications);
  if (body.past_surgeries     !== undefined) data.past_surgeries_enc     = encOrNull(body.past_surgeries);
  if (body.family_history     !== undefined) data.family_history_enc     = encOrNull(body.family_history);
  if (body.insurance_provider !== undefined) data.insurance_provider_enc = encOrNull(body.insurance_provider);
  if (body.insurance_policy   !== undefined) data.insurance_policy_enc   = encOrNull(body.insurance_policy);

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  await prisma.patient.update({ where: { id: patientId }, data });
  return NextResponse.json({ success: true });
}
