const express = require("express");
const router = express.Router();
const userController = require("../../controller/user.controller");

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user with roles
 * @access  Private (Tenant Admin)
 */
router.post("/", userController.createUser);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with their roles
 * @access  Private
 */
router.get("/", userController.getAllUsers);

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile with roles and permissions
 * @access  Private
 */
router.get("/me", userController.getCurrentUserProfile);

/**
 * @route   POST /api/v1/users/me/change-password
 * @desc    Change password for current authenticated user
 * @access  Private
 */
router.post("/me/change-password", userController.changeOwnPassword);

/**
 * @route   POST /api/v1/users/me/change-email
 * @desc    Change email for current authenticated user
 * @access  Private
 */
router.post("/me/change-email", userController.changeOwnEmail);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID with roles
 * @access  Private
 */
router.get("/:id", userController.getUserById);

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Update user (email, active status)
 * @access  Private (Tenant Admin)
 */
router.patch("/:id", userController.updateUser);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete a user
 * @access  Private (Tenant Admin)
 */
router.delete("/:id", userController.deleteUser);

/**
 * @route   PUT /api/v1/users/:id/toggle-active
 * @desc    Toggle user active status
 * @access  Private (Tenant Admin)
 */
router.put("/:id/toggle-active", userController.toggleUserActive);

/**
 * @route   POST /api/v1/users/:id/change-password
 * @desc    Change user password (by user themselves)
 * @access  Private
 */
router.post("/:id/change-password", userController.changePassword);

/**
 * @route   POST /api/v1/users/:id/reset-password
 * @desc    Reset user password (admin only)
 * @access  Private (Tenant Admin)
 */
router.post("/:id/reset-password", userController.resetPassword);

/**
 * @route   POST /api/v1/users/:id/roles
 * @desc    Assign roles to a user
 * @access  Private (Tenant Admin)
 */
router.post("/:id/roles", userController.assignRolesToUser);

module.exports = router;
