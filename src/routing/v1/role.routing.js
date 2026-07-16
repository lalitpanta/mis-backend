const express = require("express");
const router = express.Router();
const roleController = require("../../controller/role.controller");

/**
 * @route   POST /api/v1/roles
 * @desc    Create a new role
 * @access  Private (Tenant Admin)
 */
router.post("/", roleController.createRole);

/**
 * @route   GET /api/v1/roles
 * @desc    Get all roles
 * @access  Private
 */
router.get("/", roleController.getAllRoles);

/**
 * @route   GET /api/v1/roles/:id
 * @desc    Get role by ID with permissions
 * @access  Private
 */
router.get("/:id", roleController.getRoleById);

/**
 * @route   PUT /api/v1/roles/:id
 * @desc    Update a role
 * @access  Private (Tenant Admin)
 */
router.put("/:id", roleController.updateRole);

/**
 * @route   DELETE /api/v1/roles/:id
 * @desc    Delete a role
 * @access  Private (Tenant Admin)
 */
router.delete("/:id", roleController.deleteRole);

/**
 * @route   POST /api/v1/roles/:id/permissions
 * @desc    Add permissions to a role
 * @access  Private (Tenant Admin)
 */
router.post("/:id/permissions", roleController.addPermissionsToRole);

module.exports = router;
