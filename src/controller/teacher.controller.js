const teacherService = require("../services/teacher.service");
const { v4: uuidv4 } = require("uuid");

class TeacherController {
  _extractUploadFiles = (req) => {
    const files = req.files || {};
    const profilePhotoFile = Array.isArray(files.profile_picture_file)
      ? files.profile_picture_file[0]
      : req.file || null;
    const documentFiles = Array.isArray(files.documents)
      ? files.documents
      : Array.isArray(req.files)
        ? req.files
        : [];

    return { profilePhotoFile, documentFiles };
  };

  list = async (req, res, next) => {
    try {
      const filters = {
        search: req.query.search,
        department_id: req.query.department_id,
        designation: req.query.designation,
      };
      const teachers = await teacherService.listTeachers(req, filters);
      return res
        .status(200)
        .json({ message: "Teachers retrieved", data: teachers });
    } catch (err) {
      next(err);
    }
  };

  export = async (req, res, next) => {
    try {
      const filters = {
        search: req.query.search,
        department_id: req.query.department_id,
        designation: req.query.designation,
      };
      const rows = await teacherService.listTeachers(req, filters);
      // build CSV
      const headers = [
        "id",
        "employee_id",
        "full_name",
        "designation",
        "department_id",
        "work_email",
        "personal_email",
        "personal_phone",
        "work_phone",
        "is_active",
      ];
      const csvLines = [headers.join(",")];
      rows.forEach((r) => {
        const line = headers
          .map((h) => {
            const v =
              r[h] === null || r[h] === undefined
                ? ""
                : String(r[h]).replace(/"/g, '""');
            return `"${v}"`;
          })
          .join(",");
        csvLines.push(line);
      });
      const csv = csvLines.join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="teachers_export.csv"',
      );
      return res.send(csv);
    } catch (err) {
      next(err);
    }
  };

  import = async (req, res, next) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });
      const path = require("path");
      const fs = require("fs");
      const filePath = req.file.path;
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2)
        return res.status(400).json({ message: "Empty CSV" });
      const headers = lines[0]
        .split(",")
        .map((h) => h.replace(/(^"|"$)/g, "").trim());
      const created = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]
          .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map((c) => c.replace(/(^"|"$)/g, ""));
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] || "";
        });
        // map CSV columns to teacher fields minimally
        const payload = {
          employee_id: obj.employee_id || undefined,
          full_name: obj.full_name || undefined,
          designation: obj.designation || undefined,
          department_id: obj.department_id || undefined,
          work_email: obj.work_email || undefined,
          personal_email: obj.personal_email || undefined,
          personal_phone: obj.personal_phone || undefined,
          work_phone: obj.work_phone || undefined,
          is_active:
            obj.is_active === "true" ||
            obj.is_active === "1" ||
            obj.is_active === "TRUE",
        };
        const teacher = await teacherService.createTeacher(payload, req);
        created.push(teacher);
      }
      return res.status(201).json({
        message: "Imported teachers",
        count: created.length,
        data: created,
      });
    } catch (err) {
      next(err);
    }
  };

  options = async (req, res, next) => {
    try {
      const teachers = await teacherService.listTeacherOptions(req);
      return res
        .status(200)
        .json({ message: "Teacher options retrieved", data: teachers });
    } catch (err) {
      next(err);
    }
  };

  get = async (req, res, next) => {
    try {
      const teacher = await teacherService.getTeacher(req.params.id, req);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }
      return res
        .status(200)
        .json({ message: "Teacher retrieved", data: teacher });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      const payload = req.body || {};
      const { profilePhotoFile, documentFiles } = this._extractUploadFiles(req);

      // handle profile photo upload
      if (profilePhotoFile) {
        payload.profile_photo_url = `/uploads/teachers/${profilePhotoFile.filename}`;
      }

      // handle document uploads
      console.log(
        "[Teacher Create] req.files:",
        documentFiles.length ? `${documentFiles.length} files` : "no files",
      );
      if (documentFiles.length) {
        let titles = [];
        if (req.body.document_titles) {
          try {
            titles = JSON.parse(req.body.document_titles);
          } catch (e) {
            titles = Array.isArray(req.body.document_titles)
              ? req.body.document_titles
              : [req.body.document_titles];
          }
        }
        const docs = documentFiles.map((f, i) => ({
          id: uuidv4(),
          title: titles[i] || f.originalname,
          url: `/uploads/teachers/${f.filename}`,
          uploaded_at: new Date().toISOString(),
        }));
        console.log("[Teacher Create] Created docs:", docs);
        payload.documents = docs;
      }

      const teacher = await teacherService.createTeacher(payload, req);
      return res
        .status(201)
        .json({ message: "Teacher created", data: teacher });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      const payload = req.body || {};
      const { profilePhotoFile, documentFiles } = this._extractUploadFiles(req);
      // profile photo
      if (profilePhotoFile) {
        payload.profile_photo_url = `/uploads/teachers/${profilePhotoFile.filename}`;
      }

      // documents: append to existing
      console.log(
        "[Teacher Update] req.files:",
        documentFiles.length ? `${documentFiles.length} files` : "no files",
        "req.params.id:",
        req.params.id,
      );
      if (documentFiles.length) {
        const existing = await teacherService.getTeacher(req.params.id, req);
        const existingDocs = existing?.documents || [];
        let titles = [];
        if (req.body.document_titles) {
          try {
            titles = JSON.parse(req.body.document_titles);
          } catch (e) {
            titles = Array.isArray(req.body.document_titles)
              ? req.body.document_titles
              : [req.body.document_titles];
          }
        }
        const newDocs = documentFiles.map((f, i) => ({
          id: uuidv4(),
          title: titles[i] || f.originalname,
          url: `/uploads/teachers/${f.filename}`,
          uploaded_at: new Date().toISOString(),
        }));
        console.log(
          "[Teacher Update] Existing docs:",
          existingDocs,
          "New docs:",
          newDocs,
        );
        payload.documents = Array.isArray(existingDocs)
          ? [...existingDocs, ...newDocs]
          : [...(existingDocs || []), ...newDocs];
        console.log(
          "[Teacher Update] Final payload.documents:",
          payload.documents,
        );
      }

      const teacher = await teacherService.updateTeacher(
        req.params.id,
        payload,
        req,
      );
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }
      return res
        .status(200)
        .json({ message: "Teacher updated", data: teacher });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const removed = await teacherService.deleteTeacher(req.params.id, req);
      if (!removed) {
        return res.status(404).json({ message: "Teacher not found" });
      }
      return res
        .status(200)
        .json({ message: "Teacher deleted", data: removed });
    } catch (err) {
      next(err);
    }
  };

  downloadDocument = async (req, res, next) => {
    try {
      const { id, filename } = req.params;

      // Permission check: Allow system_admin to access any teacher's documents
      // For other users, only allow if they're accessing their own teacher record
      if (req.user.type !== "system_admin" && req.user.id !== id) {
        return res.status(403).json({
          success: false,
          message: "Access denied - you can only download your own documents",
        });
      }

      // Verify teacher exists
      const teacher = await teacherService.getTeacher(id, req);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      // Verify document exists in teacher's documents array
      const doc = (teacher.documents || []).find(
        (d) => d.url && d.url.includes(filename),
      );
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }

      const fs = require("fs");
      const path = require("path");
      const filePath = path.join(
        __dirname,
        "..",
        "..",
        "uploads",
        "teachers",
        filename,
      );

      // Security: Check file exists and is in the correct directory
      const realPath = fs.realpathSync(path.dirname(filePath));
      const uploadDir = fs.realpathSync(
        path.join(__dirname, "..", "..", "uploads", "teachers"),
      );
      if (!realPath.startsWith(uploadDir)) {
        return res
          .status(403)
          .json({ message: "Access denied - invalid file path" });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      // Set response headers for download
      const fileName = doc.title || filename;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.setHeader("Content-Type", "application/octet-stream");

      // Stream file to response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on("error", (err) => {
        console.error("[Teacher Download] Error streaming file:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error downloading file" });
        }
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new TeacherController();
