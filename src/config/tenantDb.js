const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const { getDatabaseConfig } = require("./databaseConfig");

const isSingleDatabase =
  process.env.SINGLE_DB === "true" || process.env.SINGLE_DATABASE === "true";

const sharedDatabaseName = getDatabaseConfig().database;

// Central database pool (for admin and tenant metadata)
const centralPool = new Pool({
  ...getDatabaseConfig(),
  min: parseInt(process.env.DB_POOL_MIN, 10),
  max: parseInt(process.env.DB_POOL_MAX, 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test central connection on startup
centralPool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Central database connection failed:", err.message);
    process.exit(1);
  }
  release();
  console.log("✅ Central PostgreSQL database connected successfully");
});

// Tenant-specific pools cache
const tenantPools = {};

/**
 * Get or create a pool for a specific tenant database
 * @param {string} tenantId - The tenant ID
 * @param {string} tenantDbName - The tenant's database name
 * @returns {Pool} PostgreSQL pool for the tenant
 */
function getTenantPool(tenantId, tenantDbName) {
  if (isSingleDatabase) {
    if (!tenantPools.single) {
      tenantPools.single = centralPool;
      console.log(
        `✅ SINGLE_DB mode active. Reusing shared database pool for tenant ${tenantId} (${tenantDbName || sharedDatabaseName}).`,
      );
    }
    return tenantPools.single;
  }

  if (!tenantPools[tenantId]) {
    tenantPools[tenantId] = new Pool({
      ...getDatabaseConfig({
        host: process.env.TENANT_DB_HOST || process.env.DB_HOST,
        port: process.env.TENANT_DB_PORT || process.env.DB_PORT,
        database: tenantDbName,
        user: process.env.TENANT_DB_USER || process.env.DB_USER,
        password: process.env.TENANT_DB_PASSWORD || process.env.DB_PASSWORD,
      }),
      min: parseInt(process.env.DB_POOL_MIN, 10),
      max: parseInt(process.env.DB_POOL_MAX, 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return tenantPools[tenantId];
}

/**
 * Create a new database for a tenant
 * @param {string} databaseName - The name of the database to create
 */
async function createTenantDatabase(databaseName) {
  if (isSingleDatabase) {
    console.log(
      `⚠️ SINGLE_DB mode enabled: skipping creation of tenant database "${databaseName}". Using shared DB ${sharedDatabaseName}.`,
    );
    return;
  }

  const client = await centralPool.connect();
  try {
    // Check if database already exists
    const result = await client.query(
      "SELECT EXISTS(SELECT datname FROM pg_catalog.pg_database WHERE datname = $1);",
      [databaseName],
    );

    if (result.rows[0].exists) {
      throw new Error(`Database ${databaseName} already exists`);
    }

    // Create the database
    await client.query(`CREATE DATABASE "${databaseName}";`);
    console.log(`✅ Database ${databaseName} created successfully`);
  } finally {
    client.release();
  }
}

/**
 * Initialize tenant database with schema
 * @param {string} tenantId - The tenant ID
 * @param {string} databaseName - The tenant's database name
 */
async function initializeTenantDatabase(tenantId, databaseName) {
  const tenantPool = getTenantPool(tenantId, databaseName);
  const client = await tenantPool.connect();

  try {
    // Create UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Tenant metadata table for tenant-specific login and metadata storage
    await client.query(`
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
    `);

    // Create tables for the tenant
    await client.query(`
      -- Tenant Users table
      CREATE TABLE IF NOT EXISTS tenant_users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tenant Modules table
      CREATE TABLE IF NOT EXISTS tenant_modules (
        id SERIAL PRIMARY KEY,
        module_key VARCHAR(100) UNIQUE NOT NULL,
        label VARCHAR(255) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Tenant Logs table
      CREATE TABLE IF NOT EXISTS tenant_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        meta JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Year table
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

      -- Month Class Data table
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

      -- Day Category table
      CREATE TABLE IF NOT EXISTS "day_category" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Day Classification table
      CREATE TABLE IF NOT EXISTS "day_classification" (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_id UUID REFERENCES "day_category"(id) ON DELETE SET NULL,
        day_type VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Calendar Days table
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

      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- School profile table
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

      -- Roles table
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        role_name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        permissions JSON DEFAULT '[]'::json,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Permissions table
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

      -- Role-Permissions junction table
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      );

      -- User-Roles table
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by UUID,
        PRIMARY KEY (user_id, role_id)
      );

      -- Teachers table
      CREATE TABLE IF NOT EXISTS teachers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        employee_id VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(50),
        blood_group VARCHAR(50),
        nationality VARCHAR(100),
        religion VARCHAR(100),
        ethnicity VARCHAR(100),
        marital_status VARCHAR(100),
        profile_photo_url TEXT,
        personal_email VARCHAR(255),
        personal_phone VARCHAR(100),
        alternate_phone VARCHAR(100),
        current_address TEXT,
        permanent_address TEXT,
        designation VARCHAR(100),
        department_id UUID,
        employment_type VARCHAR(100),
        join_date DATE,
        subjects_taught JSONB DEFAULT '[]'::jsonb,
        classes_assigned JSONB DEFAULT '[]'::jsonb,
        reporting_manager VARCHAR(255),
        work_email VARCHAR(255),
        work_phone VARCHAR(100),
        office_room VARCHAR(255),
        highest_qualification VARCHAR(100),
        institution_name VARCHAR(255),
        passed_year VARCHAR(50),
        major_subject VARCHAR(255),
        additional_certifications JSONB DEFAULT '[]'::jsonb,
        teaching_license_number VARCHAR(255),
        license_expiry_date DATE,
        previous_organization VARCHAR(255),
        previous_position VARCHAR(255),
        previous_from_date DATE,
        previous_to_date DATE,
        previous_leave_reason TEXT,
        total_years_experience NUMERIC,
        citizenship_number VARCHAR(255),
        citizenship_issued_date DATE,
        citizenship_issued_district VARCHAR(255),
        passport_number VARCHAR(255),
        passport_expiry_date DATE,
        pan_number VARCHAR(255),
        national_id_number VARCHAR(255),
        bank_name VARCHAR(255),
        bank_branch VARCHAR(255),
        account_number VARCHAR(255),
        account_holder_name VARCHAR(255),
        salary_grade VARCHAR(255),
        basic_salary NUMERIC,
        allowances JSONB DEFAULT '{}'::jsonb,
        provident_fund_number VARCHAR(255),
        insurance_number VARCHAR(255),
        emergency_contact_name VARCHAR(255),
        emergency_contact_relationship VARCHAR(255),
        emergency_contact_phone VARCHAR(100),
        emergency_contact_address TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS teacher_id UUID;

      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS name VARCHAR(255);

      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS department_store VARCHAR(255);

      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS authority_mode VARCHAR(50) DEFAULT 'role_access';

      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS module_access JSON DEFAULT '[]'::json;

      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS student_id UUID;

      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS employee_id UUID;

      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS section_id UUID;
    `);

    // Add constraint separately with error handling
    try {
      await client.query(`
        ALTER TABLE tenant_users
          ADD CONSTRAINT fk_teacher_to_user FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
      `);
    } catch (err) {
      // Constraint may already exist, ignore error
      if (!err.message.includes("already exists")) {
        console.warn(`Warning adding teacher FK: ${err.message}`);
      }
    }

    // Create devices tables
    await client.query(`
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
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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
        guardian_email VARCHAR(100),
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
        documents JSONB DEFAULT '[]'::jsonb,
        classroom_id INT REFERENCES classrooms(id) ON DELETE SET NULL,
        class_id INT REFERENCES classes(id) ON DELETE SET NULL,
        section_id INT REFERENCES sections(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add indexes for students to improve query performance
      CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
      CREATE INDEX IF NOT EXISTS idx_students_section_id ON students(section_id);
      CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON students(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);

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

      -- Courses / Subjects Table
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
        section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
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

      CREATE INDEX IF NOT EXISTS idx_courses_course_code ON courses(course_code);
      CREATE INDEX IF NOT EXISTS idx_courses_primary_teacher_id ON courses(primary_teacher_id);
      CREATE INDEX IF NOT EXISTS idx_courses_classroom_id ON courses(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_courses_section_id ON courses(section_id);
      CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses(is_active);
    `);

    // Create devices tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        tenant_id UUID,
        device_name VARCHAR(255) NOT NULL,
        device_type VARCHAR(50) NOT NULL DEFAULT 'ZKTeco' CHECK (device_type IN ('ZKTeco', 'eSSL', 'Suprema')),
        ip_address VARCHAR(50) NOT NULL,
        port INTEGER DEFAULT 5000,
        location VARCHAR(255),
        connection_method VARCHAR(20) DEFAULT 'pull' CHECK (connection_method IN ('pull', 'push', 'ADMS')),
        pull_interval_minutes INTEGER DEFAULT 5,
        enabled BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMP,
        connection_status VARCHAR(20) DEFAULT 'unreachable' CHECK (connection_status IN ('online', 'offline', 'unreachable')),
        last_status_check_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS device_sync_logs (
        id SERIAL PRIMARY KEY,
        tenant_id UUID,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        sync_type VARCHAR(20) DEFAULT 'auto' CHECK (sync_type IN ('manual', 'auto')),
        status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
        records_pulled INTEGER DEFAULT 0,
        records_saved INTEGER DEFAULT 0,
        records_skipped INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS device_teacher_enrollments (
        id SERIAL PRIMARY KEY,
        tenant_id UUID,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        device_user_id VARCHAR(50) NOT NULL,
        enrollment_status VARCHAR(20) DEFAULT 'pending' CHECK (enrollment_status IN ('enrolled', 'pending', 'failed')),
        enrolled_at TIMESTAMP,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS device_attendance_records (
        id SERIAL PRIMARY KEY,
        tenant_id UUID,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        user_id UUID,
        device_user_id VARCHAR(50) NOT NULL,
        check_type VARCHAR(10) NOT NULL CHECK (check_type IN ('in', 'out')),
        check_time TIMESTAMP NOT NULL,
        temperature NUMERIC(5, 2),
        mask_detected BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

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

    console.log(`✅ Tenant database ${databaseName} initialized successfully`);
  } finally {
    client.release();
  }
}

module.exports = {
  centralPool,
  getTenantPool,
  createTenantDatabase,
  initializeTenantDatabase,
};
