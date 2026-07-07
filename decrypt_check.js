require('dotenv').config({ path: '.env.local' });
const { decrypt } = require('./src/lib/crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDecrypt() {
  const r = await prisma.intakeRequest.findUnique({ where: { id: 'cmrahlmpy000kwoisic3qkkaw' } });
  if (r.symptoms_text_enc) console.log('Symptoms:', decrypt(r.symptoms_text_enc));
  if (r.questionnaire_json_enc) console.log('Questions:', decrypt(r.questionnaire_json_enc));
}

checkDecrypt().catch(console.error).finally(() => prisma.$disconnect());
