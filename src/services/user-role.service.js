const { getTenantPool } = require("../config/tenantDb");

class UserRoleService {
  /**
   * Assign roles to a user
   */
  assignRolesToUser = async (userId, roleIds, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      
      // Get current user ID for audit trail
      const currentUserId = req?.user?.id;

      // First, delete existing roles
      await pool.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);

      // Then insert new roles
      if (roleIds && roleIds.length > 0) {
        const values = roleIds.map((roleId, idx) => `($1, $${idx + 2}, $${idx + 2 + roleIds.length})`).join(", ");
        const query = `
          INSERT INTO user_roles (user_id, role_id, assigned_by)
          VALUES ${values}
          ON CONFLICT (user_id, role_id) DO NOTHING
        `;
        const params = [userId, ...roleIds, currentUserId];
        await pool.query(query, params);
      }

      return await this.getUserWithRoles(userId, req);
    } catch (err) {
      throw new Error(`Failed to assign roles to user: ${err.message}`);
    }
  };

  /**
   * Get user with all assigned roles
   */
  getUserWithRoles = async (userId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT u.id, u.email, u.role, u.is_active,
               json_agg(json_build_object(
                 'id', r.id,
                 'role_name', r.role_name,
                 'description', r.description
               )) as roles
        FROM tenant_users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id, u.email, u.role, u.is_active
      `;
      const result = await pool.query(query, [userId]);
      const user = result.rows[0];
      if (user && user.roles[0].id === null) {
        user.roles = [];
      }
      return user || null;
    } catch (err) {
      throw new Error(`Failed to fetch user with roles: ${err.message}`);
    }
  };

  /**
   * Get all users with their roles
   */
  getAllUsersWithRoles = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT u.id, u.email, u.role, u.is_active,
               json_agg(json_build_object(
                 'id', r.id,
                 'role_name', r.role_name,
                 'description', r.description
               ) ORDER BY r.role_name) as roles
        FROM tenant_users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        GROUP BY u.id, u.email, u.role, u.is_active
        ORDER BY u.created_at DESC
      `;
      const result = await pool.query(query);
      return result.rows.map(user => ({
        ...user,
        roles: user.roles[0]?.id ? user.roles : []
      }));
    } catch (err) {
      throw new Error(`Failed to fetch users with roles: ${err.message}`);
    }
  };

  /**
   * Remove a role from a user
   */
  removeRoleFromUser = async (userId, roleId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 RETURNING *`;
      await pool.query(query, [userId, roleId]);
      return await this.getUserWithRoles(userId, req);
    } catch (err) {
      throw new Error(`Failed to remove role from user: ${err.message}`);
    }
  };

  /**
   * Get user's permissions based on their roles
   */
  getUserPermissions = async (userId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT DISTINCT p.id, p.permission_key, p.permission_name, p.resource, p.action
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY p.resource, p.action
      `;
      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to fetch user permissions: ${err.message}`);
    }
  };

  /**
   * Check if user has a specific permission
   */
  hasPermission = async (userId, permissionKey, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      const query = `
        SELECT COUNT(*) > 0 as has_permission
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1 AND p.permission_key = $2
      `;
      const result = await pool.query(query, [userId, permissionKey]);
      return result.rows[0]?.has_permission || false;
    } catch (err) {
      throw new Error(`Failed to check permission: ${err.message}`);
    }
  };
}

const userRoleService = new UserRoleService();
module.exports = userRoleService;
