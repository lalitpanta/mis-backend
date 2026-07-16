const settingsService = require('./settings.service');
const emailService = require('./email.service');

const DEFAULT_SMS_CONFIG = {
  enabled: false,
  gateway: 'sparrow',
  api_key: '',
  sender_id: '',
  provider_name: 'Sparrow SMS',
  country: 'NP',
  credits: 0,
  signature: '',
};

class NoticesService {
  async _loadSetting(key, req, defaultValue) {
    const data = await settingsService.getSettingByKey(key, req);
    return data === null ? defaultValue : data;
  }

  async _saveSetting(key, value, req) {
    return settingsService.updateSetting(key, JSON.stringify(value), req);
  }

  async getNotices(req) {
    return this._loadSetting('notice_board', req, []);
  }

  async sendNoticeEmails(req, notice) {
    if (!notice || !notice.emailNotification) {
      return { sent: false, reason: 'email notification disabled' };
    }
    const recipients = Array.isArray(notice.recipientEmails) ? notice.recipientEmails : [];
    if (recipients.length === 0) {
      return { sent: false, reason: 'no recipients' };
    }
    const subject = `New notice: ${notice.title}`;
    const body = `<p>${notice.content}</p><p>Category: ${notice.category}</p>`;

    await Promise.all(recipients.map((to) => emailService.sendEmail(req, to, subject, body).catch((error) => {
      console.error(`Failed to send notice email to ${to}:`, error);
    })));

    return { sent: true, recipients: recipients.length };
  }

  async createNotice(req, notice) {
    const existing = await this.getNotices(req);
    const created = {
      id: notice.id || `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      title: String(notice.title || '').trim(),
      content: String(notice.content || '').trim(),
      category: notice.category || 'General',
      audience: notice.audience || 'All',
      audienceDetails: notice.audienceDetails || null,
      expiryDate: notice.expiryDate || null,
      pinned: !!notice.pinned,
      status: notice.status || 'draft',
      attachments: Array.isArray(notice.attachments) ? notice.attachments : [],
      emailNotification: !!notice.emailNotification,
      recipientEmails: Array.isArray(notice.recipientEmails) ? notice.recipientEmails : [],
      sendImmediately: !!notice.sendImmediately,
      createdBy: req.user?.id || 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      read_by: [],
    };
    existing.unshift(created);
    await this._saveSetting('notice_board', existing, req);
    return created;
  }

  async updateNotice(req, id, updates) {
    const notices = await this.getNotices(req);
    const index = notices.findIndex((notice) => notice.id === id);
    if (index === -1) return null;
    const current = notices[index];
    const updated = {
      ...current,
      ...updates,
      title: updates.title !== undefined ? String(updates.title).trim() : current.title,
      content: updates.content !== undefined ? String(updates.content).trim() : current.content,
      category: updates.category || current.category,
      audience: updates.audience || current.audience,
      audienceDetails: updates.audienceDetails || current.audienceDetails,
      expiryDate: updates.expiryDate !== undefined ? updates.expiryDate : current.expiryDate,
      pinned: updates.pinned !== undefined ? !!updates.pinned : current.pinned,
      status: updates.status || current.status,
      attachments: Array.isArray(updates.attachments) ? updates.attachments : current.attachments,
      emailNotification: updates.emailNotification !== undefined ? !!updates.emailNotification : current.emailNotification,
      recipientEmails: Array.isArray(updates.recipientEmails) ? updates.recipientEmails : current.recipientEmails,
      sendImmediately: updates.sendImmediately !== undefined ? !!updates.sendImmediately : current.sendImmediately,
      updatedAt: new Date().toISOString(),
    };
    notices[index] = updated;
    await this._saveSetting('notice_board', notices, req);
    return updated;
  }

  async deleteNotice(req, id) {
    const notices = await this.getNotices(req);
    const filtered = notices.filter((notice) => notice.id !== id);
    if (filtered.length === notices.length) return false;
    await this._saveSetting('notice_board', filtered, req);
    return true;
  }

  async markNoticeRead(req, userId, noticeId) {
    const notices = await this.getNotices(req);
    const index = notices.findIndex((notice) => notice.id === noticeId);
    if (index === -1) return null;
    const notice = notices[index];
    const readBy = Array.isArray(notice.read_by) ? [...notice.read_by] : [];
    if (userId && !readBy.includes(userId)) {
      readBy.push(userId);
    }
    notice.read_by = readBy;
    notice.updatedAt = new Date().toISOString();
    notices[index] = notice;
    await this._saveSetting('notice_board', notices, req);
    return notice;
  }

  async togglePin(req, noticeId, pinned) {
    return this.updateNotice(req, noticeId, { pinned });
  }

  async archiveNotice(req, noticeId) {
    return this.updateNotice(req, noticeId, { status: 'archived' });
  }

  async getSmsConfig(req) {
    const config = await this._loadSetting('sms_config', req, null);
    return config || { ...DEFAULT_SMS_CONFIG };
  }

  async saveSmsConfig(req, config) {
    const nextConfig = { ...DEFAULT_SMS_CONFIG, ...config };
    const result = await this._saveSetting('sms_config', nextConfig, req);
    return JSON.parse(result.value);
  }

  async getSmsTemplates(req) {
    return this._loadSetting('sms_templates', req, []);
  }

  async createSmsTemplate(req, template) {
    const list = await this.getSmsTemplates(req);
    const created = {
      id: template.id || `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: String(template.name || '').trim(),
      content: String(template.content || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    list.unshift(created);
    await this._saveSetting('sms_templates', list, req);
    return created;
  }

  async updateSmsTemplate(req, id, updates) {
    const list = await this.getSmsTemplates(req);
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const current = list[index];
    const updated = {
      ...current,
      name: updates.name !== undefined ? String(updates.name).trim() : current.name,
      content: updates.content !== undefined ? String(updates.content).trim() : current.content,
      updatedAt: new Date().toISOString(),
    };
    list[index] = updated;
    await this._saveSetting('sms_templates', list, req);
    return updated;
  }

  async deleteSmsTemplate(req, id) {
    const list = await this.getSmsTemplates(req);
    const filtered = list.filter((item) => item.id !== id);
    if (filtered.length === list.length) return false;
    await this._saveSetting('sms_templates', filtered, req);
    return true;
  }

  async getSmsLogs(req) {
    return this._loadSetting('sms_logs', req, []);
  }

  async saveSmsLog(req, logEntry) {
    const logs = await this.getSmsLogs(req);
    const nextLog = {
      id: logEntry.id || `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      to: logEntry.to || 'unknown',
      message: logEntry.message || '',
      templateName: logEntry.templateName || null,
      recipientType: logEntry.recipientType || 'manual',
      scheduledAt: logEntry.scheduledAt || null,
      status: logEntry.status || 'sent',
      providerResponse: logEntry.providerResponse || null,
      createdBy: req.user?.id || 'system',
      createdAt: new Date().toISOString(),
    };
    logs.unshift(nextLog);
    await this._saveSetting('sms_logs', logs, req);
    return nextLog;
  }

  async sendSms(req, payload) {
    const config = await this.getSmsConfig(req);
    const phoneList = String(payload.recipientPhones || '')
      .split(/[,\n;]/)
      .map((value) => value.trim())
      .filter(Boolean);
    const message = String(payload.message || '').trim();
    const templateName = payload.templateName || null;
    const scheduledAt = payload.scheduledAt || null;
    const recipientType = payload.recipientType || 'manual';

    if (!message) {
      throw new Error('SMS message cannot be empty.');
    }
    if (recipientType === 'manual' && phoneList.length === 0) {
      throw new Error('Please provide at least one recipient phone number.');
    }

    const status = scheduledAt && new Date(scheduledAt) > new Date() ? 'scheduled' : 'sent';
    const providerResponse = config.enabled
      ? `queued on ${config.gateway || 'unknown'} gateway` 
      : 'SMS gateway disabled';

    const logs = [];
    const toTargets = phoneList.length > 0 ? phoneList : [payload.recipientPlaceholder || 'unknown'];
    for (const to of toTargets) {
      const logEntry = await this.saveSmsLog(req, {
        to,
        message,
        templateName,
        recipientType,
        scheduledAt,
        status: config.enabled ? status : 'failed',
        providerResponse: config.enabled ? providerResponse : 'disabled',
      });
      logs.push(logEntry);
    }

    if (config.enabled && config.credits != null) {
      const remaining = Number(config.credits) - toTargets.length;
      config.credits = remaining >= 0 ? remaining : 0;
      await this.saveSmsConfig(req, config);
    }

    return {
      sent: config.enabled,
      status,
      logs,
      gateway: config.gateway,
    };
  }
}

module.exports = new NoticesService();
