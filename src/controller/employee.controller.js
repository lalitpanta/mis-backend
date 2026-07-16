const employeeService = require("../services/employee.service");
const { v4: uuidv4 } = require("uuid");

class EmployeeController {
  _extractUploadFiles = (req) => {
    const files = req.files || {};
    const photographFile = Array.isArray(files.photograph)
      ? files.photograph[0]
      : req.file || null;
    const documentFiles = Array.isArray(files.documents)
      ? files.documents
      : Array.isArray(req.files)
        ? req.files
        : [];

    return { photographFile, documentFiles };
  };

  list = async (req, res, next) => {
    try {
      console.log("[Employee List] User:", req.user);
      const filters = {
        search: req.query.search,
        department_id: req.query.department_id,
        designation: req.query.designation,
      };
      const employees = await employeeService.listEmployees(req, filters);
      console.log("[Employee List] Found", employees.length, "employees");
      return res
        .status(200)
        .json({ message: "Employees retrieved", data: employees });
    } catch (err) {
      console.error("[Employee List] Error:", err.message);
      next(err);
    }
  };

  get = async (req, res, next) => {
    try {
      const employee = await employeeService.getEmployee(req.params.id, req);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      return res
        .status(200)
        .json({ message: "Employee retrieved", data: employee });
    } catch (err) {
      next(err);
    }
  };

  options = async (req, res, next) => {
    try {
      const employees = await employeeService.listEmployeeOptions(req);
      return res.status(200).json({
        message: "Employee options retrieved",
        data: employees,
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (req, res, next) => {
    try {
      let payload = req.body || {};
      const { photographFile, documentFiles } = this._extractUploadFiles(req);

      // Parse any stringified JSON fields
      Object.keys(payload).forEach((key) => {
        if (typeof payload[key] === "string" && payload[key].startsWith("{")) {
          try {
            payload[key] = JSON.parse(payload[key]);
          } catch (e) {
            // Keep as string if JSON parsing fails
          }
        }
      });

      if (photographFile) {
        payload.photograph_url = `/uploads/employees/${photographFile.filename}`;
      }

      if (Array.isArray(documentFiles) && documentFiles.length > 0) {
        payload.documents = documentFiles.map((file) => ({
          url: `/uploads/employees/${file.filename}`,
          title: file.originalname || file.filename,
          uploadedAt: new Date().toISOString(),
          filename: file.filename,
        }));
      } else {
        payload.documents = [];
      }

      const created = await employeeService.createEmployee(payload, req);
      return res.status(201).json({
        message: "Employee created",
        data: created,
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (req, res, next) => {
    try {
      let payload = req.body || {};
      const { photographFile, documentFiles } = this._extractUploadFiles(req);

      // Parse any stringified JSON fields
      Object.keys(payload).forEach((key) => {
        if (typeof payload[key] === "string" && payload[key].startsWith("{")) {
          try {
            payload[key] = JSON.parse(payload[key]);
          } catch (e) {
            // Keep as string if JSON parsing fails
          }
        }
      });

      if (photographFile) {
        payload.photograph_url = `/uploads/employees/${photographFile.filename}`;
      }

      // Handle document updates
      if (Array.isArray(documentFiles) && documentFiles.length > 0) {
        const existingEmployee = await employeeService.getEmployee(
          req.params.id,
          req,
        );
        const existingDocs = existingEmployee?.documents || [];

        const newDocs = documentFiles.map((file) => ({
          url: `/uploads/employees/${file.filename}`,
          title: file.originalname || file.filename,
          uploadedAt: new Date().toISOString(),
          filename: file.filename,
        }));

        payload.documents = [...existingDocs, ...newDocs];
      }

      const updated = await employeeService.updateEmployee(
        req.params.id,
        payload,
        req,
      );
      return res
        .status(200)
        .json({ message: "Employee updated", data: updated });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req, res, next) => {
    try {
      const removed = await employeeService.deleteEmployee(req.params.id, req);
      if (!removed) {
        return res.status(404).json({ message: "Employee not found" });
      }
      return res
        .status(200)
        .json({ message: "Employee deleted", data: removed });
    } catch (err) {
      next(err);
    }
  };

  downloadDocument = async (req, res, next) => {
    try {
      const { id, filename } = req.params;

      // Permission check
      if (req.user.type !== "system_admin" && req.user.id !== id) {
        return res.status(403).json({
          success: false,
          message: "Access denied - you can only download your own documents",
        });
      }

      // Verify employee exists
      const employee = await employeeService.getEmployee(id, req);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Verify document exists
      const doc = (employee.documents || []).find(
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
        "employees",
        filename,
      );

      // Security: Check file exists and is in correct directory
      const realPath = fs.realpathSync(path.dirname(filePath));
      const uploadDir = fs.realpathSync(
        path.join(__dirname, "..", "..", "uploads", "employees"),
      );
      if (!realPath.startsWith(uploadDir)) {
        return res
          .status(403)
          .json({ message: "Access denied - invalid file path" });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      const fileName = doc.title || filename;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.setHeader("Content-Type", "application/octet-stream");

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on("error", (err) => {
        console.error("[Employee Download] Error streaming file:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error downloading file" });
        }
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = new EmployeeController();
