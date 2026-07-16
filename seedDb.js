const {
  centralPool,
  initializeTenantDatabase,
  getTenantPool,
  createTenantDatabase,
} = require("./src/config/tenantDb");
const { hashPassword } = require("./src/services/auth.service");
const { initializeCentralDatabase } = require("./src/config/initCentralDb");
const { v4: uuidv4 } = require("uuid");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Repair existing tenant database schemas
 * Fixes settings table with old column names (setting_key, setting_value)
 */
async function repairExistingTenants() {
  console.log("🔧 Checking for existing tenant databases that need schema repairs...");
  
  const client = await centralPool.connect();
  try {
    // Get all active tenants
    const result = await client.query(
      "SELECT id, database_name FROM tenant WHERE is_active = true"
    );

    for (const tenant of result.rows) {
      console.log(`  Checking tenant database: ${tenant.database_name}`);
      const tenantPool = getTenantPool(tenant.id, tenant.database_name);
      const tenantClient = await tenantPool.connect();

      try {
        // Check if settings table exists with old column names
        const columnCheck = await tenantClient.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'settings' AND column_name IN ('setting_key', 'setting_value')
        `);

        if (columnCheck.rows.length > 0) {
          console.log(`  ✓ Found old schema in ${tenant.database_name}, repairing...`);
          
          // Drop old settings table
          await tenantClient.query('DROP TABLE IF EXISTS settings CASCADE;');
          
          // Recreate with correct schema
          await tenantClient.query(`
            CREATE TABLE IF NOT EXISTS settings (
              id SERIAL PRIMARY KEY,
              key VARCHAR(100) NOT NULL UNIQUE,
              value TEXT,
              description TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          console.log(`  ✅ Settings table repaired for ${tenant.database_name}`);
        }

        // Check if refresh_year_category_stats function exists
        const funcCheck = await tenantClient.query(`
          SELECT routine_name FROM information_schema.routines 
          WHERE routine_name = 'refresh_year_category_stats' 
          AND routine_schema = 'public'
        `);

        if (funcCheck.rows.length === 0) {
          console.log(`  ✓ Missing refresh_year_category_stats in ${tenant.database_name}, creating...`);
          
          await tenantClient.query(`
            CREATE OR REPLACE FUNCTION refresh_year_category_stats(year_id UUID)
            RETURNS void AS $$
            BEGIN
              -- This function recalculates statistics for day categories in a year
              -- For now, it's a placeholder - can be extended to compute actual stats
              -- This prevents errors when called from calendar_days service
            END;
            $$ LANGUAGE plpgsql;
          `);

          console.log(`  ✅ refresh_year_category_stats function created for ${tenant.database_name}`);
        }
      } finally {
        tenantClient.release();
      }
    }

    console.log("✅ All tenant databases repaired!");
  } catch (err) {
    console.error("❌ Error repairing tenant databases:", err.message);
  } finally {
    client.release();
  }
}

async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  try {
    // Initialize central database schema
    console.log("📋 Initializing central database...");
    await initializeCentralDatabase();

    // Repair existing tenant databases
    console.log("🔧 Repairing existing tenant database schemas...");
    await repairExistingTenants();

    const client = await centralPool.connect();

    try {
      // Check if admin already exists
      const adminCheck = await client.query(
        "SELECT id FROM system_admin WHERE email = 'admin@system.local';"
      );

      if (adminCheck.rows.length === 0) {
        // Create demo system admin
        const adminPassword = await hashPassword("admin123");
        await client.query(
          `INSERT INTO system_admin (email, password_hash, first_name, last_name, is_active)
           VALUES ($1, $2, $3, $4, $5);`,
          ["admin@system.local", adminPassword, "System", "Admin", true]
        );
        console.log("✅ Demo system admin created");
        console.log("   Email: admin@system.local");
        console.log("   Password: admin123");
      } else {
        console.log("⏭️  Admin already exists");
      }

      // Check if demo tenant exists
      const tenantCheck = await client.query(
        "SELECT id, slug, modules, database_name FROM tenant WHERE email = 'demo@tenant.local';"
      );

      if (tenantCheck.rows.length === 0) {
        // Create demo tenant
        const tenantPassword = await hashPassword("tenant123");
        const slug = slugify("Demo School");
        const modules = JSON.stringify(["dashboard", "calendar", "attendance", "settings"]);
        const insertResult = await client.query(
          `INSERT INTO tenant (name, slug, email, password_hash, database_name, modules, contact_person, phone, status, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id;`,
          [
            "Demo School",
            slug,
            "demo@tenant.local",
            tenantPassword,
            "demo_school_db",
            modules,
            "Demo Contact",
            "+977-1-1234567",
            "active",
            true,
          ]
        );
        const tenantId = insertResult.rows[0].id;
        try {
          await createTenantDatabase("demo_school_db");
        } catch (error) {
          if (!String(error.message || "").includes("already exists")) {
            throw error;
          }
        }
        await initializeTenantDatabase(tenantId, "demo_school_db");
        const tenantPool = getTenantPool(tenantId, "demo_school_db");
        const tenantDbClient = await tenantPool.connect();
        try {
          const tenantPassword = await hashPassword("tenant123");
          const staffPassword = await hashPassword("staff123");
          
          await tenantDbClient.query(
            `INSERT INTO tenant_users (id, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (email) DO NOTHING;`,
            [uuidv4(), "demo@tenant.local", tenantPassword, "admin", true]
          );

          // Add test staff users
          const staff1Id = uuidv4();
          const staff2Id = uuidv4();
          
          await tenantDbClient.query(
            `INSERT INTO tenant_users (id, email, name, password_hash, is_active)
             VALUES 
             ($1, $2, $3, $4, $5),
             ($6, $7, $8, $9, $10)
             ON CONFLICT (email) DO NOTHING;`,
            [
              staff1Id, "john.doe@demo.local", "John Doe", staffPassword, true,
              staff2Id, "jane.smith@demo.local", "Jane Smith", staffPassword, true
            ]
          );

          // Assign staff user role to them
          await tenantDbClient.query(
            `INSERT INTO user_roles (user_id, role_id)
             SELECT $1, id FROM roles WHERE role_name = 'Staff' 
             ON CONFLICT DO NOTHING;`,
            [staff1Id]
          );
          
          await tenantDbClient.query(
            `INSERT INTO user_roles (user_id, role_id)
             SELECT $1, id FROM roles WHERE role_name = 'Staff' 
             ON CONFLICT DO NOTHING;`,
            [staff2Id]
          );

          for (const moduleKey of ["dashboard", "calendar", "attendance", "settings"]) {
            await tenantDbClient.query(
              `INSERT INTO tenant_modules (module_key, label, enabled)
               VALUES ($1, $2, TRUE)
               ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE;`,
              [moduleKey, moduleKey]
            );
          }
        } finally {
          tenantDbClient.release();
        }
        console.log("✅ Demo tenant created");
        console.log("   Name: Demo School");
        console.log("   Email: demo@tenant.local");
        console.log("   Password: tenant123");
        console.log("   Database: demo_school_db");
      } else {
        const existing = tenantCheck.rows[0];
        const slug = existing.slug || slugify("Demo School");
        const modules = existing.modules || ["dashboard", "calendar", "attendance", "settings"];
        await client.query(
          "UPDATE tenant SET slug = $1, modules = $2 WHERE email = 'demo@tenant.local';",
          [slug, JSON.stringify(modules)]
        );
        try {
          await createTenantDatabase(existing.database_name);
        } catch (error) {
          if (!String(error.message || "").includes("already exists")) {
            throw error;
          }
        }
        await initializeTenantDatabase(existing.id, existing.database_name);
        const tenantPool = getTenantPool(existing.id, existing.database_name);
        const tenantDbClient = await tenantPool.connect();
        try {
          const tenantPassword = await hashPassword("tenant123");
          const staffPassword = await hashPassword("staff123");
          
          await tenantDbClient.query(
            `INSERT INTO tenant_users (id, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (email) DO NOTHING;`,
            [uuidv4(), "demo@tenant.local", tenantPassword, "admin", true]
          );

          // Add test staff users
          const staff1Id = uuidv4();
          const staff2Id = uuidv4();
          
          await tenantDbClient.query(
            `INSERT INTO tenant_users (id, email, name, password_hash, is_active)
             VALUES 
             ($1, $2, $3, $4, $5),
             ($6, $7, $8, $9, $10)
             ON CONFLICT (email) DO NOTHING;`,
            [
              staff1Id, "john.doe@demo.local", "John Doe", staffPassword, true,
              staff2Id, "jane.smith@demo.local", "Jane Smith", staffPassword, true
            ]
          );

          // Assign staff user role to them
          await tenantDbClient.query(
            `INSERT INTO user_roles (user_id, role_id)
             SELECT $1, id FROM roles WHERE role_name = 'Staff' 
             ON CONFLICT DO NOTHING;`,
            [staff1Id]
          );
          
          await tenantDbClient.query(
            `INSERT INTO user_roles (user_id, role_id)
             SELECT $1, id FROM roles WHERE role_name = 'Staff' 
             ON CONFLICT DO NOTHING;`,
            [staff2Id]
          );

          for (const moduleKey of ["dashboard", "calendar", "attendance", "settings"]) {
            await tenantDbClient.query(
              `INSERT INTO tenant_modules (module_key, label, enabled)
               VALUES ($1, $2, TRUE)
               ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE;`,
              [moduleKey, moduleKey]
            );
          }
        } finally {
          tenantDbClient.release();
        }
        console.log("⏭️  Demo tenant already exists");
      }
    } finally {
      client.release();
    }

    console.log("✅ Database seeding completed successfully!");
    console.log("\n📝 Credentials for testing:");
    console.log("   Admin: admin@system.local / admin123");
    console.log("   Tenant: demo@tenant.local / tenant123");
    console.log("   Tenant Slug: demo-school");
    console.log("\n   Staff Users (use 'Staff' tab + 'demo-school' slug):");
    console.log("   - john.doe@demo.local / staff123 (John Doe)");
    console.log("   - jane.smith@demo.local / staff123 (Jane Smith)");
  } catch (error) {
    console.error("❌ Error seeding database:", error.message);
    process.exit(1);
  } finally {
    await centralPool.end();
  }
}

// Run seeding
seedDatabase();
