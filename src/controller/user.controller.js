const userService = require("../services/user.service");

class UserController {
  /**
   * Create a new user with roles
   */
  createUser = async (req, res, next) => {
    try {
      const {
        email,
        password,
        role_ids,
        name,
        phone,
        department_store,
        authority_mode,
        module_access,
        teacher_id,
        student_id,
        employee_id,
        section_id,
      } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      // Create user
      const user = await userService.createUser(
        {
          email,
          password,
          name,
          phone,
          department_store,
          authority_mode,
          module_access,
          teacher_id,
          student_id,
          employee_id,
          section_id,
        },
        req,
      );

      // Assign roles if provided
      let userWithRoles = user;
      if (role_ids && Array.isArray(role_ids) && role_ids.length > 0) {
        userWithRoles = await userService.assignRolesToUser(
          user.id,
          role_ids,
          req,
        );
      }

      // Trigger email notification for new user
      if (userWithRoles && userWithRoles.email) {
        const emailService = require("../services/email.service");
        // Do not await to avoid blocking the response
        emailService
          .sendEmailForEvent(req, "user_created", {
            to: userWithRoles.email,
            name: userWithRoles.name || "User",
            username: userWithRoles.email,
            password: password, // Send raw password securely only on creation
          })
          .catch((err) => console.error("Email error:", err));
      }

      // Trigger WhatsApp notification for new user
      if (userWithRoles) {
        const whatsappService = require("../services/whatsapp.service");
        whatsappService
          .sendWhatsAppForEvent(req, "user_created", {
            to: userWithRoles.phone,
            name: userWithRoles.name || "User",
            username: userWithRoles.email,
            password: password,
          })
          .catch((err) => console.error("WhatsApp error:", err));
      }

      return res.status(201).json({
        message: "User created successfully",
        data: userWithRoles,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get all users with their roles
   */
  getAllUsers = async (req, res, next) => {
    try {
      const users = await userService.getAllUsers(req);
      return res.status(200).json({
        message: "Users retrieved successfully",
        data: users,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get users with role 'Teacher' for dropdowns
   */
  getTeachers = async (req, res, next) => {
    try {
      const teachers = await userService.getUsersByRole("Teacher", req);
      return res
        .status(200)
        .json({ message: "Teachers retrieved", data: teachers });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get user by ID
   */
  getUserById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id, req);

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
   * Update user
   */
  updateUser = async (req, res, next) => {
    try {
      const { id } = req.params;

      // Allow updating user fields like name/phone/linked ids/etc.
      // user.service.updateUser() will ignore undefined fields.
      const userData = req.body;

      const user = await userService.updateUser(id, userData, req);

      return res.status(200).json({
        message: "User updated successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Change password (by user themselves)
   */
  changePassword = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "Old password and new password are required" });
      }

      const user = await userService.changePassword(
        id,
        oldPassword,
        newPassword,
        req,
      );

      return res.status(200).json({
        message: "Password changed successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Reset password (admin only)
   */
  resetPassword = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ error: "New password is required" });
      }

      const user = await userService.resetPassword(id, newPassword, req);

      return res.status(200).json({
        message: "Password reset successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete user
   */
  deleteUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = await userService.deleteUser(id, req);

      return res.status(200).json({
        message: "User deleted successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Toggle user active status
   */
  toggleUserActive = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (isActive === undefined) {
        return res.status(400).json({ error: "isActive status is required" });
      }

      const user = await userService.toggleUserActive(id, isActive, req);

      return res.status(200).json({
        message: "User status updated successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Assign roles to user
   */
  assignRolesToUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role_ids } = req.body;

      if (!role_ids || !Array.isArray(role_ids)) {
        return res.status(400).json({ error: "role_ids must be an array" });
      }

      const user = await userService.assignRolesToUser(id, role_ids, req);

      return res.status(200).json({
        message: "Roles assigned successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get current user profile with roles and permissions
   * GET /api/v1/users/me
   */
  getCurrentUserProfile = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userType = req.user?.type;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Handle admin users
      if (userType === "system_admin") {
        return res.status(200).json({
          message: "Current user profile retrieved successfully",
          data: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name || "System Admin",
            type: "admin",
            permissions: [],
            roles: [],
            userType: "admin",
          },
        });
      }

      const user = await userService.getUserWithRolesAndPermissions(
        userId,
        req,
      );

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({
        message: "Current user profile retrieved successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Change password for current authenticated user
   * POST /api/v1/users/me/change-password
   */
  changeOwnPassword = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { oldPassword, newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "Old password and new password are required" });
      }

      const user = await userService.changePassword(
        userId,
        oldPassword,
        newPassword,
        req,
      );

      return res.status(200).json({
        message: "Password changed successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Change email for current authenticated user
   * POST /api/v1/users/me/change-email
   */
  changeOwnEmail = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { newEmail, password } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!newEmail || !password) {
        return res
          .status(400)
          .json({ error: "New email and password are required" });
      }

      const user = await userService.changeEmail(
        userId,
        newEmail,
        password,
        req,
      );

      return res.status(200).json({
        message: "Email changed successfully",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new UserController();
