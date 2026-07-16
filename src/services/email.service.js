const nodemailer = require("nodemailer");
const settingsService = require("./settings.service");

class EmailService {
  /**
   * Retrieves the current email configuration from settings
   */
  async getConfig(req) {
    const config = await settingsService.getSettingByKey("email_config", req);
    return config || null;
  }

  /**
   * Retrieves the current email templates from settings
   */
  async getTemplates(req) {
    const templates = await settingsService.getSettingByKey("email_templates", req);
    return templates || {};
  }

  /**
   * Sends an email based on an event type
   * @param {Object} req - The request object (to extract tenantPool context)
   * @param {String} eventType - The type of event (e.g., 'student_created', 'user_created')
   * @param {Object} payload - Data to populate the template (e.g., { studentName: 'John', email: 'john@example.com' })
   */
  async sendEmailForEvent(req, eventType, payload) {
    try {
      const config = await this.getConfig(req);
      // Check if email integration is configured and enabled for this event
      if (!config || !config.enabled) {
        return false;
      }
      
      const notifications = config.notifications || {};
      if (!notifications[eventType]) {
        // Notification for this event is disabled
        return false;
      }

      const templates = await this.getTemplates(req);
      const template = templates[eventType];
      
      if (!template || !template.subject || !template.body) {
        console.warn(`No email template configured for event: ${eventType}`);
        return false;
      }

      // Compile template
      let subject = template.subject;
      let htmlBody = template.body;

      // Simple string interpolation for variables e.g. {{studentName}}
      for (const [key, value] of Object.entries(payload)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value || '');
        htmlBody = htmlBody.replace(regex, value || '');
      }

      // Determine recipient: for user_created, prefer admin_email from config
      let to = payload.to;
      if (eventType === 'user_created' && config.admin_email) {
        to = config.admin_email;
      }

      if (!to) {
        console.warn(`Skipping email for ${eventType}: no recipient found.`);
        return false;
      }

      // Send the email
      await this.sendEmail(req, to, subject, htmlBody);
      return true;
    } catch (err) {
      console.error(`Failed to send email for event ${eventType}:`, err);
      return false;
    }
  }

  /**
   * Core function to send an email using configured SMTP
   */
  async sendEmail(req, to, subject, html) {
    const config = await this.getConfig(req);
    if (!config || !config.email_address || !config.app_password) {
      throw new Error("Email configuration is missing or incomplete.");
    }

    // Default to Gmail or common SMTP settings if not explicitly provided
    const host = config.smtp_host || 'smtp.gmail.com';
    const port = config.smtp_port || 465;
    const secure = config.smtp_secure !== undefined ? config.smtp_secure : true;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: config.email_address,
        pass: config.app_password,
      },
    });

    const mailOptions = {
      from: `"${config.sender_name || 'EduSphere MIS'}" <${config.email_address}>`,
      to,
      subject,
      html,
    };

    return transporter.sendMail(mailOptions);
  }
}

const emailService = new EmailService();
module.exports = emailService;
