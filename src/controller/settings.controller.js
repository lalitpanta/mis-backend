const settingsService = require("../services/settings.service");

class SettingsController {
  /**
   * Get all settings
   * GET /api/settings
   */
  getAllSettings = async (req, res, next) => {
    try {
      const settings = await settingsService.getAllSettings(req);
      return res.status(200).json({
        message: "Settings retrieved successfully",
        data: settings,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update settings
   * PATCH /api/settings
   * Body: { calendar_type: "AD" }
   */
  updateSettings = async (req, res, next) => {
    try {
      const settingsToUpdate = req.body;
      const results = {};

      for (const [key, value] of Object.entries(settingsToUpdate)) {
        if (key === "classroom_layout") {
          await settingsService.deleteSetting(key, req);
          continue;
        }
        if (key === "school_profile") {
          const updatedProfile = await settingsService.upsertSchoolProfile(
            value,
            req,
          );
          results[key] = updatedProfile;
          continue;
        }
        // If value is an object, store as JSON string in DB
        const toStore =
          typeof value === "string" ? value : JSON.stringify(value);
        const updated = await settingsService.updateSetting(key, toStore, req);
        // try to parse stored value for response
        try {
          results[key] = JSON.parse(updated.value);
        } catch {
          results[key] = updated.value;
        }
      }

      return res.status(200).json({
        message: "Settings updated successfully",
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get school profile
   * GET /api/v1/settings/school
   */
  getSchoolProfile = async (req, res, next) => {
    try {
      const profile = await settingsService.getSchoolProfile(req);
      return res
        .status(200)
        .json({ message: "School profile retrieved", data: profile || {} });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update school profile
   * PUT /api/v1/settings/school
   */
  updateSchoolProfile = async (req, res, next) => {
    try {
      const profile = req.body || {};
      const stored = await settingsService.upsertSchoolProfile(profile, req);
      return res
        .status(200)
        .json({ message: "School profile updated", data: stored });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Send a test email using current integration settings
   * POST /api/v1/settings/test-email
   * Body: { to?: string, eventType?: string }
   */
  sendTestEmail = async (req, res, next) => {
    try {
      const { to, eventType } = req.body || {};
      const emailService = require("../services/email.service");

      // Prepare a small payload depending on eventType
      const payload = { to: to || null };
      if (eventType === "student_created") {
        payload.studentName = "Test Student";
        payload.admissionNo = "T-0001";
        payload.schoolName = "Test School";
      } else {
        payload.name = "Test User";
        payload.username = to || "test@example.com";
        payload.password = "password123";
      }

      const sent = await emailService.sendEmailForEvent(
        req,
        eventType || "user_created",
        payload,
      );
      if (!sent)
        return res
          .status(500)
          .json({ message: "Failed to send test email (see server logs)." });
      return res.status(200).json({
        message:
          "Test email triggered (check recipient inbox and server logs).",
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get notification settings
   * GET /api/v1/settings/notifications
   */
  getNotificationSettings = async (req, res, next) => {
    try {
      const settings = await settingsService.getSettingByKey(
        "notifications",
        req,
      );
      return res.status(200).json({
        message: "Notification settings retrieved",
        data: settings || {},
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update notification settings
   * PUT /api/v1/settings/notifications
   */
  updateNotificationSettings = async (req, res, next) => {
    try {
      const payload = req.body || {};
      const stored = await settingsService.updateSetting(
        "notifications",
        JSON.stringify(payload),
        req,
      );
      let parsed;
      try {
        parsed = JSON.parse(stored.value);
      } catch {
        parsed = stored.value;
      }
      return res
        .status(200)
        .json({ message: "Notification settings updated", data: parsed });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get theme settings
   * GET /api/v1/settings/theme
   */
  getThemeSettings = async (req, res, next) => {
    try {
      const theme = await settingsService.getSettingByKey("theme", req);
      return res
        .status(200)
        .json({ message: "Theme settings retrieved", data: theme || {} });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update theme settings
   * PUT /api/v1/settings/theme
   */
  updateThemeSettings = async (req, res, next) => {
    try {
      const payload = req.body || {};
      const stored = await settingsService.updateSetting(
        "theme",
        JSON.stringify(payload),
        req,
      );
      let parsed;
      try {
        parsed = JSON.parse(stored.value);
      } catch {
        parsed = stored.value;
      }
      return res
        .status(200)
        .json({ message: "Theme settings updated", data: parsed });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get all rooms
   * GET /api/v1/settings/rooms
   */
  getRooms = async (req, res, next) => {
    try {
      const roomsService = require("../services/rooms.service");
      const pool = req.tenantPool;
      await roomsService.ensure(pool);
      const rooms = await roomsService.getAll(pool);
      return res.status(200).json({
        message: "Rooms retrieved successfully",
        data: rooms,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get a single room
   * GET /api/v1/settings/rooms/:id
   */
  getRoom = async (req, res, next) => {
    try {
      const roomsService = require("../services/rooms.service");
      const pool = req.tenantPool;
      const room = await roomsService.getById(pool, req.params.id);
      if (!room) {
        return res.status(404).json({ message: "Room not found", data: null });
      }
      return res
        .status(200)
        .json({ message: "Room retrieved successfully", data: room });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Create a new room
   * POST /api/v1/settings/rooms
   */
  createRoom = async (req, res, next) => {
    try {
      const roomsService = require("../services/rooms.service");
      const pool = req.tenantPool;
      await roomsService.ensure(pool);
      const room = await roomsService.create(pool, req.body);
      return res.status(201).json({
        message: "Room created successfully",
        data: room,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update a room
   * PUT /api/v1/settings/rooms/:id
   */
  updateRoom = async (req, res, next) => {
    try {
      const roomsService = require("../services/rooms.service");
      const pool = req.tenantPool;
      const room = await roomsService.update(pool, req.params.id, req.body);
      if (!room) {
        return res.status(404).json({ message: "Room not found", data: null });
      }
      return res
        .status(200)
        .json({ message: "Room updated successfully", data: room });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete a room
   * DELETE /api/v1/settings/rooms/:id
   */
  deleteRoom = async (req, res, next) => {
    try {
      const roomsService = require("../services/rooms.service");
      const pool = req.tenantPool;
      await roomsService.delete(pool, req.params.id);
      return res.status(200).json({
        message: "Room deleted successfully",
        data: { id: req.params.id },
      });
    } catch (err) {
      next(err);
    }
  };
}

const settingsCTRL = new SettingsController();
module.exports = settingsCTRL;
