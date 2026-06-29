const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres.jmxfwxafjzfvgvuyuzhw:nalam%4014dbnew@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?connect_timeout=300' });
  await client.connect();
  const schemaName = 'test_manual_shadow_' + Date.now();
  
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    await client.query(`CREATE SCHEMA "${schemaName}";`);
    await client.query(`SET search_path TO "${schemaName}";`);
    
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    const dirs = fs.readdirSync(migrationsDir).filter(d => fs.statSync(path.join(migrationsDir, d)).isDirectory());
    dirs.sort(); 
    
    for (const dir of dirs) {
      const sqlPath = path.join(migrationsDir, dir, 'migration.sql');
      if (fs.existsSync(sqlPath)) {
        console.log('Applying:', dir);
        let sql = fs.readFileSync(sqlPath, 'utf8');
        try {
            await client.query(sql);
            console.log('  -> Success');
        } catch (e) {
            console.log('  -> Failed:', e.message);
            break;
        }
      }
    }
    
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${schemaName}' AND table_name = 'appointments';
    `);
    console.log('Appointments table exists:', res.rows.length > 0);
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    await client.end();
  }
}

run();
