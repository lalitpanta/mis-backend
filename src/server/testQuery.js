const { getTenantPool } = require('../config/tenantDb');

async function run() {
  try {
    const pool = getTenantPool('d1bc4850-220c-4b5f-bebe-f5dcd31f6f15');
    const res = await pool.query("SELECT table_name, table_schema FROM information_schema.tables WHERE table_schema IN ('public', 'd1bc4850-220c-4b5f-bebe-f5dcd31f6f15')");
    console.log("TABLES:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
