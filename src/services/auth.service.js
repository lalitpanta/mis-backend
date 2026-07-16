const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const {
  centralPool,
  createTenantDatabase,
  initializeTenantDatabase,
  getTenantPool,
} = require("../config/tenantDb");

const MODULE_LABELS = {
  dashboard: "Dashboard",
  calendar: "Calendar",
  attendance: "Attendance",
  settings: "Settings",
  result_portal: "Result Portal",
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function validateSlug(slug) {
  if (!slug) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function normalizeModules(modules) {
  if (!Array.isArray(modules)) return [];
  return [
    ...new Set(
      modules
        .map((m) =>
          String(m || "")
            .toLowerCase()
            .trim(),
        )
        .filter(Boolean),
    ),
  ];
}

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
 * Generate JWT token
 */
function generateToken(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * System Admin Login
 */
async function adminLogin(email, password) {
  const client = await centralPool.connect();

  try {
    const result = await client.query(
      "SELECT * FROM system_admin WHERE email = $1 AND is_active = TRUE;",
      [email],
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const admin = result.rows[0];
    const isPasswordValid = await comparePassword(
      password,
      admin.password_hash,
    );

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    const token = generateToken(
      {
        id: admin.id,
        email: admin.email,
        role: "admin",
        type: "system_admin",
      },
      process.env.JWT_EXPIRE_ADMIN || "7d",
    );

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
      },
    };
  } finally {
    client.release();
  }
}

/**
 * Tenant Login
 */
async function tenantLogin(tenantSlug, email, password) {
  const client = await centralPool.connect();

  try {
    const normalizedSlug = slugify(tenantSlug);
    if (!validateSlug(normalizedSlug)) {
      throw new Error("Invalid tenant name or slug");
    }

    const result = await client.query(
      "SELECT * FROM tenant WHERE slug = $1 AND is_active = TRUE;",
      [normalizedSlug],
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const tenant = result.rows[0];

    // Verify that the email matches the tenant's email (not any user in tenant_users)
    // This ensures only the tenant admin can login as tenant
    if (email !== tenant.email) {
      throw new Error("Invalid email or password");
    }

    const isPasswordValid = await comparePassword(
      password,
      tenant.password_hash,
    );

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    let assignedModules = [];
    if (Array.isArray(tenant.modules)) {
      assignedModules = [...tenant.modules]; // Copy array
    } else if (typeof tenant.modules === "string") {
      try {
        assignedModules = JSON.parse(tenant.modules);
      } catch (e) {
        assignedModules = [];
      }
    }

    // Ensure all default modules are included
    const defaultModules = [
      "dashboard",
      "calendar",
      "attendance",
      "settings",
      "result_portal",
    ];
    const hasAllModules = defaultModules.every((m) =>
      assignedModules.includes(m),
    );

    if (assignedModules.length === 0 || !hasAllModules) {
      // Get enabled modules from tenant_modules table
      const tenantPool = getTenantPool(tenant.id, tenant.database_name);
      const tenantDbClient = await tenantPool.connect();
      try {
        const modulesResult = await tenantDbClient.query(
          "SELECT module_key FROM tenant_modules WHERE enabled = TRUE ORDER BY module_key;",
        );
        const dbModules = modulesResult.rows.map((row) => row.module_key);

        // Merge with defaults to ensure all are present
        assignedModules = [...new Set([...defaultModules, ...dbModules])];

        // Ensure all modules exist in tenant_modules table
        for (const moduleKey of assignedModules) {
          const label = MODULE_LABELS[moduleKey] || moduleKey;
          await tenantDbClient.query(
            `INSERT INTO tenant_modules (module_key, label, enabled)
             VALUES ($1, $2, TRUE)
             ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE;`,
            [moduleKey, label],
          );
        }

        // Update tenant record if modules changed
        if (
          JSON.stringify(assignedModules.sort()) !==
          JSON.stringify((tenant.modules || []).sort())
        ) {
          await client.query("UPDATE tenant SET modules = $1 WHERE id = $2;", [
            JSON.stringify(assignedModules),
            tenant.id,
          ]);
        }
      } finally {
        tenantDbClient.release();
      }
    }

    const token = generateToken(
      {
        id: tenant.id,
        email: tenant.email,
        name: tenant.name,
        databaseName: tenant.database_name,
        slug: tenant.slug,
        modules: assignedModules,
        role: "tenant",
        type: "tenant",
      },
      process.env.JWT_EXPIRE_TENANT || "24h",
    );

    return {
      token,
      tenant: {
        id: tenant.id,
        email: tenant.email,
        name: tenant.name,
        databaseName: tenant.database_name,
        slug: tenant.slug,
        modules: assignedModules,
      },
    };
  } finally {
    client.release();
  }
}

/**
 * Create a new tenant
 */
async function createTenant(
  name,
  email,
  password,
  databaseName,
  slug,
  modules,
) {
  const client = await centralPool.connect();

  try {
    const normalizedSlug = slugify(slug || name);
    if (!validateSlug(normalizedSlug)) {
      throw new Error(
        "Slug must be lowercase, hyphenated, and contain only letters/numbers",
      );
    }

    const normalizedModules = normalizeModules(modules);

    // Ensure all default modules are always included
    const defaultModules = [
      "dashboard",
      "calendar",
      "attendance",
      "settings",
      "result_portal",
    ];
    const allModules = [...new Set([...defaultModules, ...normalizedModules])];

    if (allModules.length === 0) {
      throw new Error("Failed to set modules for tenant");
    }

    // Start transaction
    await client.query("BEGIN;");

    // Check if email or database already exists
    const emailCheck = await client.query(
      "SELECT id FROM tenant WHERE email = $1;",
      [email],
    );

    if (emailCheck.rows.length > 0) {
      throw new Error("Email already exists");
    }

    const dbCheck = await client.query(
      "SELECT id FROM tenant WHERE database_name = $1;",
      [databaseName],
    );

    if (dbCheck.rows.length > 0) {
      throw new Error("Database name already exists");
    }

    const slugCheck = await client.query(
      "SELECT id FROM tenant WHERE slug = $1;",
      [normalizedSlug],
    );

    if (slugCheck.rows.length > 0) {
      throw new Error("Slug already exists");
    }

    // Create database for tenant
    await createTenantDatabase(databaseName);

    // Generate tenant ID
    const tenantId = uuidv4();

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert tenant into central database
    const result = await client.query(
      `INSERT INTO tenant (id, name, slug, email, password_hash, database_name, modules, status, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, slug, email, database_name, modules;`,
      [
        tenantId,
        name,
        normalizedSlug,
        email,
        passwordHash,
        databaseName,
        JSON.stringify(allModules),
        "active",
        true,
      ],
    );

    // Initialize tenant database with schema
    await initializeTenantDatabase(tenantId, databaseName);

    // Create tenant admin user in tenant database
    const tenantPool = getTenantPool(tenantId, databaseName);
    const tenantDbClient = await tenantPool.connect();
    try {
      await tenantDbClient.query(
        `INSERT INTO tenant_users (id, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5);`,
        [uuidv4(), email, passwordHash, "admin", true],
      );

      for (const moduleKey of allModules) {
        const label = MODULE_LABELS[moduleKey] || moduleKey;
        await tenantDbClient.query(
          `INSERT INTO tenant_modules (module_key, label, enabled)
           VALUES ($1, $2, TRUE)
           ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE;`,
          [moduleKey, label],
        );
      }
    } finally {
      tenantDbClient.release();
    }

    // Commit transaction
    await client.query("COMMIT;");

    console.log(`✅ Tenant ${name} created successfully`);
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK;");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all tenants (for admin)
 */
async function getAllTenants() {
  const client = await centralPool.connect();

  try {
    const result = await client.query(
      `SELECT id, name, slug, email, database_name, modules, contact_person, phone, address, status, 
            is_active, created_at, updated_at 
       FROM tenant 
       ORDER BY created_at DESC;`,
    );

    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Get tenant by ID
 */
async function getTenantById(tenantId) {
  const client = await centralPool.connect();

  try {
    const result = await client.query(
      `SELECT id, name, slug, email, database_name, modules, contact_person, phone, address, status, is_active 
       FROM tenant 
       WHERE id = $1;`,
      [tenantId],
    );

    if (result.rows.length === 0) {
      throw new Error("Tenant not found");
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Update tenant active status
 */
async function updateTenant(tenantId, updates = {}) {
  const client = await centralPool.connect();

  try {
    const normalizedUpdates = {};

    if (updates.name !== undefined) {
      const name = String(updates.name || "").trim();
      if (!name) throw new Error("Tenant name is required");
      normalizedUpdates.name = name;
    }

    if (updates.email !== undefined) {
      const email = String(updates.email || "")
        .trim()
        .toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("A valid email is required");
      }
      normalizedUpdates.email = email;
    }

    if (updates.slug !== undefined) {
      const slug = slugify(updates.slug);
      if (!validateSlug(slug)) {
        throw new Error(
          "Slug must be lowercase, hyphenated, and contain only letters/numbers",
        );
      }
      normalizedUpdates.slug = slug;
    }

    if (updates.modules !== undefined) {
      const normalizedModules = normalizeModules(updates.modules);
      const defaultModules = [
        "dashboard",
        "calendar",
        "attendance",
        "settings",
        "result_portal",
      ];
      normalizedUpdates.modules = JSON.stringify([
        ...new Set([...defaultModules, ...normalizedModules]),
      ]);
    }

    if (Object.keys(normalizedUpdates).length === 0) {
      throw new Error("No valid updates provided");
    }

    if (normalizedUpdates.email) {
      const emailCheck = await client.query(
        "SELECT id FROM tenant WHERE email = $1 AND id != $2;",
        [normalizedUpdates.email, tenantId],
      );

      if (emailCheck.rows.length > 0) {
        throw new Error("Email already exists");
      }
    }

    if (normalizedUpdates.slug) {
      const slugCheck = await client.query(
        "SELECT id FROM tenant WHERE slug = $1 AND id != $2;",
        [normalizedUpdates.slug, tenantId],
      );

      if (slugCheck.rows.length > 0) {
        throw new Error("Slug already exists");
      }
    }

    await client.query("BEGIN;");

    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(normalizedUpdates)) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }

    values.push(tenantId);
    const result = await client.query(
      `UPDATE tenant
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx}
       RETURNING id, name, slug, email, database_name, modules, is_active, status;`,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error("Tenant not found");
    }

    await client.query("COMMIT;");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK;").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function updateTenantStatus(tenantId, isActive) {
  const client = await centralPool.connect();

  try {
    const status = isActive ? "active" : "inactive";
    const result = await client.query(
      `UPDATE tenant
       SET is_active = $1, status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, name, slug, email, database_name, is_active, status;`,
      [isActive, status, tenantId],
    );

    if (result.rows.length === 0) {
      throw new Error("Tenant not found");
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Soft delete tenant
 */
async function deleteTenant(tenantId) {
  const client = await centralPool.connect();

  try {
    const result = await client.query(
      `UPDATE tenant
       SET is_active = FALSE, status = 'deleted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, slug, email, database_name, is_active, status;`,
      [tenantId],
    );

    if (result.rows.length === 0) {
      throw new Error("Tenant not found");
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Staff/User Login
 * Authenticates a staff member or user within a tenant
 */
async function staffLogin(tenantSlug, email, password) {
  const client = await centralPool.connect();

  try {
    const normalizedSlug = slugify(tenantSlug);
    if (!validateSlug(normalizedSlug)) {
      throw new Error("Invalid tenant name or slug");
    }

    // Get tenant info
    const tenantResult = await client.query(
      "SELECT * FROM tenant WHERE slug = $1 AND is_active = TRUE;",
      [normalizedSlug],
    );

    if (tenantResult.rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const tenant = tenantResult.rows[0];
    const tenantPool = getTenantPool(tenant.id, tenant.database_name);
    const tenantDbClient = await tenantPool.connect();

    try {
      // Get user from tenant database
      const userResult = await tenantDbClient.query(
        `SELECT 
          u.id, 
          u.email, 
          u.name,
          u.password_hash, 
          u.is_active,
          json_agg(json_build_object('id', r.id, 'role_name', r.role_name)) FILTER (WHERE r.id IS NOT NULL) as roles
        FROM tenant_users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.email = $1 AND u.is_active = TRUE
        GROUP BY u.id`,
        [email],
      );

      if (userResult.rows.length === 0) {
        throw new Error("Invalid email or password");
      }

      const user = userResult.rows[0];

      // Verify password
      const isPasswordValid = await comparePassword(
        password,
        user.password_hash,
      );

      if (!isPasswordValid) {
        throw new Error("Invalid email or password");
      }

      // Get tenant modules
      let assignedModules = [];
      if (Array.isArray(tenant.modules)) {
        assignedModules = [...tenant.modules]; // Copy array
      } else if (typeof tenant.modules === "string") {
        try {
          assignedModules = JSON.parse(tenant.modules);
        } catch (e) {
          assignedModules = [];
        }
      }

      // Ensure all default modules are included
      const defaultModules = [
        "dashboard",
        "calendar",
        "attendance",
        "settings",
      ];
      const hasAllModules = defaultModules.every((m) =>
        assignedModules.includes(m),
      );

      if (assignedModules.length === 0 || !hasAllModules) {
        // Get enabled modules from tenant_modules table
        const modulesResult = await tenantDbClient.query(
          "SELECT module_key FROM tenant_modules WHERE enabled = TRUE ORDER BY module_key;",
        );
        const dbModules = modulesResult.rows.map((row) => row.module_key);

        // Merge with defaults to ensure all are present
        assignedModules = [...new Set([...defaultModules, ...dbModules])];

        // Ensure all modules exist in tenant_modules table
        for (const moduleKey of assignedModules) {
          const label = MODULE_LABELS[moduleKey] || moduleKey;
          await tenantDbClient.query(
            `INSERT INTO tenant_modules (module_key, label, enabled)
             VALUES ($1, $2, TRUE)
             ON CONFLICT (module_key) DO UPDATE SET enabled = TRUE;`,
            [moduleKey, label],
          );
        }

        // Update tenant record if modules changed
        if (
          JSON.stringify(assignedModules.sort()) !==
          JSON.stringify((tenant.modules || []).sort())
        ) {
          await client.query("UPDATE tenant SET modules = $1 WHERE id = $2;", [
            JSON.stringify(assignedModules),
            tenant.id,
          ]);
        }
      }

      // Get user's role permissions from the JSON permissions column on roles
      const rolesResult = await tenantDbClient.query(
        `SELECT r.permissions
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1`,
        [user.id],
      );

      // Flatten all role permissions into a single deduplicated array
      const permissionsSet = new Set();
      for (const row of rolesResult.rows) {
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
      const permissions = [...permissionsSet];
      const roles = user.roles || [];

      // Derive allowed modules from user's permissions and the tenant-enabled modules.
      // This keeps staff access aligned with the frontend route names such as teacher,
      // student, employee, results, and daily_reports.
      const supportedModules = new Set([
        "dashboard",
        "calendar",
        "attendance",
        "settings",
        "teacher",
        "student",
        "employee",
        "results",
        "result_portal",
        "daily_reports",
      ]);

      const userModules = new Set();

      for (const permission of permissions) {
        const parts = String(permission).split(".");
        if (parts.length > 0) {
          const module = parts[0];
          if (supportedModules.has(module)) {
            userModules.add(module);
          }
        }
      }

      // Ensure tenant-enabled modules remain available when a user has matching permissions.
      for (const module of assignedModules) {
        if (supportedModules.has(String(module).toLowerCase())) {
          userModules.add(String(module).toLowerCase());
        }
      }

      // Ensure user has access to dashboard if they have any permission.
      if (permissions.length > 0) {
        userModules.add("dashboard");
      }

      // Convert to array
      const userAssignedModules = Array.from(userModules);

      // Verify modules are also enabled at tenant level
      const finalModules = userAssignedModules.filter((m) =>
        assignedModules.includes(m),
      );

      console.log(
        `[Staff Login] User ${user.email} roles: ${roles.map((r) => r.role_name).join(", ")}`,
      );
      console.log(
        `[Staff Login] User ${user.email} permissions: ${permissions.join(", ")}`,
      );
      console.log(
        `[Staff Login] User ${user.email} assigned modules: ${finalModules.join(", ")}`,
      );

      // Generate token
      const token = generateToken(
        {
          id: user.id,
          email: user.email,
          name: user.name || email.split("@")[0],
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          databaseName: tenant.database_name,
          roles: roles.map((r) => r.role_name),
          permissions: permissions,
          modules: finalModules,
          type: "staff",
        },
        process.env.JWT_EXPIRE_USER || "24h",
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || email.split("@")[0],
          roles: roles,
          permissions: permissions,
          modules: finalModules,
          tenantSlug: tenant.slug,
          type: "staff",
        },
      };
    } finally {
      tenantDbClient.release();
    }
  } finally {
    client.release();
  }
}

/**
 * Unified Login - Works for Admin, Tenant, and Staff
 */
async function unifiedLogin(email, password, tenantSlug = null) {
  // Try admin login first (no tenantSlug needed)
  if (!tenantSlug) {
    try {
      const result = await adminLogin(email, password);
      return {
        success: true,
        data: result,
        userType: "admin",
      };
    } catch (e) {
      // Not an admin, continue to next check
    }
  }

  // If tenantSlug provided, try tenant login first, then staff login
  if (tenantSlug) {
    try {
      const result = await tenantLogin(tenantSlug, email, password);
      return {
        success: true,
        data: result,
        userType: "tenant",
      };
    } catch (e) {
      // Not a tenant, try staff login
    }

    try {
      const result = await staffLogin(tenantSlug, email, password);
      return {
        success: true,
        data: result,
        userType: "staff",
      };
    } catch (e) {
      throw new Error("Invalid email or password");
    }
  }

  throw new Error("Invalid email or password");
}

/**
 * Change Password for Tenant
 */
async function changeTenantPassword(tenantId, oldPassword, newPassword) {
  const client = await centralPool.connect();

  try {
    // Get tenant details
    const result = await client.query(
      "SELECT * FROM tenant WHERE id = $1 AND is_active = TRUE;",
      [tenantId],
    );

    if (result.rows.length === 0) {
      throw new Error("Tenant not found");
    }

    const tenant = result.rows[0];

    // Verify old password
    const isPasswordValid = await comparePassword(
      oldPassword,
      tenant.password_hash,
    );
    if (!isPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await client.query(
      "UPDATE tenant SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
      [newPasswordHash, tenantId],
    );

    return { success: true, message: "Password changed successfully" };
  } finally {
    client.release();
  }
}

/**
 * Change Email for Tenant
 */
async function changeTenantEmail(tenantId, newEmail, password) {
  const client = await centralPool.connect();

  try {
    // Get tenant details
    const result = await client.query(
      "SELECT * FROM tenant WHERE id = $1 AND is_active = TRUE;",
      [tenantId],
    );

    if (result.rows.length === 0) {
      throw new Error("Tenant not found");
    }

    const tenant = result.rows[0];

    // Verify password for security
    const isPasswordValid = await comparePassword(
      password,
      tenant.password_hash,
    );
    if (!isPasswordValid) {
      throw new Error("Password is incorrect");
    }

    // Check if email already exists
    const emailCheck = await client.query(
      "SELECT id FROM tenant WHERE email = $1 AND id != $2;",
      [newEmail, tenantId],
    );

    if (emailCheck.rows.length > 0) {
      throw new Error("Email already in use");
    }

    // Update email
    await client.query(
      "UPDATE tenant SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
      [newEmail, tenantId],
    );

    return { success: true, message: "Email changed successfully" };
  } finally {
    client.release();
  }
}

/**
 * Change Password for Staff/User
 */
async function changeStaffPassword(tenantId, userId, oldPassword, newPassword) {
  const client = await centralPool.connect();

  try {
    // Get tenant details
    const tenantResult = await client.query(
      "SELECT * FROM tenant WHERE id = $1 AND is_active = TRUE;",
      [tenantId],
    );

    if (tenantResult.rows.length === 0) {
      throw new Error("Tenant not found");
    }

    const tenant = tenantResult.rows[0];
    const tenantPool = getTenantPool(tenantId, tenant.database_name);
    const tenantDbClient = await tenantPool.connect();

    try {
      // Get user details
      const userResult = await tenantDbClient.query(
        "SELECT * FROM tenant_users WHERE id = $1 AND is_active = TRUE;",
        [userId],
      );

      if (userResult.rows.length === 0) {
        throw new Error("User not found");
      }

      const user = userResult.rows[0];

      // Verify old password
      const isPasswordValid = await comparePassword(
        oldPassword,
        user.password_hash,
      );
      if (!isPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      await tenantDbClient.query(
        "UPDATE tenant_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
        [newPasswordHash, userId],
      );

      return { success: true, message: "Password changed successfully" };
    } finally {
      tenantDbClient.release();
    }
  } finally {
    client.release();
  }
}

/**
 * Change Email for Staff/User
 */
async function changeStaffEmail(tenantId, userId, newEmail, password) {
  const client = await centralPool.connect();

  try {
    // Get tenant details
    const tenantResult = await client.query(
      "SELECT * FROM tenant WHERE id = $1 AND is_active = TRUE;",
      [tenantId],
    );

    if (tenantResult.rows.length === 0) {
      throw new Error("Tenant not found");
    }

    const tenant = tenantResult.rows[0];
    const tenantPool = getTenantPool(tenantId, tenant.database_name);
    const tenantDbClient = await tenantPool.connect();

    try {
      // Get user details
      const userResult = await tenantDbClient.query(
        "SELECT * FROM tenant_users WHERE id = $1 AND is_active = TRUE;",
        [userId],
      );

      if (userResult.rows.length === 0) {
        throw new Error("User not found");
      }

      const user = userResult.rows[0];

      // Verify password for security
      const isPasswordValid = await comparePassword(
        password,
        user.password_hash,
      );
      if (!isPasswordValid) {
        throw new Error("Password is incorrect");
      }

      // Check if email already exists
      const emailCheck = await tenantDbClient.query(
        "SELECT id FROM tenant_users WHERE email = $1 AND id != $2;",
        [newEmail, userId],
      );

      if (emailCheck.rows.length > 0) {
        throw new Error("Email already in use");
      }

      // Update email
      await tenantDbClient.query(
        "UPDATE tenant_users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
        [newEmail, userId],
      );

      return { success: true, message: "Email changed successfully" };
    } finally {
      tenantDbClient.release();
    }
  } finally {
    client.release();
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  adminLogin,
  tenantLogin,
  staffLogin,
  unifiedLogin,
  changeTenantPassword,
  changeTenantEmail,
  changeStaffPassword,
  changeStaffEmail,
  createTenant,
  getAllTenants,
  getTenantById,
  updateTenant,
  updateTenantStatus,
  deleteTenant,
};
