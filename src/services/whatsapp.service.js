const https = require('https');
const querystring = require('querystring');
const settingsService = require('./settings.service');

class WhatsAppService {
  async getConfig(req) {
    const config = await settingsService.getSettingByKey('whatsapp_config', req);
    return config || null;
  }

  async getTemplates(req) {
    const templates = await settingsService.getSettingByKey('whatsapp_templates', req);
    return templates || {};
  }

  async sendWhatsAppForEvent(req, eventType, payload) {
    try {
      const config = await this.getConfig(req);
      if (!config || !config.enabled) {
        return false;
      }

      const notifications = config.notifications || {};
      if (!notifications[eventType]) {
        return false;
      }

      const templates = await this.getTemplates(req);
      const template = templates[eventType];
      if (!template || !template.body) {
        console.warn(`No WhatsApp template configured for event: ${eventType}`);
        return false;
      }

      let message = template.body;
      for (const [key, value] of Object.entries(payload)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        message = message.replace(regex, value || '');
      }

      let to = payload.to;
      if (!to && eventType === 'user_created' && config.admin_whatsapp_phone) {
        to = config.admin_whatsapp_phone;
      }
      if (!to) {
        console.warn(`Skipping WhatsApp message for ${eventType}: no recipient found.`);
        return false;
      }

      await this.sendWhatsApp(req, to, message);
      return true;
    } catch (err) {
      console.error(`Failed to send WhatsApp for event ${eventType}:`, err);
      return false;
    }
  }

  async sendWhatsApp(req, to, message) {
    const config = await this.getConfig(req);
    if (!config || !config.provider || !config.account_sid || !config.auth_token) {
      throw new Error('WhatsApp configuration is missing or incomplete.');
    }

    if (config.provider !== 'twilio') {
      throw new Error(`Unsupported WhatsApp provider: ${config.provider}`);
    }

    if (!config.from_number && !config.messaging_service_sid) {
      throw new Error('Twilio WhatsApp configuration requires either from_number or messaging_service_sid.');
    }

    return this.sendTwilioMessage(config, to, message);
  }

  sendTwilioMessage(config, to, message) {
    const payloadData = {
      To: `whatsapp:${to}`,
      Body: message,
    };

    if (config.messaging_service_sid) {
      payloadData.MessagingServiceSid = config.messaging_service_sid;
    } else {
      let fromNumber = config.from_number || '';
      fromNumber = fromNumber.toString().trim();
      if (fromNumber.startsWith('whatsapp:')) {
        fromNumber = fromNumber.replace(/^whatsapp:/i, '');
      }
      payloadData.From = `whatsapp:${fromNumber}`;
    }

    const payload = querystring.stringify(payloadData);

    const auth = Buffer.from(`${config.account_sid}:${config.auth_token}`).toString('base64');
    const options = {
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${config.account_sid}/Messages.json`,
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    return new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let responseBody = '';
        response.on('data', (chunk) => (responseBody += chunk));
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(responseBody);
          } else {
            reject(new Error(`Twilio WhatsApp send failed: ${response.statusCode} ${responseBody}`));
          }
        });
      });

      request.on('error', (err) => reject(err));
      request.write(payload);
      request.end();
    });
  }
}

const whatsappService = new WhatsAppService();
module.exports = whatsappService;
