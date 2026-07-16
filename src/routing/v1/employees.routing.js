const express = require("express");
const router = express.Router();
const employeeCTRL = require("../../controller/employee.controller");
const { employeeUpload } = require("../../middleware/employeeUpload");

router.get("/options", employeeCTRL.options);
router.get("/", employeeCTRL.list);
router.get("/:id/download/:filename", employeeCTRL.downloadDocument);
router.get("/:id", employeeCTRL.get);
router.post(
  "/",
  employeeUpload.fields([
    { name: "photograph", maxCount: 1 },
    { name: "documents", maxCount: 20 },
  ]),
  employeeCTRL.create,
);
router.patch(
  "/:id",
  employeeUpload.fields([
    { name: "photograph", maxCount: 1 },
    { name: "documents", maxCount: 20 },
  ]),
  employeeCTRL.update,
);
router.delete("/:id", employeeCTRL.remove);

module.exports = router;
