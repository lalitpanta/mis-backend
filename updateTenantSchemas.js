const { centralPool, getTenantPool } = require("./src/config/tenantDb");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

/**
 * Update existing tenant database schema to the new format
 */
async function updateTenantDatabaseSchema(tenantId, databaseName) {
  const tenantPool = getTenantPool(tenantId, databaseName);
  const client = await tenantPool.connect();

  try {
    console.log(`🔄 Updating schema for tenant database: ${databaseName}`);

    // Create UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Drop old tables if they exist with wrong schema
    await client.query(`
      DROP TABLE IF EXISTS "calendar_days" CASCADE;
      DROP TABLE IF EXISTS "month_class_data" CASCADE;
      DROP TABLE IF EXISTS "day_classification" CASCADE;
      DROP TABLE IF EXISTS "day_category" CASCADE;
      DROP TABLE IF EXISTS "year" CASCADE;
    `);

    // Create tables with correct schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS "year" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        year_label VARCHAR(255) NOT NULL UNIQUE,
        year_label_AD VARCHAR(255),
        year_label_BS VARCHAR(255),
        start_date_AD DATE,
        end_date_AD DATE,
        start_date_BS VARCHAR(255),
        end_date_BS VARCHAR(255),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_current BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "month_class_data" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        year_id UUID NOT NULL REFERENCES "year"(id) ON DELETE CASCADE,
        month_name VARCHAR(255) NOT NULL,
        bs_month_index INTEGER,
        month_start_date_BS VARCHAR(255) NOT NULL,
        month_end_date_BS VARCHAR(255) NOT NULL,
        month_start_date_AD VARCHAR(255) NOT NULL,
        month_end_date_AD VARCHAR(255) NOT NULL,
        month_start_day_BS VARCHAR(255) NOT NULL,
        month_end_day_BS VARCHAR(255) NOT NULL,
        month_start_day_AD VARCHAR(255) NOT NULL,
        month_end_day_AD VARCHAR(255) NOT NULL,
        date_format VARCHAR(10) DEFAULT 'BS',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "day_category" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "day_classification" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_id UUID REFERENCES "day_category"(id) ON DELETE SET NULL,
        day_type VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "calendar_days" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        year_id UUID NOT NULL REFERENCES "year"(id) ON DELETE CASCADE,
        month_id UUID NOT NULL REFERENCES "month_class_data"(id) ON DELETE CASCADE,
        day_type_id UUID REFERENCES "day_classification"(id) ON DELETE SET NULL,
        day_number INT NOT NULL,
        day_of_week VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create roles table
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        role_name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        permissions JSON DEFAULT '[]'::json,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create permissions table
      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        permission_key VARCHAR(100) NOT NULL UNIQUE,
        permission_name VARCHAR(255) NOT NULL,
        description TEXT,
        resource VARCHAR(100),
        action VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create role_permissions junction table
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      );

      -- Create user_roles table (link users to roles)
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by UUID,
        PRIMARY KEY (user_id, role_id)
      );

      -- Alter tenant_users to add name, phone, department_store, authority_mode, module_access
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS department_store VARCHAR(255);
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS authority_mode VARCHAR(50) DEFAULT 'role_access';
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS module_access JSON DEFAULT '[]'::json;
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS student_id UUID;
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS employee_id UUID;
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS section_id UUID;

      -- Create school_profile table
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

      -- Create school_blocks table
      CREATE TABLE IF NOT EXISTS school_blocks (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES school_profile(id) ON DELETE CASCADE,
        block_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create school_floors table
      CREATE TABLE IF NOT EXISTS school_floors (
        id SERIAL PRIMARY KEY,
        block_id INTEGER NOT NULL REFERENCES school_blocks(id) ON DELETE CASCADE,
        floor_number INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(block_id, floor_number)
      );

      -- Create rooms table
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        room_number VARCHAR(50) NOT NULL,
        block_id INTEGER REFERENCES school_blocks(id) ON DELETE SET NULL,
        floor_number INTEGER,
        room_type VARCHAR(100) NOT NULL DEFAULT 'Classroom',
        total_capacity INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);
      CREATE INDEX IF NOT EXISTS idx_rooms_block_id ON rooms(block_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_floor_number ON rooms(floor_number);

      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        course_name VARCHAR(255) NOT NULL,
        course_code VARCHAR(50) UNIQUE NOT NULL,
        short_name VARCHAR(50),
        department VARCHAR(255),
        description TEXT,
        subject_type VARCHAR(100) DEFAULT 'Core',
        grade_level VARCHAR(100),
        academic_year VARCHAR(50),
        term_semester VARCHAR(100),
        category_tags JSONB DEFAULT '[]'::jsonb,
        periods_per_week INTEGER DEFAULT 0,
        period_duration_minutes INTEGER DEFAULT 45,
        credit_hours_theory NUMERIC(5,2) DEFAULT 0,
        credit_hours_lab NUMERIC(5,2) DEFAULT 0,
        total_contact_hours_per_week NUMERIC(5,2) DEFAULT 0,
        primary_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
        classroom_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL,
        classroom_section_id INTEGER,
        teaching_language VARCHAR(100),
        delivery_mode VARCHAR(100) DEFAULT 'In-person',
        scheduled_days JSONB DEFAULT '[]'::jsonb,
        full_marks_theory NUMERIC(5,2) DEFAULT 100,
        pass_marks_theory NUMERIC(5,2) DEFAULT 40,
        full_marks_practical NUMERIC(5,2) DEFAULT 0,
        pass_marks_practical NUMERIC(5,2) DEFAULT 0,
        grading_scheme VARCHAR(100) DEFAULT 'Percentage',
        grade_point NUMERIC(5,2),
        assessment_components JSONB DEFAULT '[]'::jsonb,
        prerequisite_courses JSONB DEFAULT '[]'::jsonb,
        corequisite_courses JSONB DEFAULT '[]'::jsonb,
        minimum_cgpa_to_enroll NUMERIC(5,2),
        max_enrollment INTEGER,
        learning_outcomes JSONB DEFAULT '[]'::jsonb,
        syllabus_standard VARCHAR(100),
        textbooks JSONB DEFAULT '[]'::jsonb,
        lms_digital_resource_link VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE,
        show_in_student_portal BOOLEAN DEFAULT TRUE,
        allow_online_submission BOOLEAN DEFAULT FALSE,
        attendance_required BOOLEAN DEFAULT TRUE,
        include_in_progress_report BOOLEAN DEFAULT TRUE,
        is_elective BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE courses ADD COLUMN IF NOT EXISTS classroom_section_id INTEGER;
      CREATE INDEX IF NOT EXISTS idx_courses_course_code ON courses(course_code);
      CREATE INDEX IF NOT EXISTS idx_courses_primary_teacher_id ON courses(primary_teacher_id);
      CREATE INDEX IF NOT EXISTS idx_courses_classroom_id ON courses(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_courses_classroom_section_id ON courses(classroom_section_id);
    `);

    // Seed default categories
    await client.query(`
      INSERT INTO "day_category" (category_name) VALUES 
        ('Holiday'),
        ('Exam'),
        ('Annual Day'),
        ('Working Day')
      ON CONFLICT DO NOTHING;
    `);

    // Seed default day types
    await client.query(`
      INSERT INTO "day_classification" (day_type) VALUES 
        ('School Day'),
        ('Public Holiday'),
        ('Term Exam'),
        ('Half Day')
      ON CONFLICT DO NOTHING;
    `);

    // Seed default roles
    const defaultRoles = [
      {
        role_name: "Admin",
        description: "Full access to all features",
        is_system: true,
        permissions: [
          "dashboard.view",
          "calendar.view",
          "calendar.create",
          "calendar.edit",
          "calendar.delete",
          "attendance.view",
          "attendance.create",
          "attendance.edit",
          "attendance.delete",
          "users.view",
          "users.create",
          "users.edit",
          "users.delete",
          "roles.view",
          "roles.create",
          "roles.edit",
          "roles.delete",
          "settings.view",
          "settings.edit",
        ],
      },
      {
        role_name: "Teacher",
        description: "Access to classroom and attendance features",
        is_system: true,
        permissions: [
          "dashboard.view",
          "calendar.view",
          "attendance.view",
          "attendance.create",
          "attendance.edit",
        ],
      },
      {
        role_name: "Staff",
        description: "Access to administrative features",
        is_system: true,
        permissions: [
          "dashboard.view",
          "calendar.view",
          "attendance.view",
          "settings.view",
        ],
      },
      {
        role_name: "Student",
        description: "Limited access to view schedules and attendance",
        is_system: true,
        permissions: ["dashboard.view", "calendar.view", "attendance.view"],
      },
    ];

    for (const role of defaultRoles) {
      await client.query(
        `INSERT INTO roles (role_name, description, is_system, permissions)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (role_name) DO UPDATE SET permissions = $4`,
        [
          role.role_name,
          role.description,
          role.is_system,
          JSON.stringify(role.permissions),
        ],
      );
    }

    // Create stored procedure to set current year
    await client.query(`
      CREATE OR REPLACE FUNCTION set_current_year(year_id UUID)
      RETURNS void AS $$
      BEGIN
        -- Set all years to not current
        UPDATE "year" SET is_current = false;
        
        -- Set the specified year as current
        UPDATE "year" SET is_current = true WHERE id = year_id;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create stored procedure to refresh year category stats
    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_year_category_stats(year_id UUID)
      RETURNS void AS $$
      BEGIN
        -- This function recalculates statistics for day categories in a year
        -- For now, it's a placeholder - can be extended to compute actual stats
        -- This prevents errors when called from calendar_days service
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log(`✅ Schema updated successfully for ${databaseName}`);
  } catch (err) {
    console.error(
      `❌ Failed to update schema for ${databaseName}:`,
      err.message,
    );
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get all tenant databases from the central database
 */
async function getAllTenantDatabases() {
  try {
    const result = await centralPool.query(
      'SELECT id, database_name FROM "tenant" WHERE is_active = true',
    );
    return result.rows;
  } catch (err) {
    console.log(
      "⚠️  Could not fetch tenants from central database:",
      err.message,
    );
    return [];
  }
}

/**
 * Main function to update all tenant databases
 */
async function updateAllTenantDatabases() {
  try {
    console.log("🔍 Fetching all tenant databases...");
    const tenants = await getAllTenantDatabases();

    if (tenants.length === 0) {
      console.log("ℹ️  No active tenants found to update.");
      return;
    }

    console.log(`📊 Found ${tenants.length} tenant(s) to update`);

    for (const tenant of tenants) {
      try {
        await updateTenantDatabaseSchema(tenant.id, tenant.database_name);
      } catch (err) {
        console.error(`❌ Error updating tenant ${tenant.id}:`, err.message);
      }
    }

    console.log("✅ All tenant databases have been updated!");
  } catch (err) {
    console.error("❌ Error during tenant database update:", err.message);
  } finally {
    await centralPool.end();
  }
}

// Run the update
updateAllTenantDatabases();
