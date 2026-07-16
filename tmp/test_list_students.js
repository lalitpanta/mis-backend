const { centralPool, getTenantPool } = require('../src/config/tenantDb');
const studentsService = require('../src/services/students.service');

async function run(tenantId) {
  try {
    const client = await centralPool.connect();
    const res = await client.query('SELECT id, name, database_name FROM tenant WHERE id = $1', [tenantId]);
    client.release();
    if (res.rows.length === 0) {
      console.error('Tenant not found in central DB');
      process.exit(1);
    }
    const tenant = res.rows[0];
    console.log('Tenant:', tenant);

    const pool = getTenantPool(tenant.id, tenant.database_name);
    const rows = await studentsService.list({ tenantPool: pool });
    console.log('Students count:', rows.length);
    console.dir(rows.slice(0,10), { depth: null });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

const tenantId = process.argv[2] || 'd1bc4850-220c-4b5f-bebe-f5dcd31f6f15';
run(tenantId);
