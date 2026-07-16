const classesService = require('../services/classes.service');

const classesController = {
  async getAll(req, res) {
    try {
      await classesService.ensure(req.tenantPool);
      const classes = await classesService.getAll(req.tenantPool);
      res.json({ success: true, data: classes });
    } catch (err) {
      console.error('Error loading classes:', err);
      res.status(500).json({ success: false, message: `Failed to load classes: ${err.message}` });
    }
  },

  async getById(req, res) {
    try {
      await classesService.ensure(req.tenantPool);
      const cls = await classesService.getById(req.tenantPool, req.params.id);
      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
      res.json({ success: true, data: cls });
    } catch (err) {
      console.error('Error loading class:', err);
      res.status(500).json({ success: false, message: `Failed to load class: ${err.message}` });
    }
  },

  async create(req, res) {
    try {
      const { class_name, total_students, faculty } = req.body;
      
      // Validation
      if (!class_name || !String(class_name).trim()) {
        return res.status(400).json({ success: false, message: 'Class name is required' });
      }
      if (total_students === undefined || total_students === null) {
        return res.status(400).json({ success: false, message: 'Total students is required' });
      }
      if (isNaN(total_students) || total_students < 0) {
        return res.status(400).json({ success: false, message: 'Total students must be a valid non-negative number' });
      }
      
      await classesService.ensure(req.tenantPool);
      const cls = await classesService.create(req.tenantPool, {
        class_name: String(class_name).trim(),
        total_students: Number(total_students),
        faculty: faculty ? String(faculty).trim() : null,
      });
      res.status(201).json({ success: true, data: cls });
    } catch (err) {
      console.error('Error creating class:', err);
      res.status(500).json({ success: false, message: `Failed to create class: ${err.message}` });
    }
  },

  async update(req, res) {
    try {
      await classesService.ensure(req.tenantPool);
      const cls = await classesService.update(req.tenantPool, req.params.id, req.body);
      if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
      res.json({ success: true, data: cls });
    } catch (err) {
      console.error('Error updating class:', err);
      res.status(500).json({ success: false, message: `Failed to update class: ${err.message}` });
    }
  },

  async delete(req, res) {
    try {
      await classesService.ensure(req.tenantPool);
      await classesService.delete(req.tenantPool, req.params.id);
      res.json({ success: true, message: 'Class deleted' });
    } catch (err) {
      console.error('Error deleting class:', err);
      res.status(500).json({ success: false, message: `Failed to delete class: ${err.message}` });
    }
  },
};

module.exports = classesController;
