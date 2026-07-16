const { verifyToken, getTenantById } = require("../services/auth.service");

/**
 * Middleware to verify JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  req.user = decoded;
  next();
}

/**
 * Middleware to verify admin role
 */
function requireAdmin(req, res, next) {
  if (req.user.type !== "system_admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
}

/**
 * Middleware to verify tenant role
 * Also allows system_admin when X-Tenant-ID header is present
 */
function requireTenant(req, res, next) {
  if (req.user.type === "tenant" || req.user.type === "staff") {
    return next();
  }
  // Allow system_admin to access tenant routes when acting on behalf of a tenant
  if (req.user.type === "system_admin" && req.headers["x-tenant-id"]) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Tenant or Staff access required",
  });
}

/**
 * Middleware to enforce module access for tenant users
 */
function requireModule(moduleKey) {
  return (req, res, next) => {
    // System admins have access to all modules
    if (req.user.type === "system_admin") {
      return next();
    }
    const modules = Array.isArray(req.user.modules) ? req.user.modules : [];
    if (!modules.includes(moduleKey)) {
      return res.status(403).json({
        success: false,
        message: "Module access denied",
      });
    }
    next();
  };
}

// Track which tenants have been schema-patched this server session
const _patchedTenants = new Set();

/**
 * Ensure tenant database has up-to-date schema (runs once per tenant per server session)
 */
async function ensureTenantSchema(tenantPool, tenantId) {
  if (_patchedTenants.has(tenantId)) return;
  try {
    // Ensure uuid-ossp extension
    await tenantPool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Ensure roles table exists with permissions column
    await tenantPool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        role_name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        permissions JSON DEFAULT '[]'::json,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add permissions column if table existed without it
    await tenantPool.query(`
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT '[]'::json;
    `);

    // Ensure permissions table
    await tenantPool.query(`
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
    `);

    // Ensure role_permissions junction
    await tenantPool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      );
    `);

    // Ensure tenant_users table (needed for user_roles FK)
    await tenantPool.query(`
      CREATE TABLE IF NOT EXISTS tenant_users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure user_roles table
    await tenantPool.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by UUID,
        PRIMARY KEY (user_id, role_id)
      );
    `);

    // Ensure teachers table
    await tenantPool.query(`
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
    `);

    await tenantPool.query(`
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
    `);

    await tenantPool.query(`
      ALTER TABLE courses
        ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL;
    `);

    await tenantPool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_course_code ON courses(course_code);
    `);
    await tenantPool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_primary_teacher_id ON courses(primary_teacher_id);
    `);
    await tenantPool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_classroom_id ON courses(classroom_id);
    `);
    await tenantPool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_section_id ON courses(section_id);
    `);

    await tenantPool.query(`
      ALTER TABLE tenant_users
        ADD COLUMN IF NOT EXISTS teacher_id UUID;
    `);

    // Add constraint separately with error handling
    try {
      await tenantPool.query(`
        ALTER TABLE tenant_users
          ADD CONSTRAINT fk_teacher_to_user FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;
      `);
    } catch (err) {
      // Constraint may already exist, ignore error
      if (!err.message.includes("already exists")) {
        // Silently ignore
      }
    }

    // Ensure devices tables
    await tenantPool.query(`
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
    `);

    await tenantPool.query(`
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
    `);

    await tenantPool.query(`
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
    `);

    await tenantPool.query(`
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

    // Ensure settings table
    await tenantPool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    _patchedTenants.add(tenantId);
    console.log(`✅ Tenant ${tenantId} schema verified`);
  } catch (err) {
    console.error(
      `⚠️ Schema patch for tenant ${tenantId} failed:`,
      err.message,
    );
  }
}

/**
 * Middleware to attach tenant database name to request
 */
async function attachTenantContext(req, res, next) {
  try {
    const { getTenantPool } = require("../config/tenantDb");

    if (req.user.type === "tenant") {
      // For tenant, database name and ID are already in token
      req.tenantId = req.user.id;
      req.tenantDatabaseName = req.user.databaseName;
      req.tenantPool = getTenantPool(req.user.id, req.user.databaseName);
    } else if (req.user.type === "staff") {
      // For staff, database name and tenant ID are in token
      req.tenantId = req.user.tenantId;
      req.tenantDatabaseName = req.user.databaseName;
      req.tenantPool = getTenantPool(req.user.tenantId, req.user.databaseName);
    } else if (req.user.type === "system_admin") {
      // For admin, check X-Tenant-ID header if accessing tenant-specific endpoints
      const tenantIdFromHeader = req.headers["x-tenant-id"];
      if (tenantIdFromHeader) {
        req.tenantId = tenantIdFromHeader;
        const tenant = await getTenantById(tenantIdFromHeader);
        req.tenantDatabaseName = tenant.database_name;
        req.tenantPool = getTenantPool(
          tenantIdFromHeader,
          tenant.database_name,
        );
      }
    }

    // Ensure tenant schema is up to date (runs once per tenant per session)
    if (req.tenantPool && req.tenantId) {
      await ensureTenantSchema(req.tenantPool, req.tenantId);
    }

    next();
  } catch (error) {
    console.error("attachTenantContext error:", error.message);
    res.status(400).json({
      success: false,
      message: "Failed to attach tenant context",
    });
  }
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireTenant,
  requireModule,
  attachTenantContext,
};
