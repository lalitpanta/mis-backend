const express = require("express");
const resultController = require("../../controller/result.controller");

const router = express.Router();

/**
 * @route   GET /v1/results/classroom/:classroomId
 * @desc    Get all results for a classroom (teachers only see their classrooms)
 * @access  Private (staff/tenant/admin)
 */
router.get("/classroom/:classroomId", resultController.getClassroomResults);

/**
 * @route   GET /v1/results/student/:studentId/classroom/:classroomId
 * @desc    Get all results for a specific student
 * @access  Private
 */
router.get(
  "/student/:studentId/classroom/:classroomId",
  resultController.getStudentResults,
);

/**
 * @route   GET /v1/results/teacher/classrooms
 * @desc    Get all classrooms assigned to the teacher with result summary
 * @access  Private (staff/teacher only)
 */
router.get("/teacher/classrooms", resultController.getTeacherClassrooms);

/**
 * @route   POST /v1/results/classroom/:classroomId/publish
 * @desc    Publish/finalize all results for a classroom
 * @access  Private (teacher/tenant/admin)
 */
router.post(
  "/classroom/:classroomId/publish",
  resultController.publishClassroomResults,
);

// ===== NEW EXAM FORMAT ROUTES =====
/**
 * @route   POST /v1/results/exam-formats
 * @desc    Create a new exam format
 * @access  Private (staff/tenant/admin)
 */
router.post("/exam-formats", resultController.createExamFormat);

/**
 * @route   GET /v1/results/exam-formats
 * @desc    Get exam formats with filters
 * @access  Private
 */
router.get("/exam-formats", resultController.getExamFormats);

/**
 * @route   GET /v1/results/exam-formats/:id
 * @desc    Get a specific exam format
 * @access  Private
 */
router.get("/exam-formats/:id", resultController.getExamFormatById);

/**
 * @route   PATCH /v1/results/exam-formats/:id/publish
 * @desc    Publish or unpublish an exam format
 * @access  Private (staff/tenant/admin)
 */
router.patch("/exam-formats/:id/publish", resultController.publishExamFormat);

/**
 * @route   PATCH /v1/results/exam-formats/:id
 * @desc    Update an exam format
 * @access  Private (staff/tenant/admin)
 */
router.patch("/exam-formats/:id", resultController.updateExamFormat);

/**
 * @route   DELETE /v1/results/exam-formats/:id
 * @desc    Delete an exam format
 * @access  Private (staff/tenant/admin)
 */
router.delete("/exam-formats/:id", resultController.deleteExamFormat);

// ===== EXAM SUBJECTS ROUTES =====
/**
 * @route   POST /v1/results/exam-subjects
 * @desc    Create a new exam subject
 * @access  Private (staff/tenant/admin)
 */
router.post("/exam-subjects", resultController.createExamSubject);

/**
 * @route   GET /v1/results/exam-subjects/:exam_format_id
 * @desc    Get subjects for an exam format
 * @access  Private
 */
router.get("/exam-subjects/:exam_format_id", resultController.getExamSubjects);

/**
 * @route   PATCH /v1/results/exam-subjects/:id
 * @desc    Update an exam subject
 * @access  Private (staff/tenant/admin)
 */
router.patch("/exam-subjects/:id", resultController.updateExamSubject);

/**
 * @route   DELETE /v1/results/exam-subjects/:id
 * @desc    Delete an exam subject
 * @access  Private (staff/tenant/admin)
 */
router.delete("/exam-subjects/:id", resultController.deleteExamSubject);

// ===== STUDENT MARKS ROUTES =====
/**
 * @route   POST /v1/results/student-marks
 * @desc    Create or update student marks
 * @access  Private (staff/tenant/admin)
 */
router.post("/student-marks", resultController.createOrUpdateStudentMark);

/**
 * @route   GET /v1/results/student-marks/exam/:exam_format_id
 * @desc    Get all marks for an exam
 * @access  Private
 */
router.get(
  "/student-marks/exam/:exam_format_id",
  resultController.getStudentMarksByExam,
);

/**
 * @route   GET /v1/results/student-marks/:exam_format_id/:student_id
 * @desc    Get marks for a specific student in an exam
 * @access  Private
 */
router.get(
  "/student-marks/:exam_format_id/:student_id",
  resultController.getStudentMarksByStudent,
);

/**
 * @route   DELETE /v1/results/student-marks/:id
 * @desc    Delete a student mark record
 * @access  Private (staff/tenant/admin)
 */
router.delete("/student-marks/:id", resultController.deleteStudentMark);

// ===== HELPER ROUTES =====
/**
 * @route   GET /v1/results/public
 * @desc    Look up published student results by tenant slug, roll number, and DOB
 * @access  Public
 */
router.get("/public", resultController.getPublicStudentResults);

/**
 * @route   GET /v1/results/class-students
 * @desc    Get all students in a class/section
 * @access  Private
 */
router.get("/class-students", resultController.getClassStudents);

/**
 * @route   GET /v1/results/class-courses/:class_id
 * @desc    Get all courses for a class
 * @access  Private
 */
router.get("/class-courses/:class_id", resultController.getClassCourses);

// ===== LEGACY RESULTS ROUTES =====
/**
 * @route   GET /v1/results/:resultId
 * @desc    Get a specific result by ID
 * @access  Private
 */
router.get("/:resultId", resultController.getResultById);

/**
 * @route   POST /v1/results
 * @desc    Create a new result
 * @access  Private (staff/tenant/admin)
 */
router.post("/", resultController.createResult);

/**
 * @route   POST /v1/results/bulk
 * @desc    Create multiple results at once
 * @access  Private (staff/tenant/admin)
 */
router.post("/bulk", resultController.bulkCreateResults);

/**
 * @route   PATCH /v1/results/:resultId
 * @desc    Update a result
 * @access  Private (staff/tenant/admin)
 */
router.patch("/:resultId", resultController.updateResult);

/**
 * @route   DELETE /v1/results/:resultId
 * @desc    Delete a result
 * @access  Private (staff/tenant/admin)
 */
router.delete("/:resultId", resultController.deleteResult);

module.exports = router;
