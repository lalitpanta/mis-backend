const { centralPool, getTenantPool } = require("../config/tenantDb");

/**
 * Tenant Schema Patcher Service
 * Automatically fixes schema for all existing tenants on server startup
 */

async function patchAllTenantSchemas() {
  console.log("\n📋 Starting tenant schema patch service...\n");

  const client = await centralPool.connect();
  let patchedCount = 0;
  let errorCount = 0;

  try {
    // Get all active tenants
    const result = await client.query(
      "SELECT id, database_name, name FROM tenant WHERE is_active = true ORDER BY created_at DESC",
    );

    if (result.rows.length === 0) {
      console.log("ℹ️  No active tenants found. Skipping schema patch.");
      return;
    }

    console.log(
      `🔍 Found ${result.rows.length} active tenant(s). Patching schemas...\n`,
    );

    for (const tenant of result.rows) {
      try {
        console.log(
          `  📦 Processing: ${tenant.name} (${tenant.database_name})`,
        );

        const tenantPool = getTenantPool(tenant.id, tenant.database_name);
        const tenantClient = await tenantPool.connect();

        try {
          // Add missing tables to existing tenants
          await tenantClient.query(`
            CREATE TABLE IF NOT EXISTS tenant (
              id UUID PRIMARY KEY,
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
            );

            CREATE TABLE IF NOT EXISTS rooms (
              id SERIAL PRIMARY KEY,
              room_number VARCHAR(50) NOT NULL,
              block_id INTEGER REFERENCES school_blocks(id) ON DELETE SET NULL,
              floor_number INTEGER,
              room_type VARCHAR(100) NOT NULL DEFAULT 'Classroom',
              total_capacity INTEGER NOT NULL DEFAULT 0,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS classes (
              id SERIAL PRIMARY KEY,
              class_name VARCHAR(100) NOT NULL,
              total_students INTEGER NOT NULL DEFAULT 0,
              faculty VARCHAR(255),
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sections (
              id SERIAL PRIMARY KEY,
              section_name VARCHAR(100) NOT NULL,
              class_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL,
              block_id INTEGER REFERENCES school_blocks(id) ON DELETE SET NULL,
              floor_number INTEGER,
              room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
              total_students INTEGER NOT NULL DEFAULT 0,
              monitor_name VARCHAR(255),
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS classrooms (
              id SERIAL PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              total_capacity INTEGER NOT NULL DEFAULT 0,
              number_of_sections INTEGER NOT NULL DEFAULT 0,
              class_teacher_id UUID,
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS students (
              id SERIAL PRIMARY KEY,
              student_type VARCHAR(20) NOT NULL DEFAULT 'school',
              full_name VARCHAR(100) NOT NULL,
              profile_picture TEXT,
              nationality VARCHAR(50),
              gender VARCHAR(10),
              date_of_birth DATE,
              legal_entity VARCHAR(255),
              batch VARCHAR(50),
              semester VARCHAR(50),
              roll_no INT,
              university_reg_no VARCHAR(50),
              admission_no VARCHAR(50),
              admission_date DATE,
              category_stream VARCHAR(255),
              student_mail VARCHAR(100),
              school_email VARCHAR(100),
              phone_no VARCHAR(20),
              address TEXT,
              current_address TEXT,
              home_district VARCHAR(100),
              home_municipality VARCHAR(100),
              home_ward VARCHAR(100),
              home_full_address TEXT,
              father_name VARCHAR(100),
              father_qualification VARCHAR(255),
              father_profession VARCHAR(100),
              father_organization VARCHAR(255),
              mother_name VARCHAR(100),
              mother_qualification VARCHAR(255),
              mother_profession VARCHAR(100),
              mother_organization VARCHAR(255),
              guardian_name VARCHAR(100),
              guardian_phone VARCHAR(20),
              guardian_qualification VARCHAR(255),
              guardian_profession VARCHAR(100),
              guardian_organization VARCHAR(255),
              siblings_info JSONB,
              transportation_required BOOLEAN DEFAULT FALSE,
              bus_service BOOLEAN DEFAULT FALSE,
              hostel_required BOOLEAN DEFAULT FALSE,
              meal_type VARCHAR(50),
              meal_eligibility_date DATE,
              eca_interests TEXT,
              learning_styles TEXT,
              previous_school VARCHAR(255),
              previous_education JSONB,
              blood_group VARCHAR(20),
              allergies TEXT,
              height DECIMAL(5,2),
              weight DECIMAL(5,2),
              measurement_date DATE,
              vaccination_records JSONB,
              special_needs TEXT,
              medical_notes TEXT,
              classroom_id INT REFERENCES classrooms(id) ON DELETE SET NULL,
              section_id INT REFERENCES sections(id) ON DELETE SET NULL,
              class_id INT REFERENCES classes(id) ON DELETE SET NULL,
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS results (
              id SERIAL PRIMARY KEY,
              student_id INT REFERENCES students(id) ON DELETE CASCADE,
              subject VARCHAR(255) NOT NULL,
              marks_obtained NUMERIC(5, 2) NOT NULL,
              total_marks NUMERIC(5, 2) NOT NULL,
              percentage NUMERIC(5, 2),
              grade VARCHAR(10),
              exam_date DATE,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS school_profile (
              id SERIAL PRIMARY KEY,
              name VARCHAR(255),
              email VARCHAR(255),
              phone VARCHAR(100),
              address TEXT,
              website VARCHAR(255),
              motto TEXT,
              logo TEXT,
              established DATE,
              country VARCHAR(100),
              total_floors INTEGER,
              is_active BOOLEAN DEFAULT TRUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS school_blocks (
              id SERIAL PRIMARY KEY,
              profile_id INTEGER NOT NULL REFERENCES school_profile(id) ON DELETE CASCADE,
              block_name VARCHAR(255) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS school_floors (
              id SERIAL PRIMARY KEY,
              block_id INTEGER NOT NULL REFERENCES school_blocks(id) ON DELETE CASCADE,
              floor_number INTEGER NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(block_id, floor_number)
            );
          `);

          const migrationResult = await tenantClient.query(
            'SELECT value FROM "settings" WHERE key = $1 LIMIT 1',
            ["school_profile"],
          );

          if (migrationResult.rows.length > 0) {
            const legacyValue = migrationResult.rows[0].value;
            let parsed;
            try {
              parsed = JSON.parse(legacyValue);
            } catch {
              parsed = null;
            }

            const existingProfile = await tenantClient.query(
              "SELECT id FROM school_profile LIMIT 1",
            );
            if (parsed && existingProfile.rows.length === 0) {
              const profileResult = await tenantClient.query(
                `INSERT INTO school_profile
                   (name, email, phone, address, website, motto, logo, established, country, total_floors, is_active, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                 RETURNING id`,
                [
                  parsed.name || null,
                  parsed.email || null,
                  parsed.phone || null,
                  parsed.address || null,
                  parsed.website || null,
                  parsed.motto || null,
                  parsed.logo || null,
                  parsed.established || null,
                  parsed.country || null,
                  parsed.total_floors !== undefined &&
                  parsed.total_floors !== null
                    ? parseInt(parsed.total_floors, 10) || null
                    : null,
                  parsed.is_active !== undefined ? parsed.is_active : true,
                ],
              );

              const profileId = profileResult.rows[0].id;

              if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
                for (const block of parsed.blocks) {
                  const blockName = block.block_name || block.name || null;
                  const floorCount = Math.max(
                    1,
                    parseInt(
                      block.floor_count ?? block.floors?.length ?? 1,
                      10,
                    ) || 1,
                  );

                  if (!blockName) continue;

                  const blockInsert = await tenantClient.query(
                    `INSERT INTO school_blocks (profile_id, block_name, created_at, updated_at)
                     VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                     RETURNING id`,
                    [profileId, blockName],
                  );
                  const blockId = blockInsert.rows[0].id;

                  for (
                    let floorNumber = 1;
                    floorNumber <= floorCount;
                    floorNumber += 1
                  ) {
                    await tenantClient.query(
                      `INSERT INTO school_floors (block_id, floor_number, created_at, updated_at)
                       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                      [blockId, floorNumber],
                    );
                  }
                }
              }
            }

            await tenantClient.query('DELETE FROM "settings" WHERE key = $1', [
              "school_profile",
            ]);
          }

          console.log(`     ✅ Schema updated successfully`);
          patchedCount++;
        } finally {
          tenantClient.release();
        }
      } catch (err) {
        console.error(
          `     ❌ Error patching ${tenant.database_name}: ${err.message}`,
        );
        errorCount++;
      }
    }

    console.log(`\n✨ Tenant schema patching complete!`);
    console.log(`   ✅ Successfully patched: ${patchedCount} tenant(s)`);
    if (errorCount > 0) {
      console.log(`   ⚠️  Failed: ${errorCount} tenant(s)`);
    }
    console.log("");
  } catch (err) {
    console.error("❌ Fatal error in tenant schema patcher:", err.message);
  } finally {
    client.release();
  }
}

module.exports = {
  patchAllTenantSchemas,
};
