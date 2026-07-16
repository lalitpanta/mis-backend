const dailyReportsService = require('../services/dailyReports.service');

const dailyReportsController = {
  async getTemplates(req, res) {
    try {
      const templates = await dailyReportsService.getTemplates(req);
      res.json({ success: true, data: templates });
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createTemplate(req, res) {
    try {
      const body = req.body || {};
      body.created_by = req.user?.id;
      const created = await dailyReportsService.createTemplate(body, req);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      console.error('Failed to create template:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateTemplate(req, res) {
    try {
      const updated = await dailyReportsService.updateTemplate(req.params.id, req.body || {}, req);
      if (!updated) return res.status(404).json({ success: false, message: 'Template not found' });
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('Failed to update template:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteTemplate(req, res) {
    try {
      const deleted = await dailyReportsService.deleteTemplate(req.params.id, req);
      if (!deleted) return res.status(404).json({ success: false, message: 'Template not found' });
      res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
      console.error('Failed to delete template:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createReport(req, res) {
    try {
      const body = req.body || {};
      body.created_by = req.user?.id;
      const created = await dailyReportsService.createReport(body, req);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      console.error('Failed to create report:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async bulkSendReports(req, res) {
    try {
      const date = req.body?.date || req.query?.date || null;
      const result = await dailyReportsService.bulkSendReports(date, req);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('Failed to bulk send reports:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async listReports(req, res) {
    try {
      const studentId = req.query.studentId || null;
      const date = req.query.date || null;
      const reports = await dailyReportsService.listReports(req, studentId, date);
      res.json({ success: true, data: reports });
    } catch (err) {
      console.error('Failed to list reports:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteReport(req, res) {
    try {
      const deleted = await dailyReportsService.deleteReport(req.params.id, req);
      if (!deleted) return res.status(404).json({ success: false, message: 'Report not found' });
      res.json({ success: true, message: 'Report deleted' });
    } catch (err) {
      console.error('Failed to delete report:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = dailyReportsController;
