import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';
import { requireRole, getSessionFromRequest } from '@/lib/auth';

const clean = (v: unknown) => String(v ?? '').trim();

/* ── GET /api/patient/files?patientId=... ─────────────────────────────────── */
export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

  // Patients can only see their own files
  if (session.role === 'patient' && session.staffId !== patientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await prisma.patientFile.findMany({
    where: { patient_id: patientId },
    orderBy: { created_at: 'desc' },
    select: {
      id: true, patient_id: true, file_type: true, source: true,
      uploaded_by: true, file_size_bytes: true, created_at: true,
      filename_enc: true,
      // Intentionally exclude file_data_enc here — fetched separately per file
    },
  });

  const files = rows.map(r => ({
    id: r.id,
    patientId: r.patient_id,
    filename: decrypt(r.filename_enc),
    fileType: r.file_type,
    source: r.source,
    uploadedBy: r.uploaded_by,
    fileSizeBytes: r.file_size_bytes,
    createdAt: r.created_at.toISOString(),
  }));

  return NextResponse.json({ files });
}

/* ── POST /api/patient/files (upload) ────────────────────────────────────── */
export async function POST(request: Request) {
  const auth = requireRole(request, ['patient', 'hdesk']);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const patientId = clean(body.patientId);
  const filename = clean(body.filename);
  const fileType = clean(body.fileType) || 'document';
  const fileData = clean(body.fileData); // base64
  const source = clean(body.source) || 'manual';

  if (!patientId || !filename || !fileData) {
    return NextResponse.json({ error: 'patientId, filename and fileData are required' }, { status: 400 });
  }

  // Patients can only upload to their own record
  if (auth.session.role === 'patient' && auth.session.staffId !== patientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fileSizeBytes = Math.round((fileData.length * 3) / 4);

  const file = await prisma.patientFile.create({
    data: {
      patient_id: patientId,
      filename_enc: encrypt(filename),
      file_type: fileType,
      file_data_enc: encrypt(fileData),
      source,
      uploaded_by: auth.session.staffId,
      file_size_bytes: fileSizeBytes,
    },
  });

  return NextResponse.json({ success: true, fileId: file.id });
}

/* ── DELETE /api/patient/files?id=... ────────────────────────────────────── */
export async function DELETE(request: Request) {
  const auth = requireRole(request, ['patient']);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const file = await prisma.patientFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Only the owning patient may delete
  if (file.patient_id !== auth.session.staffId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.patientFile.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
