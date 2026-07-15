import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const auth = requireRole(request, ['family']);
  if (!auth.ok) return auth.response;
  
  const { patientId } = await params;
  const familyId = auth.session.staffId;

  // Verify the link exists
  const link = await prisma.familyPatientLink.findFirst({
    where: { family_id: familyId, patient_id: patientId },
  });

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  // Delete the link
  await prisma.familyPatientLink.delete({
    where: { id: link.id },
  });

  return NextResponse.json({ success: true });
}
