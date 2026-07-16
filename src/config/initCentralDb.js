const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const {
  centralPool,
  isSingleDatabase,
  getTenantPool,
  sharedDatabaseName,
} = require("./tenantDb");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

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
    await client.query(
      `ALTER TABLE tenant ADD COLUMN IF NOT EXISTS slug VARCHAR(255)`,
    );
    await client.query(
      `ALTER TABLE tenant ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '[]'::jsonb`,
    );
    console.log("✅ Columns added");

    console.log("🔄 Creating indexes...");
    // Create indexes
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_system_admin_email ON system_admin(email)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_tenant_email ON tenant(email)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_tenant_database_name ON tenant(database_name)`,
    );
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_slug ON tenant(slug)`,
    );
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

async function ensureDefaultSingleTenant() {
  const tenantName = process.env.DEFAULT_TENANT_NAME || "Single School";
  const tenantSlug = slugify(
    process.env.DEFAULT_TENANT_SLUG || tenantName || "single-school",
  );
  const tenantEmail = process.env.DEFAULT_TENANT_EMAIL || "tenant@school.local";
  const tenantPassword = process.env.DEFAULT_TENANT_PASSWORD || "Tenant@2026";
  const tenantDatabaseName =
    process.env.DEFAULT_TENANT_DB_NAME || sharedDatabaseName;

  const client = await centralPool.connect();
  try {
    const existingTenant = await client.query(
      "SELECT id, slug, email, database_name FROM tenant WHERE slug = $1 OR email = $2 LIMIT 1;",
      [tenantSlug, tenantEmail],
    );

    let tenant = existingTenant.rows[0];
    if (!tenant) {
      const passwordHash = await bcrypt.hash(tenantPassword, 10);
      const insertResult = await client.query(
        `INSERT INTO tenant (name, slug, email, password_hash, database_name, modules, status, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, slug, email, database_name;`,
        [
          tenantName,
          tenantSlug,
          tenantEmail,
          passwordHash,
          tenantDatabaseName,
          JSON.stringify([
            "dashboard",
            "calendar",
            "attendance",
            "teacher",
            "student",
            "employee",
            "settings",
            "results",
            "result_portal",
            "daily_reports",
          ]),
          "active",
          true,
        ],
      );
      tenant = insertResult.rows[0];
      console.log(`✅ Default tenant created: ${tenantName} (${tenantEmail})`);
    } else {
      console.log(`ℹ️ Default tenant already exists: ${tenant.email}`);
    }

    if (isSingleDatabase) {
      const tenantPool = getTenantPool(tenant.id, tenantDatabaseName);
      const tenantClient = await tenantPool.connect();
      try {
        await tenantClient.query(`
          CREATE TABLE IF NOT EXISTS tenant_users (
            id UUID PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'admin',
            name VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await tenantClient.query(`
          CREATE TABLE IF NOT EXISTS tenant_modules (
            id SERIAL PRIMARY KEY,
            module_key VARCHAR(100) UNIQUE NOT NULL,
            label VARCHAR(255) NOT NULL,
            enabled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        const passwordHash = await bcrypt.hash(tenantPassword, 10);
        await tenantClient.query(
          `INSERT INTO tenant_users (id, email, name, password_hash, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE SET
             password_hash = EXCLUDED.password_hash,
             name = EXCLUDED.name,
             role = EXCLUDED.role,
             is_active = TRUE;`,
          [uuidv4(), tenantEmail, tenantName, passwordHash, "admin", true],
        );

        const moduleLabels = {
          dashboard: "Dashboard",
          calendar: "Calendar",
          attendance: "Attendance",
          teacher: "Teachers",
          student: "Students",
          employee: "Employees",
          settings: "Settings",
          results: "Results",
          result_portal: "Result Portal",
          daily_reports: "Daily Reports",
        };
        for (const moduleKey of Object.keys(moduleLabels)) {
          await tenantClient.query(
            `INSERT INTO tenant_modules (module_key, label, enabled)
             VALUES ($1, $2, TRUE)
             ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE;`,
            [moduleKey, moduleLabels[moduleKey]],
          );
        }
      } finally {
        tenantClient.release();
      }
    }

    console.log(
      `🔐 Default tenant login ready: ${tenantEmail} / ${tenantPassword}`,
    );
  } finally {
    client.release();
  }
}

module.exports = {
  initializeCentralDatabase,
  ensureDefaultSingleTenant,
};
