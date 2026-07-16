const roomsService = require("../services/rooms.service");

const roomsController = {
  async getAll(req, res) {
    try {
      await roomsService.ensure(req.tenantPool);
      const rooms = await roomsService.getAll(req.tenantPool);
      res.json({ success: true, data: rooms });
    } catch (err) {
      console.error("Error loading rooms:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to load rooms: ${err.message}`,
        });
    }
  },

  async getById(req, res) {
    try {
      await roomsService.ensure(req.tenantPool);
      const room = await roomsService.getById(req.tenantPool, req.params.id);
      if (!room)
        return res
          .status(404)
          .json({ success: false, message: "Room not found" });
      res.json({ success: true, data: room });
    } catch (err) {
      console.error("Error loading room:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to load room: ${err.message}`,
        });
    }
  },

  async create(req, res) {
    try {
      const { room_number, block_id, floor_number, room_type, total_capacity } = req.body;

      // Validation
      if (!room_number || !String(room_number).trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Room number is required" });
      }
      if (!room_type || !String(room_type).trim()) {
        return res
          .status(400)
          .json({ success: false, message: "Room type is required" });
      }
      if (total_capacity === undefined || total_capacity === null) {
        return res
          .status(400)
          .json({ success: false, message: "Total capacity is required" });
      }
      if (isNaN(total_capacity) || total_capacity < 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Total capacity must be a valid non-negative number",
          });
      }
      if (block_id && (isNaN(block_id) || block_id <= 0)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Block selection is invalid",
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

      await roomsService.ensure(req.tenantPool);
      const room = await roomsService.create(req.tenantPool, {
        room_number: String(room_number).trim(),
        block_id: block_id ? Number(block_id) : null,
        floor_number: floor_number ? Number(floor_number) : null,
        room_type: String(room_type).trim(),
        total_capacity: Number(total_capacity),
      });
      res.status(201).json({ success: true, data: room });
    } catch (err) {
      console.error("Error creating room:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to create room: ${err.message}`,
        });
    }
  },

  async update(req, res) {
    try {
      const { block_id, floor_number } = req.body;
      if (block_id && (isNaN(block_id) || block_id <= 0)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Block selection is invalid",
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

      await roomsService.ensure(req.tenantPool);
      const updateData = { ...req.body };
      if (Object.prototype.hasOwnProperty.call(req.body, 'block_id')) {
        updateData.block_id = block_id ? Number(block_id) : null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'floor_number')) {
        updateData.floor_number = floor_number ? Number(floor_number) : null;
      }

      const room = await roomsService.update(
        req.tenantPool,
        req.params.id,
        updateData,
      );
      if (!room)
        return res
          .status(404)
          .json({ success: false, message: "Room not found" });
      res.json({ success: true, data: room });
    } catch (err) {
      console.error("Error updating room:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to update room: ${err.message}`,
        });
    }
  },

  async delete(req, res) {
    try {
      await roomsService.ensure(req.tenantPool);
      await roomsService.delete(req.tenantPool, req.params.id);
      res.json({ success: true, message: "Room deleted" });
    } catch (err) {
      console.error("Error deleting room:", err);
      res
        .status(500)
        .json({
          success: false,
          message: `Failed to delete room: ${err.message}`,
        });
    }
  },
};

module.exports = roomsController;
