const express = require("express");
const router = express.Router();
const studentsCTRL = require("../../controller/students.controller");
const { studentUpload } = require("../../middleware/studentUpload");

router.get("/", studentsCTRL.list);
router.get("/export", studentsCTRL.exportCsv);
router.get("/:id", studentsCTRL.get);
// accept profile picture and multiple document files
router.post(
  "/",
  studentUpload.fields([
    { name: "profile_picture_file", maxCount: 1 },
    { name: "documents", maxCount: 50 },
  ]),
  studentsCTRL.create,
);
router.post("/bulk/import", studentsCTRL.importBulk);
router.patch(
  "/:id",
  studentUpload.fields([
    { name: "profile_picture_file", maxCount: 1 },
    { name: "documents", maxCount: 50 },
  ]),
  studentsCTRL.update,
);
router.delete("/:id/documents/:docId", studentsCTRL.removeDocument);
router.delete("/:id", studentsCTRL.remove);

module.exports = router;
