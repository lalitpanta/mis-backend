const roleService = require("../services/role.service");

class RoleController {
  /**
   * Create a new role
   */
  createRole = async (req, res, next) => {
    try {
      const { role_name, description, permissions } = req.body;

      if (!role_name) {
        return res.status(400).json({ error: "Role name is required" });
      }

      const result = await roleService.createRole({ role_name, description, permissions }, req);
      return res.status(201).json({
        message: "Role created successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get all roles
   */
  getAllRoles = async (req, res, next) => {
    try {
      const roles = await roleService.getAllRoles(req);
      return res.status(200).json({
        message: "Roles retrieved successfully",
        data: roles,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get role by ID with permissions
   */
  getRoleById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const role = await roleService.getRoleWithPermissions(id, req);

      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }

      return res.status(200).json({
        message: "Role retrieved successfully",
        data: role,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update a role
   */
  updateRole = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role_name, description, permissions } = req.body;

      const result = await roleService.updateRole(id, { role_name, description, permissions }, req);

      if (!result) {
        return res.status(404).json({ error: "Role not found" });
      }

      return res.status(200).json({
        message: "Role updated successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete a role
   */
  deleteRole = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await roleService.deleteRole(id, req);

      if (!result) {
        return res.status(404).json({ error: "Role not found or is a system role" });
      }

      return res.status(200).json({
        message: "Role deleted successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Add permissions to a role
   */
  addPermissionsToRole = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { permission_ids } = req.body;

      if (!permission_ids || !Array.isArray(permission_ids)) {
        return res.status(400).json({ error: "permission_ids must be an array" });
      }

      const result = await roleService.addPermissionsToRole(id, permission_ids, req);

      return res.status(200).json({
        message: "Permissions added to role successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new RoleController();
