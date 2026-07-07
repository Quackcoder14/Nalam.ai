const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const result = await prisma.intakeRequest.updateMany({ 
    where: { status: 'routed' }, 
    data: { routed_doctor_id: 'dr_arun' } 
  }); 
  console.log(`Fixed ${result.count} misrouted intakes.`); 
}

fix().catch(console.error).finally(() => prisma.$disconnect());
