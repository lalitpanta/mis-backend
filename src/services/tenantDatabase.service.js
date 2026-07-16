const { getTenantPool } = require("../config/tenantDb");

/**
 * Execute query on tenant database
 */
async function executeTenantQuery(tenantId, databaseName, query, params = []) {
  const pool = getTenantPool(tenantId, databaseName);
  const client = await pool.connect();

  try {
    const result = await client.query(query, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Execute transaction on tenant database
 */
async function executeTenantTransaction(tenantId, databaseName, callback) {
  const pool = getTenantPool(tenantId, databaseName);
  const client = await pool.connect();

  try {
    await client.query("BEGIN;");
    const result = await callback(client);
    await client.query("COMMIT;");
    return result;
  } catch (error) {
    await client.query("ROLLBACK;");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  executeTenantQuery,
  executeTenantTransaction,
};
