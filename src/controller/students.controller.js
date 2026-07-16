const studentsService = require("../services/students.service");

class StudentsController {
  list = async (req, res, next) => {
    try {
      const rows = await studentsService.list(req);
      return res
        .status(200)
        .json({ message: "Students retrieved", data: rows });
    } catch (err) {
      next(err);
    }
  };

  get = async (req, res, next) => {
    try {
      const student = await studentsService.get(req.params.id, req);
      if (!student)
        return res.status(404).json({ message: "Student not found" });
      return res
        .status(200)
        .json({ message: "Student retrieved", data: student });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const payload = req.body || {};
      // handle profile picture
      if (
        req.files &&
        req.files.profile_picture_file &&
        req.files.profile_picture_file[0]
      ) {
        payload.profile_picture = `/uploads/students/${req.files.profile_picture_file[0].filename}`;
      }
      // handle document uploads (append JSON entries)
      if (req.files && req.files.documents && req.files.documents.length) {
        const titlesRaw = req.body.document_titles;
        let titles = [];
        if (titlesRaw) {
          try {
            titles = JSON.parse(titlesRaw);
          } catch (e) {
            titles = Array.isArray(titlesRaw) ? titlesRaw : [titlesRaw];
          }
        }
        const docs = req.files.documents.map((f, i) => ({
          id: Date.now().toString(36) + "-" + i,
          title: titles[i] || f.originalname,
          url: `/uploads/students/${f.filename}`,
          uploaded_at: new Date().toISOString(),
        }));
        payload.documents = docs;
      }
      const created = await studentsService.create(payload, req);

      // Trigger email notification for new student
      if (created && created.student_mail) {
        const emailService = require("../services/email.service");
        // Do not await to avoid blocking the response
        emailService
          .sendEmailForEvent(req, "student_created", {
            to: created.student_mail,
            studentName: created.full_name || "Student",
            admissionNo: created.admission_no || "N/A",
            schoolName: "Our School", // You could fetch this from settings if needed
          })
          .catch((err) => console.error("Email error:", err));
      }

      // Trigger WhatsApp notification for new student
      if (created) {
        const whatsappService = require("../services/whatsapp.service");
        whatsappService
          .sendWhatsAppForEvent(req, "student_created", {
            to: created.phone_no || created.guardian_phone,
            studentName: created.full_name || "Student",
            admissionNo: created.admission_no || "N/A",
            schoolName: "Our School",
          })
          .catch((err) => console.error("WhatsApp error:", err));
      }

      return res
        .status(201)
        .json({ message: "Student created", data: created });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const payload = req.body || {};
      if (
        req.files &&
        req.files.profile_picture_file &&
        req.files.profile_picture_file[0]
      ) {
        payload.profile_picture = `/uploads/students/${req.files.profile_picture_file[0].filename}`;
      }
      if (req.files && req.files.documents && req.files.documents.length) {
        const existing = await studentsService.get(req.params.id, req);
        const existingDocs = existing?.documents || [];
        const titlesRaw = req.body.document_titles;
        let titles = [];
        if (titlesRaw) {
          try {
            titles = JSON.parse(titlesRaw);
          } catch (e) {
            titles = Array.isArray(titlesRaw) ? titlesRaw : [titlesRaw];
          }
        }
        const newDocs = req.files.documents.map((f, i) => ({
          id: Date.now().toString(36) + "-" + i,
          title: titles[i] || f.originalname,
          url: `/uploads/students/${f.filename}`,
          uploaded_at: new Date().toISOString(),
        }));
        payload.documents = Array.isArray(existingDocs)
          ? [...existingDocs, ...newDocs]
          : [...(existingDocs || []), ...newDocs];
      }
      const updated = await studentsService.update(req.params.id, payload, req);
      return res
        .status(200)
        .json({ message: "Student updated", data: updated });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const deleted = await studentsService.remove(req.params.id, req);
      if (!deleted)
        return res.status(404).json({ message: "Student not found" });
      return res
        .status(200)
        .json({ message: "Student deleted", data: deleted });
    } catch (err) {
      next(err);
    }
  };

  removeDocument = async (req, res, next) => {
    try {
      const { id, docId } = req.params;
      const updated = await studentsService.removeDocument(id, docId, req);
      if (!updated)
        return res
          .status(404)
          .json({ message: "Student or document not found" });
      return res
        .status(200)
        .json({ message: "Document removed", data: updated });
    } catch (err) {
      next(err);
    }
  };

  importBulk = async (req, res, next) => {
    try {
      const payload = req.body?.students || [];
      const created = await studentsService.importBulk(payload, req);
      return res
        .status(200)
        .json({ message: "Students imported", data: created });
    } catch (err) {
      next(err);
    }
  };

  exportCsv = async (req, res, next) => {
    try {
      const csv = await studentsService.exportCsv(req);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=students.csv");
      return res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new StudentsController();
