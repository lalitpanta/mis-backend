const { centralPool, getTenantPool } = require("./src/config/tenantDb");

/**
 * Add missing tables (classes, rooms, sections, students, results) to existing tenant databases
 */
async function fixMissingTablesInTenants() {
  console.log("🔧 Adding missing tables to existing tenant databases...");

  const client = await centralPool.connect();
  try {
    // Get all active tenants
    const result = await client.query(
      "SELECT id, database_name FROM tenant WHERE is_active = true",
    );

    for (const tenant of result.rows) {
      console.log(`  Processing tenant database: ${tenant.database_name}`);
      const tenantPool = getTenantPool(tenant.id, tenant.database_name);
      const tenantClient = await tenantPool.connect();

      try {
        // Add missing tables
        await tenantClient.query(`
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
        `);

        console.log(`  ✅ Missing tables added to ${tenant.database_name}`);
      } catch (err) {
        // Tables may already exist, which is fine
        if (err.message.includes("already exists")) {
          console.log(`  ℹ️ Tables already exist in ${tenant.database_name}`);
        } else {
          console.error(
            `  ❌ Error adding tables to ${tenant.database_name}:`,
            err.message,
          );
        }
      } finally {
        tenantClient.release();
      }
    }

    console.log("✅ All tenant databases processed!");
  } catch (err) {
    console.error("❌ Error fixing tenant databases:", err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the fix
fixMissingTablesInTenants();
