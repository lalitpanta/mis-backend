const { centralPool, getTenantPool } = require('../src/config/tenantDb');
const sectionsService = require('../src/services/sections.service');

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
    // ensure tables
    await sectionsService.ensure(pool);

    // create a section
    const payload = {
      section_name: 'TestSectionX',
      class_id: null,
      room_id: null,
      total_students: 10,
      monitor_name: 'AutoTest',
      class_teacher_id: null,
    };

    try {
      const created = await sectionsService.create(pool, payload);
      console.log('Created section:', created);
    } catch (err) {
      console.error('Create error:', err);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

const tenantId = process.argv[2] || 'd1bc4850-220c-4b5f-bebe-f5dcd31f6f15';
run(tenantId);
