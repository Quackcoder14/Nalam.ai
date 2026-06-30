import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { getSessionFromRequest } from '@/lib/auth';

/* ── GET /api/patient/files/[id] — returns full file data for viewing ─────── */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const file = await prisma.patientFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Allow: patient owner OR clinician/hdesk that has been OTP-verified
  if (session.role === 'patient' && session.staffId !== file.patient_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (session.role === 'clinician' || session.role === 'hdesk') {
    // Check if there is a valid, used OTP for this patient by this requestor
    const { searchParams } = new URL(request.url);
    const otpToken = searchParams.get('otpToken');
    if (!otpToken) return NextResponse.json({ error: 'OTP token required' }, { status: 403 });

    const otp = await prisma.recordsOtp.findUnique({ where: { id: otpToken } });
    if (!otp || otp.patient_id !== file.patient_id || !otp.used || otp.expires_at < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired OTP session' }, { status: 403 });
    }
  }

  return NextResponse.json({
    id: file.id,
    filename: decrypt(file.filename_enc),
    fileType: file.file_type,
    fileData: decrypt(file.file_data_enc),
    source: file.source,
    uploadedBy: file.uploaded_by,
    fileSizeBytes: file.file_size_bytes,
    createdAt: file.created_at.toISOString(),
  });
}
