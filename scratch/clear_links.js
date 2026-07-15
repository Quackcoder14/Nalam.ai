const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.familyPatientLink.deleteMany({}).then(r => {
  console.log('Deleted', r.count, 'family links');
  return p.$disconnect();
}).catch(e => {
  console.error(e);
  process.exit(1);
});
