const { getTenantPool } = require("../config/tenantDb");

class RoleService {
  /**
   * Create a new role
   */
  createRole = async (roleData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const permissions = Array.isArray(roleData.permissions)
        ? roleData.permissions
        : [];
      const query = `
        INSERT INTO roles (role_name, description, is_system, permissions)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const result = await pool.query(query, [
        roleData.role_name,
        roleData.description || null,
        false,
        JSON.stringify(permissions),
      ]);
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to create role: ${err.message}`);
    }
  };

  /**
   * Get all roles
   */
  getAllRoles = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT r.*,
          json_array_length(COALESCE(r.permissions, '[]'::json)) as permission_count
        FROM roles r
        ORDER BY r.created_at DESC
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch roles: ${err.message}`);
    }
  };

  /**
   * Get role by ID
   */
  getRoleById = async (roleId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `SELECT * FROM roles WHERE id = $1`;
      const result = await pool.query(query, [roleId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch role: ${err.message}`);
    }
  };

  /**
   * Get role with permissions
   */
  getRoleWithPermissions = async (roleId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `SELECT * FROM roles WHERE id = $1`;
      const result = await pool.query(query, [roleId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch role with permissions: ${err.message}`);
    }
  };

  /**
   * Update a role
   */
  updateRole = async (roleId, updateData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const permissions = Array.isArray(updateData.permissions)
        ? updateData.permissions
        : undefined;
      const query = `
        UPDATE roles
        SET role_name = COALESCE($1, role_name),
            description = COALESCE($2, description),
            permissions = COALESCE($3, permissions),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `;
      const result = await pool.query(query, [
        updateData.role_name,
        updateData.description,
        permissions !== undefined ? JSON.stringify(permissions) : null,
        roleId,
      ]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update role: ${err.message}`);
    }
  };

  /**
   * Delete a role
   */
  deleteRole = async (roleId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `DELETE FROM roles WHERE id = $1 AND is_system = false RETURNING *`;
      const result = await pool.query(query, [roleId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete role: ${err.message}`);
    }
  };

  /**
   * Add permissions to a role (sets the permissions JSON array)
   */
  addPermissionsToRole = async (roleId, permissions, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const permArray = Array.isArray(permissions) ? permissions : [];
      const query = `
        UPDATE roles
        SET permissions = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      const result = await pool.query(query, [
        JSON.stringify(permArray),
        roleId,
      ]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to add permissions to role: ${err.message}`);
    }
  };

  /**
   * Seed default roles
   */
  seedDefaultRoles = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");

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
            "teacher.view",
            "teacher.create",
            "teacher.edit",
            "teacher.delete",
            "teacher.export",
            "teacher.upload_documents",
            "teacher.download_documents",
            "student.view",
            "student.create",
            "student.edit",
            "student.delete",
            "student.export",
            "student.upload_files",
            "student.view_documents",
            "employee.view",
            "employee.create",
            "employee.edit",
            "employee.delete",
            "employee.export",
            "employee.upload_documents",
            "employee.download_documents",
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
            "teacher.view",
            "teacher.download_documents",
            "student.view",
            "employee.view",
            "employee.download_documents",
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
            "teacher.view",
            "teacher.create",
            "teacher.edit",
            "teacher.delete",
            "teacher.export",
            "teacher.upload_documents",
            "student.view",
            "student.create",
            "student.edit",
            "student.delete",
            "student.export",
            "student.upload_files",
            "employee.view",
            "employee.create",
            "employee.edit",
            "employee.delete",
            "employee.export",
            "employee.upload_documents",
          ],
        },
        {
          role_name: "Student",
          description: "Limited access to view schedules and attendance",
          is_system: true,
          permissions: [
            "dashboard.view",
            "calendar.view",
            "attendance.view",
            "student.view",
            "student.view_documents",
            "employee.view",
          ],
        },
      ];

      for (const role of defaultRoles) {
        await pool.query(
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
    } catch (err) {
      console.error("Error seeding default roles:", err.message);
    }
  };
}

const roleService = new RoleService();
module.exports = roleService;
