const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const r = await prisma.intakeRequest.findMany({where: {status: 'routed'}, orderBy: {updated_at: 'desc'}, take: 1});
  console.log('DB Record:', r[0]);
}

check().catch(console.error).finally(() => prisma.$disconnect());
