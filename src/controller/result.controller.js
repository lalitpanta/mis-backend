const resultService = require("../services/result.service");

class ResultController {
  /**
   * Get all results for a classroom
   * Admins see all, teachers see only their assigned classrooms
   */
  getClassroomResults = async (req, res, next) => {
    try {
      const { classroomId } = req.params;
      const userType = req.user?.type;
      const userId = req.user?.id;

      if (!classroomId) {
        return res.status(400).json({
          success: false,
          message: "Classroom ID is required",
        });
      }

      let results;

      if (userType === "staff") {
        // Teachers can only see their assigned classroom results
        results = await resultService.getTeacherClassroomResults(
          classroomId,
          userId,
          req,
        );
      } else {
        // Tenant admin and system admin can see all results
        results = await resultService.getClassroomResults(classroomId, req);
      }

      return res.status(200).json({
        success: true,
        message: "Classroom results retrieved",
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get result by ID
   */
  getResultById = async (req, res, next) => {
    try {
      const { resultId } = req.params;

      const result = await resultService.getResultById(resultId, req);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Result not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Result retrieved",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Create a new result
   * Only teachers assigned to the classroom can create
   */
  createResult = async (req, res, next) => {
    try {
      const {
        classroom_id,
        student_id,
        subject,
        first_term_marks,
        second_term_marks,
        final_marks,
        grade,
        comments,
      } = req.body;
      const userId = req.user?.id;

      if (!classroom_id || !student_id || !subject) {
        return res.status(400).json({
          success: false,
          message: "Classroom ID, student ID, and subject are required",
        });
      }

      // Verify teacher is assigned to this classroom
      const classroomCheck = await req.tenantPool.query(
        "SELECT id, class_teacher_id FROM classrooms WHERE id = $1",
        [classroom_id],
      );

      if (classroomCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Classroom not found",
        });
      }

      const classroom = classroomCheck.rows[0];

      // Check if user is teacher of this classroom or admin
      if (req.user?.type === "staff" && classroom.class_teacher_id !== userId) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: You are not the teacher for this classroom",
        });
      }

      const resultData = {
        classroom_id,
        student_id,
        subject,
        first_term_marks: first_term_marks || 0,
        second_term_marks: second_term_marks || 0,
        final_marks: final_marks || 0,
        grade: grade || null,
        comments: comments || null,
        created_by: userId,
      };

      const result = await resultService.createResult(resultData, req);

      return res.status(201).json({
        success: true,
        message: "Result created successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Create multiple results at once
   */
  bulkCreateResults = async (req, res, next) => {
    try {
      const { results: resultsData, classroom_id } = req.body;
      const userId = req.user?.id;

      if (!Array.isArray(resultsData) || resultsData.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Results array is required",
        });
      }

      if (!classroom_id) {
        return res.status(400).json({
          success: false,
          message: "Classroom ID is required",
        });
      }

      // Verify teacher is assigned to this classroom
      const classroomCheck = await req.tenantPool.query(
        "SELECT id, class_teacher_id FROM classrooms WHERE id = $1",
        [classroom_id],
      );

      if (classroomCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Classroom not found",
        });
      }

      const classroom = classroomCheck.rows[0];

      if (req.user?.type === "staff" && classroom.class_teacher_id !== userId) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: You are not the teacher for this classroom",
        });
      }

      // Add created_by to all records
      const enrichedResults = resultsData.map((item) => ({
        ...item,
        classroom_id,
        created_by: userId,
      }));

      const results = await resultService.bulkCreateResults(
        enrichedResults,
        req,
      );

      return res.status(201).json({
        success: true,
        message: `${results.length} results created successfully`,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Update a result
   */
  updateResult = async (req, res, next) => {
    try {
      const { resultId } = req.params;
      const {
        first_term_marks,
        second_term_marks,
        final_marks,
        grade,
        comments,
        is_published,
      } = req.body;

      if (!resultId) {
        return res.status(400).json({
          success: false,
          message: "Result ID is required",
        });
      }

      // Get the existing result to check permissions
      const existingResult = await resultService.getResultById(resultId, req);

      if (!existingResult) {
        return res.status(404).json({
          success: false,
          message: "Result not found",
        });
      }

      // Verify teacher is assigned to this classroom
      if (req.user?.type === "staff") {
        const classroomCheck = await req.tenantPool.query(
          "SELECT id, class_teacher_id FROM classrooms WHERE id = $1",
          [existingResult.classroom_id],
        );

        if (
          classroomCheck.rows.length === 0 ||
          classroomCheck.rows[0].class_teacher_id !== req.user?.id
        ) {
          return res.status(403).json({
            success: false,
            message: "Unauthorized: You cannot modify this result",
          });
        }
      }

      const updateData = {
        first_term_marks,
        second_term_marks,
        final_marks,
        grade,
        comments,
        is_published,
      };

      const result = await resultService.updateResult(
        resultId,
        updateData,
        req,
      );

      return res.status(200).json({
        success: true,
        message: "Result updated successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Delete a result
   */
  deleteResult = async (req, res, next) => {
    try {
      const { resultId } = req.params;

      if (!resultId) {
        return res.status(400).json({
          success: false,
          message: "Result ID is required",
        });
      }

      // Get existing result for permission check
      const existingResult = await resultService.getResultById(resultId, req);

      if (!existingResult) {
        return res.status(404).json({
          success: false,
          message: "Result not found",
        });
      }

      // Verify teacher is assigned to this classroom
      if (req.user?.type === "staff") {
        const classroomCheck = await req.tenantPool.query(
          "SELECT id, class_teacher_id FROM classrooms WHERE id = $1",
          [existingResult.classroom_id],
        );

        if (
          classroomCheck.rows.length === 0 ||
          classroomCheck.rows[0].class_teacher_id !== req.user?.id
        ) {
          return res.status(403).json({
            success: false,
            message: "Unauthorized: You cannot delete this result",
          });
        }
      }

      await resultService.deleteResult(resultId, req);

      return res.status(200).json({
        success: true,
        message: "Result deleted successfully",
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get results for a specific student
   */
  getStudentResults = async (req, res, next) => {
    try {
      const { studentId, classroomId } = req.params;

      if (!studentId || !classroomId) {
        return res.status(400).json({
          success: false,
          message: "Student ID and classroom ID are required",
        });
      }

      const results = await resultService.getStudentResults(
        studentId,
        classroomId,
        req,
      );

      return res.status(200).json({
        success: true,
        message: "Student results retrieved",
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Publish all results for a classroom
   */
  publishClassroomResults = async (req, res, next) => {
    try {
      const { classroomId } = req.params;

      if (!classroomId) {
        return res.status(400).json({
          success: false,
          message: "Classroom ID is required",
        });
      }

      // Verify teacher is assigned to this classroom
      if (req.user?.type === "staff") {
        const classroomCheck = await req.tenantPool.query(
          "SELECT id, class_teacher_id FROM classrooms WHERE id = $1",
          [classroomId],
        );

        if (
          classroomCheck.rows.length === 0 ||
          classroomCheck.rows[0].class_teacher_id !== req.user?.id
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Unauthorized: You cannot publish results for this classroom",
          });
        }
      }

      const results = await resultService.publishClassroomResults(
        classroomId,
        req,
      );

      return res.status(200).json({
        success: true,
        message: `${results.length} results published successfully`,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get teacher's assigned classrooms with result summary
   */
  getPublicStudentResults = async (req, res, next) => {
    try {
      const { tenantSlug, rollNumber, dateOfBirth } = req.query;

      if (!rollNumber || !dateOfBirth) {
        return res.status(400).json({
          success: false,
          message: "Roll number and date of birth are required",
        });
      }

      const payload = await resultService.getPublicStudentResults({
        tenantSlug,
        rollNumber,
        dateOfBirth,
      });

      return res.status(200).json({
        success: true,
        message: "Public student results retrieved",
        data: payload,
      });
    } catch (err) {
      console.error("Error fetching public student results:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  publishExamFormat = async (req, res) => {
    try {
      const { id } = req.params;
      const { is_published } = req.body;

      const updatedExam = await resultService.publishExamFormat(
        id,
        is_published,
        req,
      );

      if (!updatedExam) {
        return res
          .status(404)
          .json({ success: false, message: "Exam format not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Exam publication status updated",
        data: updatedExam,
      });
    } catch (err) {
      console.error("Error publishing exam format:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  getTeacherClassrooms = async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (req.user?.type !== "staff") {
        return res.status(403).json({
          success: false,
          message: "Only teachers can access this endpoint",
        });
      }

      const classrooms = await resultService.getTeachersClassrooms(userId, req);

      return res.status(200).json({
        success: true,
        message: "Teacher classrooms retrieved",
        data: classrooms,
      });
    } catch (err) {
      next(err);
    }
  };

  // ===== NEW EXAM FORMAT ENDPOINTS =====
  createExamFormat = async (req, res) => {
    try {
      const examFormat = await resultService.createExamFormat(req.body, req);
      res
        .status(201)
        .json({
          message: "Exam format created",
          success: true,
          data: examFormat,
        });
    } catch (err) {
      console.error("Error creating exam format:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  getExamFormats = async (req, res) => {
    try {
      const filters = {
        class_id: req.query.class_id,
        section_id: req.query.section_id,
        academic_year_id: req.query.academic_year_id,
      };
      const examFormats = await resultService.getExamFormats(filters, req);
      res.json({ success: true, data: examFormats });
    } catch (err) {
      console.error("Error fetching exam formats:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  getExamFormatById = async (req, res) => {
    try {
      const examFormat = await resultService.getExamFormatById(
        req.params.id,
        req,
      );
      if (!examFormat) {
        return res
          .status(404)
          .json({ success: false, message: "Exam format not found" });
      }
      res.json({ success: true, data: examFormat });
    } catch (err) {
      console.error("Error fetching exam format:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  updateExamFormat = async (req, res) => {
    try {
      const examFormat = await resultService.updateExamFormat(
        req.params.id,
        req.body,
        req,
      );
      res.json({
        message: "Exam format updated",
        success: true,
        data: examFormat,
      });
    } catch (err) {
      console.error("Error updating exam format:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  deleteExamFormat = async (req, res) => {
    try {
      await resultService.deleteExamFormat(req.params.id, req);
      res.json({ message: "Exam format deleted", success: true });
    } catch (err) {
      console.error("Error deleting exam format:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  // ===== EXAM SUBJECTS ENDPOINTS =====
  createExamSubject = async (req, res) => {
    try {
      const examSubject = await resultService.createExamSubject(req.body, req);
      res
        .status(201)
        .json({
          message: "Exam subject created",
          success: true,
          data: examSubject,
        });
    } catch (err) {
      console.error("Error creating exam subject:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  getExamSubjects = async (req, res) => {
    try {
      const examSubjects = await resultService.getExamSubjects(
        req.params.exam_format_id,
        req,
      );
      res.json({ success: true, data: examSubjects });
    } catch (err) {
      console.error("Error fetching exam subjects:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  updateExamSubject = async (req, res) => {
    try {
      const examSubject = await resultService.updateExamSubject(
        req.params.id,
        req.body,
        req,
      );
      res.json({
        message: "Exam subject updated",
        success: true,
        data: examSubject,
      });
    } catch (err) {
      console.error("Error updating exam subject:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  deleteExamSubject = async (req, res) => {
    try {
      await resultService.deleteExamSubject(req.params.id, req);
      res.json({ message: "Exam subject deleted", success: true });
    } catch (err) {
      console.error("Error deleting exam subject:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  // ===== STUDENT MARKS ENDPOINTS =====
  createOrUpdateStudentMark = async (req, res) => {
    try {
      const studentMark = await resultService.createOrUpdateStudentMark(
        req.body,
        req,
      );
      res
        .status(201)
        .json({
          message: "Student marks saved",
          success: true,
          data: studentMark,
        });
    } catch (err) {
      console.error("Error saving student marks:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  getStudentMarksByExam = async (req, res) => {
    try {
      const marks = await resultService.getStudentMarksByExam(
        req.params.exam_format_id,
        req,
      );
      res.json({ success: true, data: marks });
    } catch (err) {
      console.error("Error fetching student marks:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  getStudentMarksByStudent = async (req, res) => {
    try {
      const marks = await resultService.getStudentMarksByStudent(
        req.params.exam_format_id,
        req.params.student_id,
        req,
      );
      res.json({ success: true, data: marks });
    } catch (err) {
      console.error("Error fetching student marks:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  getClassStudents = async (req, res) => {
    try {
      const students = await resultService.getClassStudents(
        req.query.class_id,
        req.query.section_id,
        req,
      );
      res.json({ success: true, data: students });
    } catch (err) {
      console.error("Error fetching class students:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  deleteStudentMark = async (req, res) => {
    try {
      await resultService.deleteStudentMark(req.params.id, req);
      res.json({ message: "Student mark deleted", success: true });
    } catch (err) {
      console.error("Error deleting student mark:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  getClassCourses = async (req, res) => {
    try {
      const courses = await resultService.getClassCourses(
        req.params.class_id,
        req,
      );
      res.json({ success: true, data: courses });
    } catch (err) {
      console.error("Error fetching class courses:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  };
}

module.exports = new ResultController();
