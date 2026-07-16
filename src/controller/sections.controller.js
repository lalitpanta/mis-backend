const sectionsService = require("../services/sections.service");

const sectionsController = {
  async getAll(req, res) {
    try {
      await sectionsService.ensure(req.tenantPool);
      const sections = await sectionsService.getAll(req.tenantPool);
      res.json({ success: true, data: sections });
    } catch (err) {
      console.error("Error loading sections:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to load sections: ${err.message}`,
        });
    }
  },

  async getById(req, res) {
    try {
      await sectionsService.ensure(req.tenantPool);
      const section = await sectionsService.getById(
        req.tenantPool,
        req.params.id,
      );
      if (!section)
        return res
          .status(404)
          .json({ success: false, message: "Section not found" });
      res.json({ success: true, data: section });
    } catch (err) {
      console.error("Error loading section:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to load section: ${err.message}`,
        });
    }
  },

  async create(req, res) {
    try {
      const {
        section_name,
        class_id,
        block_id,
        floor_number,
        room_id,
        total_students,
        monitor_name,
        class_teacher_id,
      } = req.body;

      // Validation
      if (!section_name || !String(section_name).trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Section name is required" });
      }
      if (total_students === undefined || total_students === null) {
        return res
          .status(400)
          .json({ success: false, message: "Total students is required" });
      }
      if (isNaN(total_students) || total_students < 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Total students must be a valid non-negative number",
          });
      }
      if (block_id && (isNaN(block_id) || block_id <= 0)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Block ID must be a valid positive number",
          });
      }
      if (floor_number && (isNaN(floor_number) || floor_number <= 0)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Floor number must be a valid positive number",
          });
      }
      if (room_id && (isNaN(room_id) || room_id <= 0)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Room ID must be a valid positive number",
          });
      }
      if (!class_id || isNaN(class_id) || class_id <= 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Class ID is required and must be a valid positive number",
          });
      }

      await sectionsService.ensure(req.tenantPool);
      const section = await sectionsService.create(req.tenantPool, {
        section_name: String(section_name).trim(),
        class_id: Number(class_id),
        block_id: block_id ? Number(block_id) : null,
        floor_number: floor_number ? Number(floor_number) : null,
        room_id: room_id ? Number(room_id) : null,
        total_students: Number(total_students),
        monitor_name: monitor_name ? String(monitor_name).trim() : null,
        class_teacher_id: class_teacher_id || null,
      });
      res.status(201).json({ success: true, data: section });
    } catch (err) {
      console.error("Error creating section:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to create section: ${err.message}`,
        });
    }
  },

  async update(req, res) {
    try {
      await sectionsService.ensure(req.tenantPool);
      const section = await sectionsService.update(
        req.tenantPool,
        req.params.id,
        req.body,
      );
      if (!section)
        return res
          .status(404)
          .json({ success: false, message: "Section not found" });
      res.json({ success: true, data: section });
    } catch (err) {
      console.error("Error updating section:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to update section: ${err.message}`,
        });
    }
  },

  async delete(req, res) {
    try {
      await sectionsService.ensure(req.tenantPool);
      await sectionsService.delete(req.tenantPool, req.params.id);
      res.json({ success: true, message: "Section deleted" });
    } catch (err) {
      console.error("Error deleting section:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to delete section: ${err.message}`,
        });
    }
  },

  async getByRoomId(req, res) {
    try {
      await sectionsService.ensure(req.tenantPool);
      const sections = await sectionsService.getByRoomId(
        req.tenantPool,
        req.params.roomId,
      );
      res.json({ success: true, data: sections });
    } catch (err) {
      console.error("Error loading sections by room:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to load sections: ${err.message}`,
        });
    }
  },

  async getByClassId(req, res) {
    try {
      await sectionsService.ensure(req.tenantPool);
      const sections = await sectionsService.getByClassId(
        req.tenantPool,
        req.params.classId,
      );
      res.json({ success: true, data: sections });
    } catch (err) {
      console.error("Error loading sections by class:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to load sections: ${err.message}`,
        });
    }
  },
};

module.exports = sectionsController;
