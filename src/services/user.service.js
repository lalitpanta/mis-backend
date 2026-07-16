const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

/**
 * Hash a password
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new user in tenant database
 */
const createUser = async (userData, req) => {
  try {
    const {
      email,
      password,
      name,
      phone,
      department_store,
      authority_mode,
      module_access,
      teacher_id,
      student_id,
      employee_id,
      section_id,
    } = userData;
    const pool = req?.tenantPool || require("../config/db");

    if (!email && !teacher_id && !student_id && !employee_id) {
      throw new Error(
        "Email or linked entity (teacher/student/employee) must be provided",
      );
    }

    if (!password) {
      throw new Error("Password is required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    let computedName = name;
    let computedEmail = email;
    let computedPhone = phone;
    let computedDepartment = department_store;

    // Handle teacher linked users
    if (teacher_id) {
      const teacherResult = await pool.query(
        "SELECT full_name, work_email, personal_email, personal_phone, work_phone, department_id FROM teachers WHERE id = $1",
        [teacher_id],
      );
      if (teacherResult.rows.length > 0) {
        const teacher = teacherResult.rows[0];
        if (!computedName) computedName = teacher.full_name;
        if (!computedEmail)
          computedEmail = teacher.work_email || teacher.personal_email;
        if (!computedPhone)
          computedPhone = teacher.personal_phone || teacher.work_phone;
        if (!computedDepartment && teacher.department_id) {
          computedDepartment = teacher.department_id;
        }
      }
    }

    // Handle student linked users
    if (student_id) {
      const studentResult = await pool.query(
        "SELECT full_name, email, phone FROM students WHERE id = $1",
        [student_id],
      );
      if (studentResult.rows.length > 0) {
        const student = studentResult.rows[0];
        if (!computedName) computedName = student.full_name;
        if (!computedEmail) computedEmail = student.email;
        if (!computedPhone) computedPhone = student.phone;
      }
    }

    // Handle employee linked users
    if (employee_id) {
      const employeeResult = await pool.query(
        "SELECT full_name, email_address, mobile_number, department_id FROM employees WHERE id = $1",
        [employee_id],
      );
      if (employeeResult.rows.length > 0) {
        const employee = employeeResult.rows[0];
        if (!computedName) computedName = employee.full_name;
        if (!computedEmail) computedEmail = employee.email_address;
        if (!computedPhone) computedPhone = employee.mobile_number;
        if (!computedDepartment && employee.department_id) {
          computedDepartment = employee.department_id;
        }
      }
    }

    if (!computedEmail) {
      throw new Error("Email is required");
    }

    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id FROM tenant_users WHERE email = $1",
      [computedEmail],
    );

    if (existingUser.rows.length > 0) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    const userId = uuidv4();
    const modules = Array.isArray(module_access) ? module_access : [];

    // Create user
    const query = `
      INSERT INTO tenant_users (id, email, password_hash, name, phone, department_store, authority_mode, module_access, teacher_id, student_id, employee_id, section_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, email, name, phone, department_store, authority_mode, module_access, teacher_id, student_id, employee_id, section_id, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, [
      userId,
      computedEmail,
      passwordHash,
      computedName || null,
      computedPhone || null,
      computedDepartment || null,
      authority_mode || "role_access",
      JSON.stringify(modules),
      teacher_id || null,
      student_id || null,
      employee_id || null,
      section_id || null,
      true,
    ]);

    return result.rows[0];
  } catch (err) {
    throw new Error(`Failed to create user: ${err.message}`);
  }
};

/**
 * Get all users
 */
const getAllUsers = async (req) => {
  try {
    const pool = req?.tenantPool || require("../config/db");

    const query = `
      SELECT 
        u.id, 
        u.email, 
        u.name,
        u.phone,
        u.department_store,
        u.authority_mode,
        u.module_access,
        u.teacher_id,
        u.student_id,
        u.employee_id,
        u.section_id,
        json_build_object(
          'id', t.id,
          'employee_id', t.employee_id,
          'full_name', t.full_name,
          'work_email', t.work_email,
          'personal_phone', t.personal_phone
        ) AS teacher,
        u.is_active, 
        u.created_at, 
        u.updated_at,
        json_agg(json_build_object('id', r.id, 'role_name', r.role_name)) FILTER (WHERE r.id IS NOT NULL) as roles
      FROM tenant_users u
      LEFT JOIN teachers t ON u.teacher_id = t.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      GROUP BY u.id, t.id, t.employee_id, t.full_name, t.work_email, t.personal_phone
      ORDER BY u.created_at DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    throw new Error(`Failed to fetch users: ${err.message}`);
  }
};

/**
 * Get users by role name (e.g., 'Teacher')
 */
const getUsersByRole = async (roleName, req) => {
  try {
    const pool = req?.tenantPool || require("../config/db");
    const query = `
      SELECT u.id, u.email, u.name
      FROM tenant_users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE r.role_name = $1 AND u.is_active = TRUE
      ORDER BY u.name NULLS LAST
    `;
    const result = await pool.query(query, [roleName]);
    return result.rows;
  } catch (err) {
    throw new Error(`Failed to fetch users by role: ${err.message}`);
  }
};

/**
 * Get user by ID with roles
 */
const getUserById = async (userId, req) => {
  try {
    const pool = req?.tenantPool || require("../config/db");

    const query = `
      SELECT 
        u.id, 
        u.email,
        u.name,
        u.phone,
        u.department_store,
        u.authority_mode,
        u.module_access,
        u.teacher_id,
        u.student_id,
        u.employee_id,
        u.section_id,
        json_build_object(
          'id', t.id,
          'employee_id', t.employee_id,
          'full_name', t.full_name,
          'work_email', t.work_email,
          'personal_phone', t.personal_phone
        ) AS teacher,
        u.is_active, 
        u.created_at, 
        u.updated_at,
        json_agg(json_build_object('id', r.id, 'role_name', r.role_name)) FILTER (WHERE r.id IS NOT NULL) as roles
      FROM tenant_users u
      LEFT JOIN teachers t ON u.teacher_id = t.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1
      GROUP BY u.id, t.id, t.employee_id, t.full_name, t.work_email, t.personal_phone
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  } catch (err) {
    throw new Error(`Failed to fetch user: ${err.message}`);
  }
};

/**
 * Update user
 */
const updateUser = async (userId, userData, req) => {
  try {
    const {
      email,
      name,
      phone,
      department_store,
      authority_mode,
      module_access,
      is_active,
      teacher_id,
      student_id,
      employee_id,
      section_id,
    } = userData;
    const pool = req?.tenantPool || require("../config/db");

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name || null);
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone || null);
    }

    if (department_store !== undefined) {
      updates.push(`department_store = $${paramCount++}`);
      values.push(department_store || null);
    }

    if (authority_mode !== undefined) {
      updates.push(`authority_mode = $${paramCount++}`);
      values.push(authority_mode || "role_access");
    }

    if (module_access !== undefined) {
      updates.push(`module_access = $${paramCount++}`);
      values.push(
        JSON.stringify(Array.isArray(module_access) ? module_access : []),
      );
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (teacher_id !== undefined) {
      updates.push(`teacher_id = $${paramCount++}`);
      values.push(teacher_id || null);
    }

    if (student_id !== undefined) {
      updates.push(`student_id = $${paramCount++}`);
      values.push(student_id || null);
    }

    if (employee_id !== undefined) {
      updates.push(`employee_id = $${paramCount++}`);
      values.push(employee_id || null);
    }

    if (section_id !== undefined) {
      updates.push(`section_id = $${paramCount++}`);
      values.push(section_id || null);
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE tenant_users 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, email, name, phone, department_store, authority_mode, module_access, teacher_id, student_id, employee_id, section_id, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  } catch (err) {
    throw new Error(`Failed to update user: ${err.message}`);
  }
};

/**
 * Change user password
 */
const changePassword = async (userId, oldPassword, newPassword, req) => {
  try {
    if (!oldPassword || !newPassword) {
      throw new Error("Old password and new password are required");
    }

    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters");
    }

    // Handle tenant users (they use central database)
    if (req?.user?.type === "tenant") {
      const { centralPool } = require("../config/tenantDb");
      const pool = centralPool;

      // Get current password hash for tenant
      const userResult = await pool.query(
        "SELECT password_hash FROM tenant WHERE id = $1",
        [userId],
      );

      if (userResult.rows.length === 0) {
        throw new Error("Tenant not found");
      }

      // Verify old password
      const isPasswordValid = await comparePassword(
        oldPassword,
        userResult.rows[0].password_hash,
      );

      if (!isPasswordValid) {
        throw new Error("Old password is incorrect");
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      const result = await pool.query(
        "UPDATE tenant SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, is_active, created_at, updated_at",
        [newPasswordHash, userId],
      );

      return result.rows[0];
    }

    // Handle staff users (they use tenant database)
    const pool = req?.tenantPool || require("../config/db");

    // Get current password hash
    const userResult = await pool.query(
      "SELECT password_hash FROM tenant_users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      throw new Error("Staff user not found");
    }

    // Verify old password
    const isPasswordValid = await comparePassword(
      oldPassword,
      userResult.rows[0].password_hash,
    );

    if (!isPasswordValid) {
      throw new Error("Old password is incorrect");
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    const query = `
      UPDATE tenant_users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, [newPasswordHash, userId]);
    return result.rows[0];
  } catch (err) {
    throw new Error(`Failed to change password: ${err.message}`);
  }
};

/**
 * Change email for current authenticated user
 */
const changeEmail = async (userId, newEmail, password, req) => {
  try {
    if (!newEmail || !password) {
      throw new Error("New email and password are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new Error("Invalid email format");
    }

    // Handle tenant users (they use central database)
    if (req?.user?.type === "tenant") {
      const { centralPool } = require("../config/tenantDb");
      const pool = centralPool;

      // Get current user
      const userResult = await pool.query(
        "SELECT password_hash, email FROM tenant WHERE id = $1",
        [userId],
      );

      if (userResult.rows.length === 0) {
        throw new Error("Tenant not found");
      }

      const user = userResult.rows[0];

      // Verify password
      const isPasswordValid = await comparePassword(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        throw new Error("Password is incorrect");
      }

      // Check if email already exists
      const emailCheck = await pool.query(
        "SELECT id FROM tenant WHERE email = $1 AND id != $2",
        [newEmail, userId],
      );

      if (emailCheck.rows.length > 0) {
        throw new Error("Email already in use");
      }

      // Update email
      const result = await pool.query(
        "UPDATE tenant SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, is_active, created_at, updated_at",
        [newEmail, userId],
      );

      return result.rows[0];
    }

    // Handle staff users (they use tenant database)
    const pool = req?.tenantPool || require("../config/db");

    // Get current user
    const userResult = await pool.query(
      "SELECT password_hash, email FROM tenant_users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      throw new Error("Staff user not found");
    }

    const user = userResult.rows[0];

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error("Password is incorrect");
    }

    // Check if email already exists in tenant_users table
    const emailCheck = await pool.query(
      "SELECT id FROM tenant_users WHERE email = $1 AND id != $2",
      [newEmail, userId],
    );

    if (emailCheck.rows.length > 0) {
      throw new Error("Email already in use");
    }

    // Update email
    const result = await pool.query(
      "UPDATE tenant_users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, is_active, created_at, updated_at",
      [newEmail, userId],
    );

    return result.rows[0];
  } catch (err) {
    throw new Error(`Failed to change email: ${err.message}`);
  }
};

/**
 * Reset user password (admin only)
 */
const resetPassword = async (userId, newPassword, req) => {
  try {
    const pool = req?.tenantPool || require("../config/db");

    if (!newPassword) {
      throw new Error("New password is required");
    }

    if (newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    const query = `
      UPDATE tenant_users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, [newPasswordHash, userId]);

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  } catch (err) {
    throw new Error(`Failed to reset password: ${err.message}`);
  }
};

/**
 * Delete user
 */
const deleteUser = async (userId, req) => {
  try {
    const pool = req?.tenantPool || require("../config/db");

    const query = `
      DELETE FROM tenant_users 
      WHERE id = $1
      RETURNING id, email
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  } catch (err) {
    throw new Error(`Failed to delete user: ${err.message}`);
  }
};

/**
 * Activate/Deactivate user
 */
const toggleUserActive = async (userId, isActive, req) => {
  try {
    const pool = req?.tenantPool || require("../config/db");

    const query = `
      UPDATE tenant_users 
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, [isActive, userId]);

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  } catch (err) {
    throw new Error(`Failed to toggle user status: ${err.message}`);
  }
};

/**
 * Assign roles to user
 */
const assignRolesToUser = async (userId, roleIds, req) => {
  try {
    const pool = req?.tenantPool || require("../config/db");

    if (!Array.isArray(roleIds)) {
      throw new Error("roleIds must be an array");
    }

    // Start transaction
    await pool.query("BEGIN");

    try {
      // Delete existing roles
      await pool.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);

      // Insert new roles
      for (const roleId of roleIds) {
        await pool.query(
          "INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1, $2, CURRENT_TIMESTAMP)",
          [userId, roleId],
        );
      }

      // Get updated user with roles
      const result = await pool.query(
        `SELECT 
          u.id, 
          u.email, 
          u.is_active,
          json_agg(json_build_object('id', r.id, 'role_name', r.role_name)) FILTER (WHERE r.id IS NOT NULL) as roles
        FROM tenant_users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id`,
        [userId],
      );

      await pool.query("COMMIT");
      return result.rows[0];
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    throw new Error(`Failed to assign roles: ${err.message}`);
  }
};

/**
 * Get user with roles and permissions
 */
const getUserWithRolesAndPermissions = async (userId, req) => {
  try {
    // Handle tenant users (they use central database)
    if (req?.user?.type === "tenant") {
      const { centralPool } = require("../config/tenantDb");
      const pool = centralPool;

      // Get tenant info from central database
      const tenantResult = await pool.query(
        `SELECT 
          id, 
          email, 
          name,
          is_active
        FROM tenant
        WHERE id = $1`,
        [userId],
      );

      if (tenantResult.rows.length === 0) {
        throw new Error("Tenant not found");
      }

      const tenant = tenantResult.rows[0];

      // Tenants don't have roles/permissions from tenant_users table
      // Return tenant info with empty roles/permissions
      return {
        id: tenant.id,
        email: tenant.email,
        name: tenant.name,
        is_active: tenant.is_active,
        permissions: [],
        roles: [],
        userType: "tenant",
      };
    }

    // Handle staff users (they use tenant database)
    const pool = req?.tenantPool || require("../config/db");

    // Get staff user with roles
    const userResult = await pool.query(
      `SELECT 
        u.id, 
        u.email, 
        u.name,
        u.is_active,
        json_agg(json_build_object('id', r.id, 'role_name', r.role_name, 'description', r.description)) FILTER (WHERE r.id IS NOT NULL) as roles
      FROM tenant_users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1
      GROUP BY u.id, u.email, u.name, u.is_active`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      throw new Error("Staff user not found");
    }

    const user = userResult.rows[0];

    // Get user's permissions from their roles
    const permissionsResult = await pool.query(
      `SELECT DISTINCT r.permissions::text AS permissions
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1`,
      [userId],
    );

    // Flatten permissions from all roles
    const permissionsSet = new Set();
    for (const row of permissionsResult.rows) {
      let perms = row.permissions;
      if (typeof perms === "string") {
        try {
          perms = JSON.parse(perms);
        } catch {
          perms = [];
        }
      }
      if (Array.isArray(perms)) {
        perms.forEach((p) => permissionsSet.add(p));
      }
    }

    return {
      ...user,
      permissions: [...permissionsSet],
      roles: user.roles && user.roles[0]?.id ? user.roles : [],
      userType: "staff",
    };
  } catch (err) {
    throw new Error(
      `Failed to fetch user with roles and permissions: ${err.message}`,
    );
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  changePassword,
  changeEmail,
  resetPassword,
  deleteUser,
  toggleUserActive,
  assignRolesToUser,
  getUserWithRolesAndPermissions,
  hashPassword,
  comparePassword,
};
