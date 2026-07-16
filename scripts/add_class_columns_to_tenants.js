const { centralPool, getTenantPool } = require('../src/config/tenantDb');

async function migrate() {
  const client = await centralPool.connect();
  try {
    const res = await client.query("SELECT id, name, database_name FROM tenant WHERE is_active = TRUE ORDER BY created_at");
    const tenants = res.rows;
    console.log(`Found ${tenants.length} tenants`);
    let fixed = 0;
    for (const t of tenants) {
      console.log(`\nProcessing tenant ${t.name} (${t.id}) -> DB: ${t.database_name}`);
      const pool = getTenantPool(t.id, t.database_name);
      const tc = await pool.connect();
      try {
        // Add class_name if missing
        await tc.query("ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS class_name VARCHAR(100)");
        // Copy data from name to class_name where empty
        await tc.query("UPDATE classes SET class_name = name WHERE class_name IS NULL AND name IS NOT NULL");

        // Add total_students default 0
        await tc.query("ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS total_students INTEGER NOT NULL DEFAULT 0");

        // Add faculty
        await tc.query("ALTER TABLE IF EXISTS classes ADD COLUMN IF NOT EXISTS faculty VARCHAR(255)");

        console.log('  ✅ Migrated classes table for tenant');
        fixed++;
      } catch (err) {
        console.error('  ❌ Error on tenant:', err.message);
      } finally {
        tc.release();
      }
    }
    console.log(`\nMigration complete. Tenants processed: ${tenants.length}, migrated: ${fixed}`);
  } catch (err) {
    console.error('Fatal error:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
