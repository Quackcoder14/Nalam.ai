const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  // Clear ALL pending intakes older than 5 minutes (stale ones from failed submissions)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const stale = await prisma.intakeRequest.findMany({
    where: { status: 'pending', created_at: { lt: fiveMinAgo } }
  });
  console.log(`Found ${stale.length} stale pending intakes.`);
  
  if (stale.length > 0) {
    const result = await prisma.intakeRequest.deleteMany({
      where: { id: { in: stale.map(r => r.id) } }
    });
    console.log(`Deleted ${result.count} stale pending intakes.`);
  }

  // Also delete any submitted intakes older than 24h (already viewed)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oldSubmitted = await prisma.intakeRequest.deleteMany({
    where: { status: 'submitted', updated_at: { lt: oneDayAgo } }
  });
  console.log(`Deleted ${oldSubmitted.count} old submitted intakes.`);

  const all = await prisma.intakeRequest.findMany();
  console.log('Remaining intakes:', all.map(r => ({ id: r.id, status: r.status, patient_id: r.patient_id })));
}

clean().catch(console.error).finally(() => prisma.$disconnect());
