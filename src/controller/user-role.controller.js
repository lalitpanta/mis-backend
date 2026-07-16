const userRoleService = require("../services/user-role.service");

class UserRoleController {
  /**
   * Assign roles to a user
   */
  assignRolesToUser = async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { role_ids } = req.body;

      if (!role_ids || !Array.isArray(role_ids)) {
        return res.status(400).json({ error: "role_ids must be an array" });
      }

      const result = await userRoleService.assignRolesToUser(userId, role_ids, req);

      return res.status(200).json({
        message: "Roles assigned to user successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get user with assigned roles
   */
  getUserWithRoles = async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await userRoleService.getUserWithRoles(userId, req);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({
        message: "User retrieved successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get all users with their roles
   */
  getAllUsersWithRoles = async (req, res, next) => {
    try {
      const users = await userRoleService.getAllUsersWithRoles(req);

      return res.status(200).json({
        message: "Users retrieved successfully",
        data: users,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Remove a role from a user
   */
  removeRoleFromUser = async (req, res, next) => {
    try {
      const { userId, roleId } = req.params;

      const result = await userRoleService.removeRoleFromUser(userId, roleId, req);

      return res.status(200).json({
        message: "Role removed from user successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get user's permissions
   */
  getUserPermissions = async (req, res, next) => {
    try {
      const { userId } = req.params;
      const permissions = await userRoleService.getUserPermissions(userId, req);

      return res.status(200).json({
        message: "User permissions retrieved successfully",
        data: permissions,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Check if user has a specific permission
   */
  checkPermission = async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { permission_key } = req.body;

      if (!permission_key) {
        return res.status(400).json({ error: "permission_key is required" });
      }

      const hasPermission = await userRoleService.hasPermission(userId, permission_key, req);

      return res.status(200).json({
        message: "Permission check completed",
        data: { has_permission: hasPermission },
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new UserRoleController();
