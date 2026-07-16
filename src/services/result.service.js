class ResultService {
  ensure = async (pool) => {
    const client = await pool.connect();
    try {
      // Ensure UUID extension
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

      // 1. Exam Formats Table - stores exam configuration for class/section
      await client.query(`
        CREATE TABLE IF NOT EXISTS exam_formats (
          id SERIAL PRIMARY KEY,
          exam_type VARCHAR(100) NOT NULL,
          class_id INTEGER,
          section_id INTEGER,
          academic_year_id UUID REFERENCES "year"(id) ON DELETE CASCADE,
          term VARCHAR(100),
          exam_date DATE,
          pass_mark_percentage NUMERIC(5,2) DEFAULT 40.00,
          created_by UUID,
          is_active BOOLEAN DEFAULT TRUE,
          is_published BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        ALTER TABLE exam_formats
        ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE
      `);

      // 2. Exam Subjects Table - stores subjects and their max marks for an exam
      await client.query(`
        CREATE TABLE IF NOT EXISTS exam_subjects (
          id SERIAL PRIMARY KEY,
          exam_format_id INTEGER REFERENCES exam_formats(id) ON DELETE CASCADE,
          course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
          subject_name VARCHAR(255) NOT NULL,
          theory_max_marks INTEGER DEFAULT 0,
          practical_max_marks INTEGER DEFAULT 0,
          total_max_marks INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 3. Student Marks Table - stores individual student marks
      await client.query(`
        CREATE TABLE IF NOT EXISTS student_marks (
          id SERIAL PRIMARY KEY,
          exam_format_id INTEGER REFERENCES exam_formats(id) ON DELETE CASCADE,
          exam_subject_id INTEGER REFERENCES exam_subjects(id) ON DELETE CASCADE,
          student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
          theory_marks NUMERIC(6,2),
          practical_marks NUMERIC(6,2),
          total_marks NUMERIC(6,2),
          is_pass BOOLEAN DEFAULT FALSE,
          remarks VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for performance
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_exam_formats_class ON exam_formats(class_id)`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_exam_formats_section ON exam_formats(section_id)`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_exam_formats_year ON exam_formats(academic_year_id)`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON exam_subjects(exam_format_id)`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_student_marks_exam ON student_marks(exam_format_id)`,
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_student_marks_student ON student_marks(student_id)`,
      );

      // Drop old foreign key constraints if they exist, to allow linking to the new classrooms tables
      try {
        await client.query(
          "ALTER TABLE exam_formats DROP CONSTRAINT IF EXISTS exam_formats_class_id_fkey",
        );
        await client.query(
          "ALTER TABLE exam_formats DROP CONSTRAINT IF EXISTS exam_formats_section_id_fkey",
        );
      } catch (err) {
        // Ignore if constraint doesn't exist
      }
    } finally {
      client.release();
    }
  };

  // ===== EXAM FORMAT OPERATIONS =====
  createExamFormat = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const {
        exam_type,
        class_id,
        section_id,
        academic_year_id,
        term,
        exam_date,
        pass_mark_percentage,
      } = data;

      const res = await pool.query(
        `INSERT INTO exam_formats 
         (exam_type, class_id, section_id, academic_year_id, term, exam_date, pass_mark_percentage, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          exam_type,
          class_id || null,
          section_id || null,
          academic_year_id || null,
          term || null,
          exam_date || null,
          pass_mark_percentage || 40,
          req?.user?.id || null,
        ],
      );
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to create exam format: ${err.message}`);
    }
  };

  publishExamFormat = async (id, isPublished, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const res = await pool.query(
        `UPDATE exam_formats
         SET is_published = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [isPublished, id],
      );

      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to publish exam format: ${err.message}`);
    }
  };

  getPublicStudentResults = async ({ tenantSlug, rollNumber, dateOfBirth }) => {
    try {
      const { centralPool, getTenantPool } = require("../config/tenantDb");
      const client = await centralPool.connect();

      try {
        const normalizedRoll = String(rollNumber || "").trim();
        const normalizedDob = String(dateOfBirth || "").trim();

        if (!normalizedRoll || !normalizedDob) {
          throw new Error("Roll number and date of birth are required");
        }

        const normalizedSlug = String(tenantSlug || "").trim().toLowerCase();
        const tenantQuery = normalizedSlug
          ? `SELECT id, database_name, slug FROM tenant WHERE slug = $1 AND is_active = TRUE`
          : `SELECT id, database_name, slug FROM tenant WHERE is_active = TRUE ORDER BY slug`;
        const tenantParams = normalizedSlug ? [normalizedSlug] : [];
        const tenantResult = await client.query(tenantQuery, tenantParams);

        if (tenantResult.rows.length === 0) {
          throw new Error("Tenant not found");
        }

        for (const tenant of tenantResult.rows) {
          const pool = getTenantPool(tenant.id, tenant.database_name);
          await this.ensure(pool);

          const studentRes = await pool.query(
            `SELECT id, full_name, roll_no, date_of_birth, class_id, section_id
             FROM students
             WHERE is_active = TRUE
               AND roll_no::text = $1
               AND date_of_birth::date = $2::date`,
            [normalizedRoll, normalizedDob],
          );

          if (studentRes.rows.length === 0) {
            continue;
          }

          const student = studentRes.rows[0];
          const examRes = await pool.query(
            `SELECT ef.id AS exam_format_id,
                    ef.exam_type,
                    ef.term,
                    ef.exam_date,
                    ef.pass_mark_percentage,
                    ef.is_published,
                    c.name AS class_name,
                    s.section_name,
                    es.id AS exam_subject_id,
                    es.subject_name,
                    es.total_max_marks,
                    sm.theory_marks,
                    sm.practical_marks,
                    sm.total_marks,
                    sm.is_pass,
                    sm.remarks
             FROM exam_formats ef
             LEFT JOIN classrooms c ON ef.class_id = c.id
             LEFT JOIN sections s ON ef.section_id = s.id
             LEFT JOIN exam_subjects es ON es.exam_format_id = ef.id
             LEFT JOIN student_marks sm ON sm.exam_subject_id = es.id AND sm.student_id = $1
             WHERE ef.is_published = TRUE
             ORDER BY ef.exam_date DESC, ef.id, es.subject_name`,
            [student.id],
          );

          const exams = [];
          const examMap = new Map();

          examRes.rows.forEach((row) => {
            if (!examMap.has(row.exam_format_id)) {
              examMap.set(row.exam_format_id, {
                exam_format_id: row.exam_format_id,
                exam_type: row.exam_type,
                term: row.term,
                exam_date: row.exam_date,
                pass_mark_percentage: row.pass_mark_percentage,
                class_name: row.class_name,
                section_name: row.section_name,
                subjects: [],
              });
            }

            const exam = examMap.get(row.exam_format_id);
            exam.subjects.push({
              exam_subject_id: row.exam_subject_id,
              subject_name: row.subject_name,
              total_max_marks: row.total_max_marks,
              theory_marks: row.theory_marks,
              practical_marks: row.practical_marks,
              total_marks: row.total_marks,
              is_pass: row.is_pass,
              remarks: row.remarks,
            });
          });

          examMap.forEach((exam) => exams.push(exam));

          return {
            student: {
              id: student.id,
              full_name: student.full_name,
              roll_no: student.roll_no,
              date_of_birth: student.date_of_birth,
              class_id: student.class_id,
              section_id: student.section_id,
            },
            exams,
          };
        }

        return { student: null, exams: [] };
      } finally {
        client.release();
      }
    } catch (err) {
      throw new Error(`Failed to fetch public student results: ${err.message}`);
    }
  };

  getExamFormats = async (filters = {}, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const conditions = [];
      const values = [];
      let idx = 1;

      if (filters.class_id) {
        conditions.push(`ef.class_id = $${idx++}`);
        values.push(filters.class_id);
      }
      if (filters.section_id) {
        conditions.push(`ef.section_id = $${idx++}`);
        values.push(filters.section_id);
      }
      if (filters.academic_year_id) {
        conditions.push(`ef.academic_year_id = $${idx++}`);
        values.push(filters.academic_year_id);
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const res = await pool.query(
        `SELECT ef.*, c.name as class_name, s.section_name as section_name, y.year_label as academic_year
         FROM exam_formats ef
         LEFT JOIN classrooms c ON ef.class_id = c.id
         LEFT JOIN sections s ON ef.section_id = s.id
         LEFT JOIN "year" y ON ef.academic_year_id = y.id
         ${whereClause}
         ORDER BY ef.created_at DESC`,
        values,
      );
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to fetch exam formats: ${err.message}`);
    }
  };

  getExamFormatById = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const res = await pool.query(
        `SELECT ef.*, c.name as class_name, s.section_name as section_name, y.year_label as academic_year
         FROM exam_formats ef
         LEFT JOIN classrooms c ON ef.class_id = c.id
         LEFT JOIN sections s ON ef.section_id = s.id
         LEFT JOIN "year" y ON ef.academic_year_id = y.id
         WHERE ef.id = $1`,
        [id],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch exam format: ${err.message}`);
    }
  };

  updateExamFormat = async (id, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const {
        exam_type,
        class_id,
        section_id,
        academic_year_id,
        term,
        exam_date,
        pass_mark_percentage,
      } = data;

      const res = await pool.query(
        `UPDATE exam_formats 
         SET exam_type = $1, class_id = $2, section_id = $3, academic_year_id = $4, 
             term = $5, exam_date = $6, pass_mark_percentage = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *`,
        [
          exam_type,
          class_id || null,
          section_id || null,
          academic_year_id || null,
          term || null,
          exam_date || null,
          pass_mark_percentage || 40,
          id,
        ],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update exam format: ${err.message}`);
    }
  };

  deleteExamFormat = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const res = await pool.query(
        `DELETE FROM exam_formats WHERE id = $1 RETURNING id`,
        [id],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete exam format: ${err.message}`);
    }
  };

  // ===== EXAM SUBJECTS OPERATIONS =====
  createExamSubject = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const {
        exam_format_id,
        course_id,
        subject_name,
        theory_max_marks,
        practical_max_marks,
        total_max_marks,
      } = data;

      const res = await pool.query(
        `INSERT INTO exam_subjects 
         (exam_format_id, course_id, subject_name, theory_max_marks, practical_max_marks, total_max_marks)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          exam_format_id,
          course_id || null,
          subject_name,
          theory_max_marks || 0,
          practical_max_marks || 0,
          total_max_marks || 0,
        ],
      );
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to create exam subject: ${err.message}`);
    }
  };

  getExamSubjects = async (exam_format_id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const res = await pool.query(
        `SELECT es.*, c.course_name as course_name
         FROM exam_subjects es
         LEFT JOIN courses c ON es.course_id = c.id
         WHERE es.exam_format_id = $1
         ORDER BY es.subject_name`,
        [exam_format_id],
      );
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to fetch exam subjects: ${err.message}`);
    }
  };

  updateExamSubject = async (id, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const {
        subject_name,
        theory_max_marks,
        practical_max_marks,
        total_max_marks,
      } = data;

      const res = await pool.query(
        `UPDATE exam_subjects 
         SET subject_name = $1, theory_max_marks = $2, practical_max_marks = $3, total_max_marks = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING *`,
        [
          subject_name,
          theory_max_marks || 0,
          practical_max_marks || 0,
          total_max_marks || 0,
          id,
        ],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update exam subject: ${err.message}`);
    }
  };

  deleteExamSubject = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const res = await pool.query(
        `DELETE FROM exam_subjects WHERE id = $1 RETURNING id`,
        [id],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete exam subject: ${err.message}`);
    }
  };

  // ===== STUDENT MARKS OPERATIONS =====
  createOrUpdateStudentMark = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const {
        exam_format_id,
        exam_subject_id,
        student_id,
        theory_marks,
        practical_marks,
        total_marks,
        is_pass,
        remarks,
      } = data;

      // Check if record exists
      const existing = await pool.query(
        `SELECT id FROM student_marks WHERE exam_format_id = $1 AND exam_subject_id = $2 AND student_id = $3`,
        [exam_format_id, exam_subject_id, student_id],
      );

      if (existing.rows.length > 0) {
        // Update existing
        const res = await pool.query(
          `UPDATE student_marks 
           SET theory_marks = $1, practical_marks = $2, total_marks = $3, is_pass = $4, remarks = $5, updated_at = CURRENT_TIMESTAMP
           WHERE id = $6 RETURNING *`,
          [
            theory_marks || null,
            practical_marks || null,
            total_marks || null,
            is_pass || false,
            remarks || null,
            existing.rows[0].id,
          ],
        );
        return res.rows[0];
      } else {
        // Create new
        const res = await pool.query(
          `INSERT INTO student_marks 
           (exam_format_id, exam_subject_id, student_id, theory_marks, practical_marks, total_marks, is_pass, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [
            exam_format_id,
            exam_subject_id,
            student_id,
            theory_marks || null,
            practical_marks || null,
            total_marks || null,
            is_pass || false,
            remarks || null,
          ],
        );
        return res.rows[0];
      }
    } catch (err) {
      throw new Error(`Failed to save student marks: ${err.message}`);
    }
  };

  getStudentMarksByExam = async (exam_format_id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const res = await pool.query(
        `SELECT sm.*, 
                std.full_name, std.roll_no, 
                es.subject_name, es.total_max_marks,
                ef.pass_mark_percentage
         FROM student_marks sm
         LEFT JOIN students std ON sm.student_id = std.id
         LEFT JOIN exam_subjects es ON sm.exam_subject_id = es.id
         LEFT JOIN exam_formats ef ON sm.exam_format_id = ef.id
         WHERE sm.exam_format_id = $1
         ORDER BY std.roll_no, es.subject_name`,
        [exam_format_id],
      );
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to fetch student marks: ${err.message}`);
    }
  };

  getStudentMarksByStudent = async (exam_format_id, student_id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const res = await pool.query(
        `SELECT sm.*, es.subject_name, es.total_max_marks, ef.pass_mark_percentage
         FROM student_marks sm
         LEFT JOIN exam_subjects es ON sm.exam_subject_id = es.id
         LEFT JOIN exam_formats ef ON sm.exam_format_id = ef.id
         WHERE sm.exam_format_id = $1 AND sm.student_id = $2
         ORDER BY es.subject_name`,
        [exam_format_id, student_id],
      );
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to fetch student marks: ${err.message}`);
    }
  };

  getClassStudents = async (class_id, section_id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      let query = `SELECT id, full_name, roll_no, student_mail as email FROM students WHERE is_active = TRUE`;
      const values = [];
      let idx = 1;

      if (class_id && class_id !== "null" && class_id !== "undefined") {
        query += ` AND (classroom_id = $${idx} OR class_id = $${idx})`;
        values.push(class_id);
        idx++;
      }
      if (section_id && section_id !== "null" && section_id !== "undefined") {
        query += ` AND section_id = $${idx}`;
        values.push(section_id);
        idx++;
      }

      query += ` ORDER BY roll_no`;

      console.log("getClassStudents Query:", query, "Values:", values);

      const res = await pool.query(query, values);
      console.log("getClassStudents Results:", res.rows.length);
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to fetch class students: ${err.message}`);
    }
  };

  deleteStudentMark = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const res = await pool.query(
        `DELETE FROM student_marks WHERE id = $1 RETURNING id`,
        [id],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete student mark: ${err.message}`);
    }
  };

  // Helper: Get courses for a class
  getClassCourses = async (class_id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");

      const res = await pool.query(
        `SELECT DISTINCT c.* FROM courses c
         WHERE c.classroom_id = $1 AND c.is_active = TRUE
         ORDER BY c.course_name`,
        [class_id],
      );
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to fetch class courses: ${err.message}`);
    }
  };

  // Legacy compatibility methods
  /**
   * Get all results for a classroom (for admin/tenant)
   */
  getClassroomResults = async (classroomId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      // Return exam formats for the classroom
      const result = await pool.query(
        "SELECT * FROM exam_formats WHERE class_id = $1",
        [classroomId],
      );
      return result.rows || [];
    } catch (err) {
      throw new Error(`Failed to get classroom results: ${err.message}`);
    }
  };

  /**
   * Get results for a teacher's assigned classroom only
   */
  getTeacherClassroomResults = async (classroomId, teacherId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      // First verify this classroom is assigned to the teacher
      const classroomCheck = await pool.query(
        "SELECT id FROM classrooms WHERE id = $1 AND class_teacher_id = $2",
        [classroomId, teacherId],
      );

      if (classroomCheck.rows.length === 0) {
        throw new Error(
          "Unauthorized: You do not have access to this classroom",
        );
      }

      // Get all results for this classroom
      const result = await pool.query(
        "SELECT * FROM results WHERE classroom_id = $1 ORDER BY student_id, subject",
        [classroomId],
      );
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to get classroom results: ${err.message}`);
    }
  };

  /**
   * Get result by ID
   */
  getResultById = async (resultId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);
      const result = await pool.query("SELECT * FROM results WHERE id = $1", [
        resultId,
      ]);
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to get result: ${err.message}`);
    }
  };

  /**
   * Create a result entry
   */
  createResult = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const {
        classroom_id,
        student_id,
        subject,
        first_term_marks = 0,
        second_term_marks = 0,
        final_marks = 0,
        grade = null,
        comments = null,
        created_by,
      } = data;

      if (!classroom_id || !student_id || !subject || !created_by) {
        throw new Error("Missing required fields");
      }

      const result = await pool.query(
        `INSERT INTO results 
         (classroom_id, student_id, subject, first_term_marks, second_term_marks, final_marks, grade, comments, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          classroom_id,
          student_id,
          subject,
          first_term_marks,
          second_term_marks,
          final_marks,
          grade,
          comments,
          created_by,
        ],
      );
      return result.rows[0];
    } catch (err) {
      throw new Error(`Failed to create result: ${err.message}`);
    }
  };

  /**
   * Bulk create results
   */
  bulkCreateResults = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const results = [];
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        for (const item of data) {
          const {
            classroom_id,
            student_id,
            subject,
            first_term_marks = 0,
            second_term_marks = 0,
            final_marks = 0,
            grade = null,
            comments = null,
            created_by,
          } = item;

          if (!classroom_id || !student_id || !subject || !created_by) {
            throw new Error("Missing required fields in one or more records");
          }

          const result = await client.query(
            `INSERT INTO results 
             (classroom_id, student_id, subject, first_term_marks, second_term_marks, final_marks, grade, comments, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
              classroom_id,
              student_id,
              subject,
              first_term_marks,
              second_term_marks,
              final_marks,
              grade,
              comments,
              created_by,
            ],
          );
          results.push(result.rows[0]);
        }

        await client.query("COMMIT");
        return results;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      throw new Error(`Failed to bulk create results: ${err.message}`);
    }
  };

  /**
   * Update result
   */
  updateResult = async (resultId, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const {
        first_term_marks,
        second_term_marks,
        final_marks,
        grade,
        comments,
        is_published,
      } = data;

      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (first_term_marks !== undefined) {
        updates.push(`first_term_marks = $${paramIndex++}`);
        values.push(first_term_marks);
      }
      if (second_term_marks !== undefined) {
        updates.push(`second_term_marks = $${paramIndex++}`);
        values.push(second_term_marks);
      }
      if (final_marks !== undefined) {
        updates.push(`final_marks = $${paramIndex++}`);
        values.push(final_marks);
      }
      if (grade !== undefined) {
        updates.push(`grade = $${paramIndex++}`);
        values.push(grade);
      }
      if (comments !== undefined) {
        updates.push(`comments = $${paramIndex++}`);
        values.push(comments);
      }
      if (is_published !== undefined) {
        updates.push(`is_published = $${paramIndex++}`);
        values.push(is_published);
      }

      if (updates.length === 0) {
        return this.getResultById(resultId, req);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(resultId);

      const result = await pool.query(
        `UPDATE results SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
        values,
      );
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to update result: ${err.message}`);
    }
  };

  /**
   * Delete result
   */
  deleteResult = async (resultId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const result = await pool.query(
        "DELETE FROM results WHERE id = $1 RETURNING id",
        [resultId],
      );
      return result.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete result: ${err.message}`);
    }
  };

  /**
   * Get results for a specific student
   */
  getStudentResults = async (studentId, classroomId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const result = await pool.query(
        "SELECT * FROM results WHERE student_id = $1 AND classroom_id = $2 ORDER BY subject",
        [studentId, classroomId],
      );
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to get student results: ${err.message}`);
    }
  };

  /**
   * Publish/finalize results for a classroom
   */
  publishClassroomResults = async (classroomId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensure(pool);

      const result = await pool.query(
        "UPDATE results SET is_published = TRUE, updated_at = CURRENT_TIMESTAMP WHERE classroom_id = $1 RETURNING *",
        [classroomId],
      );
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to publish results: ${err.message}`);
    }
  };

  /**
   * Get teachers assigned to classes
   */
  getTeachersClassrooms = async (teacherId, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");

      const result = await pool.query(
        "SELECT id, name FROM classrooms WHERE class_teacher_id = $1 AND is_active = TRUE",
        [teacherId],
      );
      return result.rows;
    } catch (err) {
      throw new Error(`Failed to get teacher's classrooms: ${err.message}`);
    }
  };
}

module.exports = new ResultService();
