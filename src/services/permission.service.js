const { getTenantPool } = require("../config/tenantDb");

class PermissionService {
  /**
   * Create a new permission
   */
  createPermission = async (permissionData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        INSERT INTO permissions (permission_key, permission_name, description, resource, action)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await pool.query(query, [
        permissionData.permission_key,
        permissionData.permission_name,
        permissionData.description || null,
        permissionData.resource || null,
        permissionData.action || null,
      ]);
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to create permission: ${err.message}`);
    }
  };

  /**
   * Get all permissions
   */
  getAllPermissions = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT *
        FROM permissions
        ORDER BY resource, action, created_at
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch permissions: ${err.message}`);
    }
  };

  /**
   * Get permissions grouped by resource
   */
  getPermissionsByResource = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT resource, json_agg(json_build_object(
          'id', id,
          'permission_key', permission_key,
          'permission_name', permission_name,
          'description', description,
          'action', action
        )) as permissions
        FROM permissions
        GROUP BY resource
        ORDER BY resource
      `;
      const result = await pool.query(query);
      return result.rows;
    } catch (err) {
      throw new Error(
        `Failed to fetch permissions by resource: ${err.message}`,
      );
    }
  };

  /**
   * Get permission by ID
   */
  getPermissionById = async (permissionId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `SELECT * FROM permissions WHERE id = $1`;
      const result = await pool.query(query, [permissionId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch permission: ${err.message}`);
    }
  };

  /**
   * Update a permission
   */
  updatePermission = async (permissionId, updateData, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        UPDATE permissions
        SET permission_name = COALESCE($1, permission_name),
            description = COALESCE($2, description),
            resource = COALESCE($3, resource),
            action = COALESCE($4, action),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING *
      `;
      const result = await pool.query(query, [
        updateData.permission_name,
        updateData.description,
        updateData.resource,
        updateData.action,
        permissionId,
      ]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update permission: ${err.message}`);
    }
  };

  /**
   * Delete a permission
   */
  deletePermission = async (permissionId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `DELETE FROM permissions WHERE id = $1 RETURNING *`;
      const result = await pool.query(query, [permissionId]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete permission: ${err.message}`);
    }
  };

  /**
   * Seed default permissions
   */
  seedDefaultPermissions = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");

      const defaultPermissions = [
        // Dashboard permissions
        {
          permission_key: "dashboard.view",
          permission_name: "View Dashboard",
          resource: "dashboard",
          action: "view",
        },

        // Calendar permissions
        {
          permission_key: "calendar.view",
          permission_name: "View Calendar",
          resource: "calendar",
          action: "view",
        },
        {
          permission_key: "calendar.create",
          permission_name: "Create Calendar",
          resource: "calendar",
          action: "create",
        },
        {
          permission_key: "calendar.edit",
          permission_name: "Edit Calendar",
          resource: "calendar",
          action: "edit",
        },
        {
          permission_key: "calendar.delete",
          permission_name: "Delete Calendar",
          resource: "calendar",
          action: "delete",
        },

        // Attendance permissions
        {
          permission_key: "attendance.view",
          permission_name: "View Attendance",
          resource: "attendance",
          action: "view",
        },
        {
          permission_key: "attendance.create",
          permission_name: "Mark Attendance",
          resource: "attendance",
          action: "create",
        },
        {
          permission_key: "attendance.edit",
          permission_name: "Edit Attendance",
          resource: "attendance",
          action: "edit",
        },
        {
          permission_key: "attendance.delete",
          permission_name: "Delete Attendance",
          resource: "attendance",
          action: "delete",
        },

        // User management permissions
        {
          permission_key: "users.view",
          permission_name: "View Users",
          resource: "users",
          action: "view",
        },
        {
          permission_key: "users.create",
          permission_name: "Create Users",
          resource: "users",
          action: "create",
        },
        {
          permission_key: "users.edit",
          permission_name: "Edit Users",
          resource: "users",
          action: "edit",
        },
        {
          permission_key: "users.delete",
          permission_name: "Delete Users",
          resource: "users",
          action: "delete",
        },

        // Role management permissions
        {
          permission_key: "roles.view",
          permission_name: "View Roles",
          resource: "roles",
          action: "view",
        },
        {
          permission_key: "roles.create",
          permission_name: "Create Roles",
          resource: "roles",
          action: "create",
        },
        {
          permission_key: "roles.edit",
          permission_name: "Edit Roles",
          resource: "roles",
          action: "edit",
        },
        {
          permission_key: "roles.delete",
          permission_name: "Delete Roles",
          resource: "roles",
          action: "delete",
        },

        // Settings permissions
        {
          permission_key: "settings.view",
          permission_name: "View Settings",
          resource: "settings",
          action: "view",
        },
        {
          permission_key: "settings.edit",
          permission_name: "Edit Settings",
          resource: "settings",
          action: "edit",
        },

        // Teacher permissions
        {
          permission_key: "teacher.view",
          permission_name: "View Teachers",
          resource: "teacher",
          action: "view",
        },
        {
          permission_key: "teacher.create",
          permission_name: "Create Teachers",
          resource: "teacher",
          action: "create",
        },
        {
          permission_key: "teacher.edit",
          permission_name: "Edit Teachers",
          resource: "teacher",
          action: "edit",
        },
        {
          permission_key: "teacher.delete",
          permission_name: "Delete Teachers",
          resource: "teacher",
          action: "delete",
        },
        {
          permission_key: "teacher.export",
          permission_name: "Export Teachers",
          resource: "teacher",
          action: "export",
        },
        {
          permission_key: "teacher.upload_documents",
          permission_name: "Upload Teacher Documents",
          resource: "teacher",
          action: "upload_documents",
        },
        {
          permission_key: "teacher.download_documents",
          permission_name: "Download Teacher Documents",
          resource: "teacher",
          action: "download_documents",
        },

        // Student permissions
        {
          permission_key: "student.view",
          permission_name: "View Students",
          resource: "student",
          action: "view",
        },
        {
          permission_key: "student.create",
          permission_name: "Create Students",
          resource: "student",
          action: "create",
        },
        {
          permission_key: "student.edit",
          permission_name: "Edit Students",
          resource: "student",
          action: "edit",
        },
        {
          permission_key: "student.delete",
          permission_name: "Delete Students",
          resource: "student",
          action: "delete",
        },
        {
          permission_key: "student.export",
          permission_name: "Export Students",
          resource: "student",
          action: "export",
        },
        {
          permission_key: "student.upload_files",
          permission_name: "Upload Student Files",
          resource: "student",
          action: "upload_files",
        },
        {
          permission_key: "student.view_documents",
          permission_name: "View Student Documents",
          resource: "student",
          action: "view_documents",
        },

        // Employee permissions
        {
          permission_key: "employee.view",
          permission_name: "View Employees",
          resource: "employee",
          action: "view",
        },
        {
          permission_key: "employee.create",
          permission_name: "Create Employees",
          resource: "employee",
          action: "create",
        },
        {
          permission_key: "employee.edit",
          permission_name: "Edit Employees",
          resource: "employee",
          action: "edit",
        },
        {
          permission_key: "employee.delete",
          permission_name: "Delete Employees",
          resource: "employee",
          action: "delete",
        },
        {
          permission_key: "employee.export",
          permission_name: "Export Employees",
          resource: "employee",
          action: "export",
        },
        {
          permission_key: "employee.upload_documents",
          permission_name: "Upload Employee Documents",
          resource: "employee",
          action: "upload_documents",
        },
        {
          permission_key: "employee.download_documents",
          permission_name: "Download Employee Documents",
          resource: "employee",
          action: "download_documents",
        },
      ];

      for (const permission of defaultPermissions) {
        await pool.query(
          `INSERT INTO permissions (permission_key, permission_name, description, resource, action)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (permission_key) DO NOTHING`,
          [
            permission.permission_key,
            permission.permission_name,
            null,
            permission.resource,
            permission.action,
          ],
        );
      }
    } catch (err) {
      console.error("Error seeding default permissions:", err.message);
    }
  };
}

const permissionService = new PermissionService();
module.exports = permissionService;
