const { centralPool, getTenantPool } = require('../src/config/tenantDb');

async function inspect(tenantId) {
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
    const tclient = await pool.connect();
    try {
      const classesRes = await tclient.query("SELECT * FROM classes LIMIT 50");
      console.log('Classes rows:');
      console.dir(classesRes.rows, { depth: null });

      const cols = await tclient.query("SELECT column_name FROM information_schema.columns WHERE table_name='classes'");
      console.log('Classes columns:', cols.rows.map(r=>r.column_name));
    } catch (err) {
      console.error('Tenant query error:', err.message);
    } finally {
      tclient.release();
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

const tenantId = process.argv[2] || 'd1bc4850-220c-4b5f-bebe-f5dcd31f6f15';
inspect(tenantId).then(()=>process.exit(0));
