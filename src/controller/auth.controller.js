const {
  adminLogin,
  tenantLogin,
  staffLogin,
  unifiedLogin,
  changeTenantPassword,
  changeTenantEmail,
  changeStaffPassword,
  changeStaffEmail,
  createTenant,
  getAllTenants,
  getTenantById,
  updateTenantStatus,
  updateTenant,
  deleteTenant,
  permanentlyDeleteTenant,
} = require("../services/auth.service");

/**
 * Admin Login Controller
 */
async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await adminLogin(email, password);
    res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: result,
    });
  } catch (error) {
    console.error("Admin login error:", error.message);
    res.status(401).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
}

/**
 * Tenant Login Controller
 */
async function loginTenant(req, res) {
  try {
    const { tenantSlug, email, password } = req.body;

    if (!tenantSlug || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Tenant name/slug, email, and password are required",
      });
    }

    const result = await tenantLogin(tenantSlug, email, password);
    res.status(200).json({
      success: true,
      message: "Tenant login successful",
      data: result,
    });
  } catch (error) {
    console.error("Tenant login error:", error.message);
    res.status(401).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
}

/**
 * Staff/User Login Controller
 */
async function loginStaff(req, res) {
  try {
    const { tenantSlug, email, password } = req.body;

    if (!tenantSlug || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Tenant name/slug, email, and password are required",
      });
    }

    const result = await staffLogin(tenantSlug, email, password);
    res.status(200).json({
      success: true,
      message: "Staff login successful",
      data: result,
    });
  } catch (error) {
    console.error("Staff login error:", error.message);
    res.status(401).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
}

/**
 * Create Tenant Controller (Admin only)
 */
async function createNewTenant(req, res) {
  try {
    const { name, email, password, databaseName, slug, modules } = req.body;

    if (!name || !email || !password || !databaseName) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const tenant = await createTenant(
      name,
      email,
      password,
      databaseName,
      slug,
      modules,
    );
    res.status(201).json({
      success: true,
      message: "Tenant created successfully",
      data: {
        ...tenant,
        loginUrl: `${process.env.FRONTEND_BASE_URL || "http://localhost:5174"}/login`,
        plainPassword: password,
      },
    });
  } catch (error) {
    console.error("Create tenant error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create tenant",
    });
  }
}

/**
 * Get All Tenants Controller (Admin only)
 */
async function getAllTenantsController(req, res) {
  try {
    const tenants = await getAllTenants();
    res.status(200).json({
      success: true,
      message: "Tenants fetched successfully",
      data: tenants,
    });
  } catch (error) {
    console.error("Get tenants error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch tenants",
    });
  }
}

/**
 * Get Tenant by ID Controller
 */
async function getTenantByIdController(req, res) {
  try {
    const { id } = req.params;
    const tenant = await getTenantById(id);
    res.status(200).json({
      success: true,
      message: "Tenant fetched successfully",
      data: tenant,
    });
  } catch (error) {
    console.error("Get tenant error:", error.message);
    res.status(404).json({
      success: false,
      message: error.message || "Tenant not found",
    });
  }
}

/**
 * Update Tenant Status Controller (Admin only)
 */
async function updateTenantStatusController(req, res) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    const tenant = await updateTenantStatus(id, isActive);
    res.status(200).json({
      success: true,
      message: "Tenant status updated",
      data: tenant,
    });
  } catch (error) {
    console.error("Update tenant status error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update tenant status",
    });
  }
}

/**
 * Update Tenant Controller (Admin only)
 */
async function updateTenantController(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const tenant = await updateTenant(id, updates);
    res.status(200).json({
      success: true,
      message: "Tenant updated successfully",
      data: tenant,
    });
  } catch (error) {
    console.error("Update tenant error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update tenant",
    });
  }
}

/**
 * Delete Tenant Controller (Admin only)
 */
async function deleteTenantController(req, res) {
  try {
    const { id } = req.params;
    const tenant = await deleteTenant(id);
    res.status(200).json({
      success: true,
      message: "Tenant deleted",
      data: tenant,
    });
  } catch (error) {
    console.error("Delete tenant error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to delete tenant",
    });
  }
}

/**
 * Permanently Delete Tenant Controller (Admin only)
 * Requires confirmation - drops database and removes tenant record
 */
async function permanentlyDeleteTenantController(req, res) {
  try {
    const { id } = req.params;
    const tenant = await permanentlyDeleteTenant(id);
    res.status(200).json({
      success: true,
      message: "Tenant permanently deleted",
      data: tenant,
    });
  } catch (error) {
    console.error("Permanently delete tenant error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to permanently delete tenant",
    });
  }
}

/**
 * Unified Login Controller (Admin, Tenant, or Staff)
 */
async function unifiedLoginController(req, res) {
  try {
    const { email, password, tenantSlug } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await unifiedLogin(email, password, tenantSlug);

    res.status(200).json({
      success: true,
      message: `${result.userType.charAt(0).toUpperCase() + result.userType.slice(1)} login successful`,
      data: result.data,
      userType: result.userType,
    });
  } catch (error) {
    console.error("Unified login error:", error.message);
    res.status(401).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
}

/**
 * Change Tenant Password Controller
 */
async function changeTenantPasswordController(req, res) {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const tenantId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const result = await changeTenantPassword(
      tenantId,
      oldPassword,
      newPassword,
    );
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Change tenant password error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to change password",
    });
  }
}

/**
 * Change Tenant Email Controller
 */
async function changeTenantEmailController(req, res) {
  try {
    const { newEmail, password } = req.body;
    const tenantId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!newEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Simple email validation
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const result = await changeTenantEmail(tenantId, newEmail, password);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Change tenant email error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to change email",
    });
  }
}

/**
 * Change Staff/User Password Controller
 */
async function changeStaffPasswordController(req, res) {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const result = await changeStaffPassword(
      tenantId,
      userId,
      oldPassword,
      newPassword,
    );
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Change staff password error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to change password",
    });
  }
}

/**
 * Change Staff/User Email Controller
 */
async function changeStaffEmailController(req, res) {
  try {
    const { newEmail, password } = req.body;
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!newEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Simple email validation
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const result = await changeStaffEmail(tenantId, userId, newEmail, password);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Change staff email error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to change email",
    });
  }
}

module.exports = {
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
};
