const { centralPool } = require("./tenantDb");

/**
 * Initialize central database with admin and tenant metadata tables
 */
async function initializeCentralDatabase() {
  const client = await centralPool.connect();

  try {
    console.log("🔄 Creating system_admin table if not exists...");
    // Create system_admin table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_admin (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ system_admin table created");

    console.log("🔄 Creating tenant table if not exists...");
    // Create tenant table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        database_name VARCHAR(255) UNIQUE NOT NULL,
        modules JSONB DEFAULT '[]'::jsonb,
        contact_person VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        status VARCHAR(50) DEFAULT 'active',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ tenant table created");

    console.log("🔄 Adding columns to tenant table...");
    // Add columns safely
    await client.query(`ALTER TABLE tenant ADD COLUMN IF NOT EXISTS slug VARCHAR(255)`);
    await client.query(`ALTER TABLE tenant ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '[]'::jsonb`);
    console.log("✅ Columns added");

    console.log("🔄 Creating indexes...");
    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_system_admin_email ON system_admin(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tenant_email ON tenant(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tenant_database_name ON tenant(database_name)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_slug ON tenant(slug)`);
    console.log("✅ Indexes created");

    console.log("✅ Central database schema initialized successfully");
  } catch (error) {
    if (error.code === "42P07") {
      // Table already exists, which is fine
      console.log("✅ Central database tables already exist");
    } else {
      console.error("❌ Database initialization error:", error.message);
      throw error;
    }
  } finally {
    client.release();
  }
}

module.exports = {
  initializeCentralDatabase,
};
