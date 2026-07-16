const express = require("express");
const router = express.Router();
const teacherCTRL = require("../../controller/teacher.controller");
const { teacherUpload } = require("../../middleware/teacherUpload");

router.get("/options", teacherCTRL.options);
router.get("/", teacherCTRL.list);
router.get("/export", teacherCTRL.export);
router.get("/:id/download/:filename", teacherCTRL.downloadDocument);
router.get("/:id", teacherCTRL.get);
router.post("/import", teacherUpload.single("file"), teacherCTRL.import);
router.post(
  "/",
  teacherUpload.fields([
    { name: "profile_picture_file", maxCount: 1 },
    { name: "documents", maxCount: 20 },
  ]),
  teacherCTRL.create,
);
router.patch(
  "/:id",
  teacherUpload.fields([
    { name: "profile_picture_file", maxCount: 1 },
    { name: "documents", maxCount: 20 },
  ]),
  teacherCTRL.update,
);
router.delete("/:id", teacherCTRL.remove);

module.exports = router;
