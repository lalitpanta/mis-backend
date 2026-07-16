const express = require("express");
const router = express.Router();
const userRoleController = require("../../controller/user-role.controller");

/**
 * @route   GET /api/v1/users-with-roles
 * @desc    Get all users with their assigned roles
 * @access  Private (Tenant Admin)
 */
router.get("/", userRoleController.getAllUsersWithRoles);

/**
 * @route   GET /api/v1/users-with-roles/:userId
 * @desc    Get user with assigned roles
 * @access  Private
 */
router.get("/:userId", userRoleController.getUserWithRoles);

/**
 * @route   POST /api/v1/users-with-roles/:userId/roles
 * @desc    Assign roles to a user
 * @access  Private (Tenant Admin)
 */
router.post("/:userId/roles", userRoleController.assignRolesToUser);

/**
 * @route   DELETE /api/v1/users-with-roles/:userId/roles/:roleId
 * @desc    Remove a role from a user
 * @access  Private (Tenant Admin)
 */
router.delete("/:userId/roles/:roleId", userRoleController.removeRoleFromUser);

/**
 * @route   GET /api/v1/users-with-roles/:userId/permissions
 * @desc    Get user's permissions based on assigned roles
 * @access  Private
 */
router.get("/:userId/permissions", userRoleController.getUserPermissions);

/**
 * @route   POST /api/v1/users-with-roles/:userId/check-permission
 * @desc    Check if user has a specific permission
 * @access  Private
 */
router.post("/:userId/check-permission", userRoleController.checkPermission);

module.exports = router;
