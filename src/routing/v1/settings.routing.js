const express = require("express");
const router = express.Router();
const settingsCTRL = require("../../controller/settings.controller");
const noticesCTRL = require("../../controller/notices.controller");

if (process.env.NODE_ENV !== "production") {
  router.use((req, res, next) => {
    console.log(`[settings.routing] ${req.method} ${req.originalUrl}`);
    next();
  });
}

/**
 * @route GET /api/v1/settings
 * @desc Get all application settings
 * @access Public (or Restricted depending on requirements)
 */
router.get("/", settingsCTRL.getAllSettings);

/**
 * @route PATCH /api/v1/settings
 * @desc Update multiple settings
 * @access Admin
 */
router.patch("/", settingsCTRL.updateSettings);

/**
 * School profile endpoints
 */
router.get("/school", settingsCTRL.getSchoolProfile);
router.put("/school", settingsCTRL.updateSchoolProfile);

// Test email endpoint
router.post("/test-email", settingsCTRL.sendTestEmail);

// Notification settings
router.get("/notifications", settingsCTRL.getNotificationSettings);
router.put("/notifications", settingsCTRL.updateNotificationSettings);

/**
 * Room management endpoints
 */
router.get("/rooms", settingsCTRL.getRooms);
router.post("/rooms", settingsCTRL.createRoom);
router.get("/rooms/:id", settingsCTRL.getRoom);
router.put("/rooms/:id", settingsCTRL.updateRoom);
router.delete("/rooms/:id", settingsCTRL.deleteRoom);

router.options("*", (req, res) => res.sendStatus(200));

router.get("/notices", noticesCTRL.listNotices);
router.post("/notices", noticesCTRL.createNotice);
router.put("/notices/:id", noticesCTRL.updateNotice);
router.delete("/notices/:id", noticesCTRL.deleteNotice);
router.post("/notices/:id/read", noticesCTRL.markNoticeRead);
router.post("/notices/:id/pin", noticesCTRL.togglePin);
router.post("/notices/:id/archive", noticesCTRL.archiveNotice);
router.post("/notices/:id/send-email", noticesCTRL.sendNoticeEmail);

router.get("/sms", noticesCTRL.getSmsConfig);
router.get("/sms-config", noticesCTRL.getSmsConfig);
router.get("/sms/config", noticesCTRL.getSmsConfig);
router.put("/sms/config", noticesCTRL.updateSmsConfig);
router.get("/sms/templates", noticesCTRL.getSmsTemplates);
router.post("/sms/templates", noticesCTRL.createSmsTemplate);
router.put("/sms/templates/:id", noticesCTRL.updateSmsTemplate);
router.delete("/sms/templates/:id", noticesCTRL.deleteSmsTemplate);
router.post("/sms/send", noticesCTRL.sendSms);
router.get("/sms/logs", noticesCTRL.getSmsLogs);

// Theme settings
router.get("/theme", settingsCTRL.getThemeSettings);
router.put("/theme", settingsCTRL.updateThemeSettings);

// Students management under settings
const studentsCTRL = require("../../controller/students.controller");
const { studentUpload } = require("../../middleware/studentUpload");
router.get("/students", studentsCTRL.list);
router.post(
  "/students",
  studentUpload.fields([
    { name: "profile_picture_file", maxCount: 1 },
    { name: "documents", maxCount: 50 },
  ]),
  studentsCTRL.create,
);
router.patch(
  "/students/:id",
  studentUpload.fields([
    { name: "profile_picture_file", maxCount: 1 },
    { name: "documents", maxCount: 50 },
  ]),
  studentsCTRL.update,
);
router.delete("/students/:id", studentsCTRL.remove);
router.post("/students/import", studentsCTRL.importBulk);
router.get("/students/export", studentsCTRL.exportCsv);
router.delete("/students/:id/documents/:docId", studentsCTRL.removeDocument);

// Classroom Management (under classroom module - handles rooms, classes, and sections)
const classroomCTRL = require("../../controller/classroom.controller");
router.get("/classrooms", classroomCTRL.list);
router.post("/classrooms", classroomCTRL.create);
router.put("/classrooms/:id", classroomCTRL.update);
router.delete("/classrooms/:id", classroomCTRL.remove);
router.post("/classrooms/:id/sections", classroomCTRL.createSections);
router.get("/classrooms/:id/sections", classroomCTRL.listSections);
router.put("/classrooms/sections/:sectionId", classroomCTRL.updateSection);
router.delete("/classrooms/sections/:sectionId", classroomCTRL.deleteSection);

// Rooms (Physical spaces) - Part of settings
const roomsController = require("../../controller/rooms.controller");
router.get("/rooms", roomsController.getAll);
router.get("/rooms/:id", roomsController.getById);
router.post("/rooms", roomsController.create);
router.put("/rooms/:id", roomsController.update);
router.delete("/rooms/:id", roomsController.delete);

// Classes (Class definitions) - Part of settings
const classesController = require("../../controller/classes.controller");
router.get("/classes", classesController.getAll);
router.get("/classes/:id", classesController.getById);
router.post("/classes", classesController.create);
router.put("/classes/:id", classesController.update);
router.delete("/classes/:id", classesController.delete);

// Sections (Class instances) - Part of settings
const sectionsController = require("../../controller/sections.controller");
router.get("/sections", sectionsController.getAll);
router.get("/sections/:id", sectionsController.getById);
router.get("/sections/by-room/:roomId", sectionsController.getByRoomId);
router.get("/sections/by-class/:classId", sectionsController.getByClassId);
router.post("/sections", sectionsController.create);
router.put("/sections/:id", sectionsController.update);
router.delete("/sections/:id", sectionsController.delete);

// Teachers for dropdowns
const userController = require("../../controller/user.controller");
router.get("/teachers", userController.getTeachers);

// Courses management
const coursesController = require("../../controller/courses.controller");
router.get("/courses", coursesController.list);
router.get("/courses/:id", coursesController.get);
router.post("/courses", coursesController.create);
router.put("/courses/:id", coursesController.update);
router.delete("/courses/:id", coursesController.remove);

module.exports = router;
