const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadsRoot = path.join(__dirname, "..", "..", "uploads", "teachers");
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : "";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
    cb(null, name);
  },
});

const teacherUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = { teacherUpload };
