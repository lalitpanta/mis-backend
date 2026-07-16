const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

class PDFGeneratorService {
  /**
   * Generate a daily report PDF
   * @param {Object} data - Report data
   * @param {Object} data.student - Student object with name, class_name, section_name
   * @param {Object} data.template - Template object with sections
   * @param {Object} data.reportData - Filled report form data
   * @param {string} data.schoolName - School name for header
   * @param {string} data.date - Report date (YYYY-MM-DD)
   * @returns {Promise<string>} - File path to generated PDF
   */
  static async generateDailyReportPDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const {
          student,
          template,
          reportData,
          schoolName = "School",
          date = new Date().toISOString().split("T")[0],
        } = data;

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          "daily_reports",
        );
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Generate filename
        const fileName = `${student.id}_${Date.now()}_${uuidv4().slice(0, 8)}.pdf`;
        const filePath = path.join(uploadsDir, fileName);

        // Create PDF document
        const doc = new PDFDocument({
          size: "A4",
          margin: 22,
          bufferPages: true,
        });

        // Create write stream
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // ─── HEADER ───
        const schoolProfile = data.schoolProfile || {};
        const schoolTitle = schoolProfile.name || schoolName;
        const contactParts = [];
        if (schoolProfile.phone)
          contactParts.push(`Phone: ${schoolProfile.phone}`);
        if (schoolProfile.email)
          contactParts.push(`Email: ${schoolProfile.email}`);
        if (schoolProfile.website)
          contactParts.push(`${schoolProfile.website}`);
        const schoolContact = contactParts.join(" · ");

        doc
          .fillColor("#0f172a")
          .font("Helvetica-Bold")
          .fontSize(18)
          .text(schoolTitle, { align: "center" });
        if (schoolProfile.motto) {
          doc.moveDown(0.1);
          doc
            .fillColor("#475569")
            .font("Helvetica-Oblique")
            .fontSize(9)
            .text(schoolProfile.motto, { align: "center" });
        }

        if (schoolProfile.address || schoolContact) {
          doc.moveDown(0.25);
          const details = [schoolProfile.address, schoolContact]
            .filter(Boolean)
            .join(" · ");
          doc
            .fillColor("#475569")
            .font("Helvetica")
            .fontSize(8)
            .text(details, { align: "center" });
        }

        doc.moveDown(0.6);
        doc
          .lineWidth(1)
          .strokeColor("#d1d5db")
          .moveTo(22, doc.y)
          .lineTo(573, doc.y)
          .stroke();
        doc.moveDown(0.8);

        // ─── REPORT TITLE ───
        doc.fillColor("#047857").rect(22, doc.y, 555, 26).fill("#047857");
        doc
          .fillColor("white")
          .font("Helvetica-Bold")
          .fontSize(14)
          .text("STUDENT DAILY REPORT", 0, doc.y + 6, { align: "center" });
        doc.moveDown(2.2);

        // ─── STUDENT SUMMARY CARD ───
        const studentSummaryTop = doc.y;
        doc.roundedRect(22, studentSummaryTop, 555, 86, 10).fill("#f8fafc");
        doc
          .fillColor("#0f172a")
          .font("Helvetica-Bold")
          .fontSize(10)
          .text("Student Name", 32, studentSummaryTop + 12);
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#475569")
          .text(student.full_name || "N/A", 120, studentSummaryTop + 12);

        doc
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("Class", 320, studentSummaryTop + 12);
        doc
          .font("Helvetica")
          .fillColor("#475569")
          .text(student.class_name || "N/A", 360, studentSummaryTop + 12);

        doc
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("Section", 32, studentSummaryTop + 33);
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#475569")
          .text(student.section_name || "N/A", 120, studentSummaryTop + 33);

        doc
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("Date", 320, studentSummaryTop + 33);
        doc
          .font("Helvetica")
          .fillColor("#475569")
          .text(date, 360, studentSummaryTop + 33);

        doc
          .font("Helvetica-Bold")
          .fillColor("#0f172a")
          .text("School", 32, studentSummaryTop + 54);
        doc
          .font("Helvetica")
          .fillColor("#475569")
          .text(schoolTitle, 120, studentSummaryTop + 54);
        doc.moveDown(5.2);

        // ─── SECTIONS ───
        if (template?.sections) {
          template.sections.forEach((section, sectionIdx) => {
            const sectionTitle = section.title || "Section";
            doc.fillColor("white").rect(22, doc.y, 555, 20).fill("#0f172a");
            doc
              .fillColor("white")
              .font("Helvetica-Bold")
              .fontSize(11)
              .text(sectionTitle, 30, doc.y + 4);
            doc.moveDown(1.8);

            if (section.fields && section.fields.length > 0) {
              section.fields.forEach((field, fieldIdx) => {
                const rawValue = reportData?.[sectionIdx]?.[fieldIdx];
                const displayValue =
                  rawValue !== undefined &&
                  rawValue !== null &&
                  String(rawValue).trim() !== ""
                    ? String(rawValue)
                    : "N/A";

                doc.roundedRect(22, doc.y, 555, 28, 8).fill("#ffffff");
                doc
                  .fillColor("#0f172a")
                  .font("Helvetica-Bold")
                  .fontSize(9)
                  .text(field.label, 30, doc.y + 6, { width: 500 });

                if (
                  field.type === "select" &&
                  field.options?.includes(displayValue)
                ) {
                  const badgeWidth = doc.widthOfString(displayValue) + 16;
                  const badgeX = 30;
                  const badgeY = doc.y + 18;
                  doc
                    .roundedRect(badgeX, badgeY, badgeWidth, 16, 5)
                    .fill("#10b981");
                  doc
                    .fillColor("white")
                    .font("Helvetica-Bold")
                    .fontSize(8)
                    .text(displayValue, badgeX + 8, badgeY + 4);
                } else {
                  doc
                    .fillColor("#475569")
                    .font("Helvetica")
                    .fontSize(8)
                    .text(displayValue, 30, doc.y + 18, { width: 500 });
                }
                doc.moveDown(2.1);
              });
            }
          });
        }

        // ─── FOOTER ───
        doc.moveDown(0.4);
        doc
          .fillColor("#94a3b8")
          .font("Helvetica")
          .fontSize(7)
          .text("Report Generated: " + new Date().toLocaleString(), {
            align: "center",
          });

        // Finalize PDF
        doc.end();

        // Handle stream events
        stream.on("finish", () => {
          resolve(filePath);
        });

        stream.on("error", (err) => {
          reject(err);
        });

        doc.on("error", (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Delete a PDF file
   * @param {string} fileName - File name to delete
   */
  static async deletePDF(fileName) {
    try {
      const uploadsDir = path.join(
        __dirname,
        "..",
        "..",
        "uploads",
        "daily_reports",
      );
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error deleting PDF:", err);
    }
  }

  /**
   * Get public URL for PDF file
   * @param {string} filePath - Full file path
   * @returns {string} - Public URL
   */
  static getPDFUrl(filePath) {
    const fileName = path.basename(filePath);
    const baseUrl =
      process.env.API_BASE_URL ||
      `http://localhost:${process.env.PORT || 5001}`;
    return `${baseUrl}/uploads/daily_reports/${fileName}`;
  }
}

module.exports = PDFGeneratorService;
