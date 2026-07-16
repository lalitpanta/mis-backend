const express = require("express");
const router = express.Router();
const {
  loginAdmin,
  loginTenant,
  loginStaff,
  unifiedLoginController,
  changeTenantPasswordController,
  changeTenantEmailController,
  changeStaffPasswordController,
  changeStaffEmailController,
  createNewTenant,
  getAllTenantsController,
  getTenantByIdController,
  updateTenantStatusController,
  updateTenantController,
  deleteTenantController,
  permanentlyDeleteTenantController,
} = require("../../controller/auth.controller");
const {
  authenticateToken,
  requireAdmin,
} = require("../../middleware/auth.middleware");

/**
 * Public routes
 */

// Admin login
router.post("/admin/login", loginAdmin);

// Tenant login
router.post("/tenant/login", loginTenant);

// Staff/User login
router.post("/staff/login", loginStaff);

// Unified login (Admin, Tenant, or Staff)
router.post("/login", unifiedLoginController);

/**
 * Protected routes (require authentication)
 */

// Change tenant password
router.post(
  "/tenant/change-password",
  authenticateToken,
  changeTenantPasswordController,
);

// Change tenant email
router.post(
  "/tenant/change-email",
  authenticateToken,
  changeTenantEmailController,
);

// Change staff/user password
router.post(
  "/staff/change-password",
  authenticateToken,
  changeStaffPasswordController,
);

// Change staff/user email
router.post(
  "/staff/change-email",
  authenticateToken,
  changeStaffEmailController,
);

// Create new tenant (admin only)
router.post("/tenant/create", authenticateToken, requireAdmin, createNewTenant);

// Get all tenants (admin only)
router.get(
  "/tenant/all",
  authenticateToken,
  requireAdmin,
  getAllTenantsController,
);

// Get tenant by ID
router.get("/tenant/:id", authenticateToken, getTenantByIdController);

// Update tenant status (admin only)
router.patch(
  "/tenant/:id/status",
  authenticateToken,
  requireAdmin,
  updateTenantStatusController,
);

// Update tenant details (admin only)
router.patch(
  "/tenant/:id",
  authenticateToken,
  requireAdmin,
  updateTenantController,
);

// Permanently delete tenant - drops database (admin only) - MUST come before generic /tenant/:id delete
router.delete(
  "/tenant/:id/permanent",
  authenticateToken,
  requireAdmin,
  permanentlyDeleteTenantController,
);

// Delete tenant (admin only)
router.delete(
  "/tenant/:id",
  authenticateToken,
  requireAdmin,
  deleteTenantController,
);

module.exports = router;
