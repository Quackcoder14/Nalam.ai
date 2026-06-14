const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.clinicalAlert.deleteMany();
  console.log('Cleared all clinical alerts');
}

main().catch(console.error).finally(() => prisma.$disconnect());
