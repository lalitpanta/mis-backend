const noticesService = require('../services/notices.service');
const emailService = require('../services/email.service');

const noticesController = {
  async listNotices(req, res) {
    try {
      const notices = await noticesService.getNotices(req);
      const userId = req.user?.id;
      const enhanced = (notices || []).map((notice) => ({
        ...notice,
        read: userId ? Array.isArray(notice.read_by) && notice.read_by.includes(userId) : false,
        readCount: Array.isArray(notice.read_by) ? notice.read_by.length : 0,
      }));
      res.json({ success: true, data: enhanced });
    } catch (err) {
      console.error('Failed to list notices:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createNotice(req, res) {
    try {
      const notice = req.body || {};
      if (!notice.title || !notice.content) {
        return res.status(400).json({ success: false, message: 'Title and content are required.' });
      }
      const created = await noticesService.createNotice(req, notice);
      if (created.sendImmediately && created.emailNotification && Array.isArray(created.recipientEmails) && created.recipientEmails.length > 0) {
        await noticesService.sendNoticeEmails(req, created);
      }
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      console.error('Failed to create notice:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateNotice(req, res) {
    try {
      const updated = await noticesService.updateNotice(req, req.params.id, req.body || {});
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Notice not found.' });
      }
      if (req.body?.sendImmediately && updated.emailNotification && Array.isArray(updated.recipientEmails) && updated.recipientEmails.length > 0) {
        await noticesService.sendNoticeEmails(req, updated);
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('Failed to update notice:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteNotice(req, res) {
    try {
      const deleted = await noticesService.deleteNotice(req, req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Notice not found.' });
      }
      res.json({ success: true, message: 'Notice deleted.' });
    } catch (err) {
      console.error('Failed to delete notice:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async markNoticeRead(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const notice = await noticesService.markNoticeRead(req, userId, req.params.id);
      if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });
      res.json({ success: true, data: notice });
    } catch (err) {
      console.error('Failed to mark notice read:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async togglePin(req, res) {
    try {
      const pinned = req.body?.pinned !== undefined ? !!req.body.pinned : true;
      const notice = await noticesService.togglePin(req, req.params.id, pinned);
      if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });
      res.json({ success: true, data: notice });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async archiveNotice(req, res) {
    try {
      const notice = await noticesService.archiveNotice(req, req.params.id);
      if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });
      res.json({ success: true, data: notice });
    } catch (err) {
      console.error('Failed to archive notice:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async sendNoticeEmail(req, res) {
    try {
      const notices = await noticesService.getNotices(req);
      const notice = notices.find((item) => item.id === req.params.id);
      if (!notice) {
        return res.status(404).json({ success: false, message: 'Notice not found.' });
      }
      if (!notice.emailNotification || !Array.isArray(notice.recipientEmails) || notice.recipientEmails.length === 0) {
        return res.status(400).json({ success: false, message: 'Notice has no email recipients or email notifications are disabled.' });
      }
      const result = await noticesService.sendNoticeEmails(req, notice);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('Failed to send notice email:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getSmsConfig(req, res) {
    try {
      const config = await noticesService.getSmsConfig(req);
      res.json({ success: true, data: config });
    } catch (err) {
      console.error('Failed to fetch SMS config:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateSmsConfig(req, res) {
    try {
      const config = await noticesService.saveSmsConfig(req, req.body || {});
      res.json({ success: true, data: config });
    } catch (err) {
      console.error('Failed to save SMS config:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getSmsTemplates(req, res) {
    try {
      const templates = await noticesService.getSmsTemplates(req);
      res.json({ success: true, data: templates });
    } catch (err) {
      console.error('Failed to fetch SMS templates:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async createSmsTemplate(req, res) {
    try {
      const template = req.body || {};
      if (!template.name || !template.content) {
        return res.status(400).json({ success: false, message: 'Template name and content are required.' });
      }
      const created = await noticesService.createSmsTemplate(req, template);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      console.error('Failed to create SMS template:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateSmsTemplate(req, res) {
    try {
      const updated = await noticesService.updateSmsTemplate(req, req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ success: false, message: 'Template not found.' });
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('Failed to update SMS template:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteSmsTemplate(req, res) {
    try {
      const deleted = await noticesService.deleteSmsTemplate(req, req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Template not found.' });
      res.json({ success: true, message: 'Template deleted.' });
    } catch (err) {
      console.error('Failed to delete SMS template:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async sendSms(req, res) {
    try {
      const result = await noticesService.sendSms(req, req.body || {});
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('Failed to send SMS:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getSmsLogs(req, res) {
    try {
      const logs = await noticesService.getSmsLogs(req);
      res.json({ success: true, data: logs });
    } catch (err) {
      console.error('Failed to fetch SMS logs:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = noticesController;
