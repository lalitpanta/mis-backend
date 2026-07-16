const express = require("express");
const router = express.Router();
const permissionController = require("../../controller/permission.controller");

/**
 * @route   POST /api/v1/permissions
 * @desc    Create a new permission
 * @access  Private (Tenant Admin/System Admin)
 */
router.post("/", permissionController.createPermission);

/**
 * @route   GET /api/v1/permissions
 * @desc    Get all permissions
 * @access  Private
 */
router.get("/", permissionController.getAllPermissions);

/**
 * @route   GET /api/v1/permissions/by-resource
 * @desc    Get permissions grouped by resource
 * @access  Private
 */
router.get("/by-resource", permissionController.getPermissionsByResource);

/**
 * @route   GET /api/v1/permissions/:id
 * @desc    Get permission by ID
 * @access  Private
 */
router.get("/:id", permissionController.getPermissionById);

/**
 * @route   PUT /api/v1/permissions/:id
 * @desc    Update a permission
 * @access  Private (Tenant Admin/System Admin)
 */
router.put("/:id", permissionController.updatePermission);

/**
 * @route   DELETE /api/v1/permissions/:id
 * @desc    Delete a permission
 * @access  Private (Tenant Admin/System Admin)
 */
router.delete("/:id", permissionController.deletePermission);

module.exports = router;
