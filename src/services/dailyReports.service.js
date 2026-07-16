const noticesService = require("./notices.service");
const whatsappService = require("./whatsapp.service");
const PDFGeneratorService = require("./pdfGenerator.service");
const settingsService = require("./settings.service");

class DailyReportsService {
  ensure = async (pool) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS daily_report_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        template JSONB NOT NULL,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_reports (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL,
        classroom_id INTEGER,
        template_id INTEGER REFERENCES daily_report_templates(id) ON DELETE SET NULL,
        report JSONB NOT NULL,
        pdf_url VARCHAR(500),
        sent BOOLEAN DEFAULT FALSE,
        sent_to VARCHAR(50),
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_daily_reports_student ON daily_reports(student_id);
      CREATE INDEX IF NOT EXISTS idx_daily_reports_template ON daily_reports(template_id);
    `;
    await pool.query(sql);

    await pool.query(`
      ALTER TABLE daily_reports
        ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS sent BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS sent_to VARCHAR(50),
        ADD COLUMN IF NOT EXISTS created_by UUID,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
  };

  // Templates
  getTemplates = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const res = await pool.query(
        "SELECT * FROM daily_report_templates ORDER BY id DESC",
      );
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to fetch templates: ${err.message}`);
    }
  };

  createTemplate = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const { name, description = null, template, created_by } = data;
      if (!name || !template || !created_by)
        throw new Error("Missing required fields");
      const res = await pool.query(
        "INSERT INTO daily_report_templates (name, description, template, created_by) VALUES ($1,$2,$3,$4) RETURNING *",
        [name, description, template, created_by],
      );
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to create template: ${err.message}`);
    }
  };

  updateTemplate = async (id, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const fields = [];
      const values = [];
      let idx = 1;
      if (data.name !== undefined) {
        fields.push(`name=$${idx++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        fields.push(`description=$${idx++}`);
        values.push(data.description);
      }
      if (data.template !== undefined) {
        fields.push(`template=$${idx++}`);
        values.push(data.template);
      }
      if (fields.length === 0) return null;
      const sql = `UPDATE daily_report_templates SET ${fields.join(",")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
      values.push(id);
      const res = await pool.query(sql, values);
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update template: ${err.message}`);
    }
  };

  deleteTemplate = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const res = await pool.query(
        "DELETE FROM daily_report_templates WHERE id = $1 RETURNING id",
        [id],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete template: ${err.message}`);
    }
  };

  // Reports
  createReport = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const {
        student_id,
        classroom_id = null,
        template_id = null,
        report,
        created_by,
        send = false,
        send_to = null,
      } = data;
      if (!student_id || !report) throw new Error("Missing required fields");

      // Prevent duplicate report for the same student on the same date
      const duplicateCheckRes = await pool.query(
        "SELECT id FROM daily_reports WHERE student_id = $1 AND DATE(created_at) = CURRENT_DATE LIMIT 1",
        [student_id],
      );
      if (duplicateCheckRes.rows.length > 0) {
        throw new Error(
          "A report for this student has already been created today. Edit it from the bulk reports tab.",
        );
      }

      // Fetch student details for PDF
      let studentData = null;
      try {
        const studentRes = await pool.query(
          "SELECT * FROM students WHERE id = $1",
          [student_id],
        );
        studentData = studentRes.rows[0];
      } catch (err) {
        console.error("Failed to fetch student:", err);
      }

      // Generate PDF
      let pdfUrl = null;
      if (studentData && template_id) {
        try {
          // Fetch template details
          const templateRes = await pool.query(
            "SELECT * FROM daily_report_templates WHERE id = $1",
            [template_id],
          );
          const template = templateRes.rows[0];

          // Get school name from school profile or fallback to old settings storage
          const schoolProfile = await settingsService.getSchoolProfile(req);
          const schoolRes = await pool.query(
            'SELECT value FROM "settings" WHERE key = $1 LIMIT 1',
            ["school_name"],
          );
          const schoolName =
            schoolProfile?.name || schoolRes.rows?.[0]?.value || "School";

          // Generate PDF
          const pdfData = {
            student: {
              id: studentData.id,
              full_name: studentData.full_name,
              class_name: studentData.class_name,
              section_name: studentData.section_name,
            },
            template: template?.template,
            reportData: report.data || {},
            schoolName,
            schoolProfile: schoolProfile || {},
            date: new Date().toISOString().split("T")[0],
          };

          const pdfFilePath =
            await PDFGeneratorService.generateDailyReportPDF(pdfData);
          pdfUrl = PDFGeneratorService.getPDFUrl(pdfFilePath);
        } catch (pdfErr) {
          console.error("Failed to generate PDF:", pdfErr);
        }
      }

      // Insert report
      const res = await pool.query(
        "INSERT INTO daily_reports (student_id, classroom_id, template_id, report, pdf_url, created_by, sent, sent_to) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          student_id,
          classroom_id,
          template_id,
          report,
          pdfUrl,
          created_by,
          send ? true : false,
          send_to,
        ],
      );

      const created = res.rows[0];

      if (send && send_to) {
        // Attempt to send via noticesService (SMS/WhatsApp abstraction)
        try {
          const message =
            report.summary ||
            `Daily Report: ${report.template_name || "Report"}`;
          const sendMessage = pdfUrl
            ? `${message}\n\nDownload PDF: ${pdfUrl}`
            : message;

          await noticesService.sendSms(req, {
            to: send_to,
            message: sendMessage,
          });
        } catch (sendErr) {
          console.error("Failed to send report message:", sendErr);
        }
      }

      return created;
    } catch (err) {
      throw new Error(`Failed to create report: ${err.message}`);
    }
  };

  bulkSendReports = async (date = null, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const params = [];
      let where = "WHERE dr.pdf_url IS NOT NULL";
      if (date) {
        params.push(date);
        where += ` AND DATE(dr.created_at) = $${params.length}`;
      }

      const sql = `
        SELECT dr.*, 
               COALESCE(s.full_name, 'Unknown Student') AS student_name,
               COALESCE(c.class_name, c.name, 'N/A') AS class_name,
               COALESCE(se.name, 'N/A') AS section_name,
               COALESCE(s.guardian_name, s.father_name, s.mother_name, 'Guardian') AS guardian_name,
               s.guardian_phone,
               s.phone_no,
               t.name AS template_name
        FROM daily_reports dr
        LEFT JOIN students s ON s.id = dr.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN sections se ON se.id = s.section_id
        LEFT JOIN daily_report_templates t ON t.id = dr.template_id
        ${where}
        ORDER BY dr.created_at ASC
      `;
      const reportRes = await pool.query(sql, params);
      const reports = reportRes.rows;

      const results = [];
      for (const report of reports) {
        const recipient = report.guardian_phone || report.phone_no || null;
        if (!recipient) {
          results.push({
            report_id: report.id,
            status: "skipped",
            reason: "No phone number found",
          });
          continue;
        }

        const message = report.pdf_url
          ? `Daily Report for ${report.student_name || "student"} is ready. Download: ${report.pdf_url}`
          : `Daily Report for ${report.student_name || "student"} is ready.`;

        const to = recipient.replace(/[^0-9+]/g, "");
        try {
          await whatsappService.sendWhatsApp(req, to, message);
          await pool.query(
            "UPDATE daily_reports SET sent = TRUE, sent_to = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            [to, report.id],
          );
          results.push({ report_id: report.id, status: "sent", to });
        } catch (err) {
          console.error(
            `Failed to send WhatsApp for report ${report.id}:`,
            err,
          );
          results.push({
            report_id: report.id,
            status: "failed",
            reason: err.message,
          });
        }
      }

      return {
        date,
        count: reports.length,
        details: results,
      };
    } catch (err) {
      throw new Error(`Failed to bulk send reports: ${err.message}`);
    }
  };

  listReports = async (req, studentId = null, date = null) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const params = [];
      const conditions = [];
      if (studentId) {
        params.push(studentId);
        conditions.push(`dr.student_id = $${params.length}`);
      }
      if (date) {
        params.push(date);
        conditions.push(`DATE(dr.created_at) = $${params.length}`);
      }

      const where =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const sql = `
        SELECT dr.*, 
               COALESCE(s.full_name, 'Unknown Student') AS student_name,
               COALESCE(c.class_name, c.name, 'N/A') AS class_name,
               COALESCE(se.name, 'N/A') AS section_name,
               COALESCE(s.guardian_name, s.father_name, s.mother_name, 'Guardian') AS guardian_name,
               s.guardian_phone,
               s.phone_no,
               t.name AS template_name
        FROM daily_reports dr
        LEFT JOIN students s ON s.id = dr.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN sections se ON se.id = s.section_id
        LEFT JOIN daily_report_templates t ON t.id = dr.template_id
        ${where}
        ORDER BY dr.created_at DESC
      `;

      const res = await pool.query(sql, params);
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to list reports: ${err.message}`);
    }
  };

  deleteReport = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const res = await pool.query(
        "DELETE FROM daily_reports WHERE id = $1 RETURNING id",
        [id],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete report: ${err.message}`);
    }
  };
}

module.exports = new DailyReportsService();
