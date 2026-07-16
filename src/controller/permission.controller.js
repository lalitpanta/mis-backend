const permissionService = require("../services/permission.service");

class PermissionController {
  /**
   * Create a new permission
   */
  createPermission = async (req, res, next) => {
    try {
      const { permission_key, permission_name, description, resource, action } = req.body;

      if (!permission_key || !permission_name) {
        return res.status(400).json({ error: "Permission key and name are required" });
      }

      const result = await permissionService.createPermission(
        { permission_key, permission_name, description, resource, action },
        req
      );

      return res.status(201).json({
        message: "Permission created successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get all permissions
   */
  getAllPermissions = async (req, res, next) => {
    try {
      const permissions = await permissionService.getAllPermissions(req);
      return res.status(200).json({
        message: "Permissions retrieved successfully",
        data: permissions,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get permissions grouped by resource
   */
  getPermissionsByResource = async (req, res, next) => {
    try {
      const permissions = await permissionService.getPermissionsByResource(req);
      return res.status(200).json({
        message: "Permissions retrieved successfully",
        data: permissions,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get permission by ID
   */
  getPermissionById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const permission = await permissionService.getPermissionById(id, req);

      if (!permission) {
        return res.status(404).json({ error: "Permission not found" });
      }

      return res.status(200).json({
        message: "Permission retrieved successfully",
        data: permission,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update a permission
   */
  updatePermission = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { permission_name, description, resource, action } = req.body;

      const result = await permissionService.updatePermission(
        id,
        { permission_name, description, resource, action },
        req
      );

      if (!result) {
        return res.status(404).json({ error: "Permission not found" });
      }

      return res.status(200).json({
        message: "Permission updated successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete a permission
   */
  deletePermission = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await permissionService.deletePermission(id, req);

      if (!result) {
        return res.status(404).json({ error: "Permission not found" });
      }

      return res.status(200).json({
        message: "Permission deleted successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new PermissionController();
