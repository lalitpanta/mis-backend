/**
 * Fix script to ensure all existing tenants have the required modules
 * This script updates tenant records that don't have calendar and settings modules
 * 
 * Run: node fixTenantModules.js
 */

const { centralPool, getTenantPool } = require("./src/config/tenantDb");

const MODULE_LABELS = {
  dashboard: "Dashboard",
  calendar: "Calendar",
  attendance: "Attendance",
  settings: "Settings",
};

const DEFAULT_MODULES = ["dashboard", "calendar", "attendance", "settings", "classroom"];

async function fixTenantModules() {
  const client = await centralPool.connect();
  let fixedCount = 0;
  let errorCount = 0;

  try {
    // Get all active tenants
    const result = await client.query(
      "SELECT id, name, database_name, modules FROM tenant WHERE is_active = TRUE ORDER BY created_at"
    );

    const tenants = result.rows;
    console.log(`📋 Found ${tenants.length} active tenants to check...\n`);

    for (const tenant of tenants) {
      try {
        let modules = [];
        
        // Parse existing modules
        if (Array.isArray(tenant.modules)) {
          modules = [...tenant.modules];
        } else if (typeof tenant.modules === "string") {
          try {
            modules = JSON.parse(tenant.modules);
          } catch (e) {
            modules = [];
          }
        }

        // Check if all default modules are present
        const hasAllModules = DEFAULT_MODULES.every(m => modules.includes(m));
        
        if (!hasAllModules) {
          console.log(`⚙️  Fixing tenant: ${tenant.name} (ID: ${tenant.id})`);
          console.log(`   Current modules: ${modules.join(", ") || "none"}`);

          // Merge with defaults
          modules = [...new Set([...DEFAULT_MODULES, ...modules])];

          // Update tenant record
          await client.query(
            "UPDATE tenant SET modules = $1 WHERE id = $2",
            [JSON.stringify(modules), tenant.id]
          );

          // Also ensure tenant_modules table has all modules
          const tenantPool = getTenantPool(tenant.id, tenant.database_name);
          const tenantClient = await tenantPool.connect();

          try {
            // Ensure tenant_modules table exists
            await tenantClient.query(`
              CREATE TABLE IF NOT EXISTS tenant_modules (
                id SERIAL PRIMARY KEY,
                module_key VARCHAR(100) NOT NULL UNIQUE,
                label VARCHAR(255),
                enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              );
            `);

            for (const moduleKey of modules) {
              const label = MODULE_LABELS[moduleKey] || moduleKey;
              await tenantClient.query(
                `INSERT INTO tenant_modules (module_key, label, enabled)
                 VALUES ($1, $2, TRUE)
                 ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE`,
                [moduleKey, label]
              );
            }
            console.log(`✅ Fixed: ${modules.join(", ")}\n`);
            fixedCount++;
          } finally {
            tenantClient.release();
          }
        } else {
          console.log(`✓  ${tenant.name} - already has all modules\n`);
        }
      } catch (err) {
        console.error(`❌ Error fixing tenant ${tenant.name}:`, err.message, "\n");
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log("=".repeat(60));

  } catch (err) {
    console.error("Fatal error:", err);
  } finally {
    client.release();
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

// Run the fix
console.log("🔧 Tenant Module Fix Script\n");
console.log("This script ensures all tenants have calendar and settings modules.\n");

fixTenantModules().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
