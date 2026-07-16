const { centralPool, getTenantPool } = require('../src/config/tenantDb');
const classesService = require('../src/services/classes.service');
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
    await classesService.ensure(pool);
    await sectionsService.ensure(pool);

    const cls = await classesService.getAll(pool);
    console.log('Classes:', cls.map(c => ({ id: c.id, name: c.class_name || c.name })));
    if (cls.length === 0) {
      console.log('No classes found for tenant');
      process.exit(0);
    }
    const firstClassId = cls[0].id;
    const secs = await sectionsService.getByClassId(pool, firstClassId);
    console.log(`Sections for class ${firstClassId}:`, secs.map(s => ({ id: s.id, name: s.section_name || s.name })));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

const tenantId = process.argv[2] || 'd1bc4850-220c-4b5f-bebe-f5dcd31f6f15';
run(tenantId);
