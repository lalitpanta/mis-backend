class CoursesService {
  ensureTable = async (pool) => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        course_name VARCHAR(255) NOT NULL,
        course_code VARCHAR(50) UNIQUE NOT NULL,
        short_name VARCHAR(50),
        department VARCHAR(255),
        description TEXT,
        subject_type VARCHAR(100) DEFAULT 'Core',
        grade_level VARCHAR(100),
        academic_year VARCHAR(50),
        term_semester VARCHAR(100),
        category_tags JSONB DEFAULT '[]'::jsonb,
        periods_per_week INTEGER DEFAULT 0,
        period_duration_minutes INTEGER DEFAULT 45,
        credit_hours_theory NUMERIC(5,2) DEFAULT 0,
        credit_hours_lab NUMERIC(5,2) DEFAULT 0,
        total_contact_hours_per_week NUMERIC(5,2) DEFAULT 0,
        primary_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
        classroom_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL,
        section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
        teaching_language VARCHAR(100),
        delivery_mode VARCHAR(100) DEFAULT 'In-person',
        scheduled_days JSONB DEFAULT '[]'::jsonb,
        full_marks_theory NUMERIC(5,2) DEFAULT 100,
        pass_marks_theory NUMERIC(5,2) DEFAULT 40,
        full_marks_practical NUMERIC(5,2) DEFAULT 0,
        pass_marks_practical NUMERIC(5,2) DEFAULT 0,
        grading_scheme VARCHAR(100) DEFAULT 'Percentage',
        grade_point NUMERIC(5,2),
        assessment_components JSONB DEFAULT '[]'::jsonb,
        prerequisite_courses JSONB DEFAULT '[]'::jsonb,
        corequisite_courses JSONB DEFAULT '[]'::jsonb,
        minimum_cgpa_to_enroll NUMERIC(5,2),
        max_enrollment INTEGER,
        learning_outcomes JSONB DEFAULT '[]'::jsonb,
        syllabus_standard VARCHAR(100),
        textbooks JSONB DEFAULT '[]'::jsonb,
        lms_digital_resource_link VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE,
        show_in_student_portal BOOLEAN DEFAULT TRUE,
        allow_online_submission BOOLEAN DEFAULT FALSE,
        attendance_required BOOLEAN DEFAULT TRUE,
        include_in_progress_report BOOLEAN DEFAULT TRUE,
        is_elective BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_course_code ON courses(course_code);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_primary_teacher_id ON courses(primary_teacher_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_classroom_id ON courses(classroom_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_section_id ON courses(section_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses(is_active);
    `);

    await pool.query(`
      ALTER TABLE courses
      ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL;
    `);
  };

  getClassroomSectionNameSelect = async () => {
    return "COALESCE(cs.section_name, '') AS classroom_section_name";
  };

  getStudentSectionNameSelect = async (pool) => {
    const res = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'sections' AND column_name = 'section_name'",
    );
    return res.rows.length > 0
      ? "COALESCE(st.section_name, '')"
      : "COALESCE(st.name, '')";
  };

  getStudentSectionNameExpr = async (pool, alias = "st") => {
    const res = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'sections' AND column_name = 'section_name'",
    );
    return res.rows.length > 0
      ? `COALESCE(${alias}.section_name, '')`
      : `COALESCE(${alias}.name, '')`;
  };

  getClassroomSectionNameExpr = async () => {
    return "cs.section_name";
  };

  list = async (req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const sectionSelect = await this.getClassroomSectionNameSelect(pool);
      const studentSectionName = await this.getStudentSectionNameSelect(pool);
      const studentSectionName2 = await this.getStudentSectionNameExpr(pool, 'st2');
      const classroomSectionNameExpr = await this.getClassroomSectionNameExpr(pool);
      const res = await pool.query(`
        SELECT c.*, 
          COALESCE(t.full_name, '') AS teacher_name,
          COALESCE(cr.name, '') AS classroom_name,
          COALESCE(cr.name, '') AS class_name,
          ${sectionSelect},
          COALESCE(section_classroom.total_capacity, cr.total_capacity, 0) AS classroom_total_capacity,
          COALESCE((
            SELECT COUNT(*)
            FROM students s
            LEFT JOIN sections st ON s.section_id = st.id
            WHERE (
              (s.classroom_id IS NOT NULL AND s.classroom_id = c.classroom_id)
              OR (s.classroom_id IS NULL AND st.class_id = c.classroom_id)
            )
              AND (
                c.section_id IS NULL
                OR (
                  s.section_id IS NULL
                  OR ${studentSectionName} = ${classroomSectionNameExpr}
                  OR NOT EXISTS (
                    SELECT 1 FROM sections st2
                    WHERE st2.class_id = c.classroom_id
                      AND ${studentSectionName2} = ${classroomSectionNameExpr}
                  )
                )
              )
          ), 0) AS enrolled_count
        FROM courses c
        LEFT JOIN teachers t ON c.primary_teacher_id = t.id
        LEFT JOIN classrooms cr ON c.classroom_id = cr.id
        LEFT JOIN sections cs ON c.section_id = cs.id
        LEFT JOIN classrooms section_classroom ON cs.class_id = section_classroom.id
        ORDER BY c.course_code ASC
      `);
      return res.rows;
    } catch (err) {
      throw new Error(`Failed to list courses: ${err.message}`);
    }
  };

  get = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const sectionSelect = await this.getClassroomSectionNameSelect(pool);
      const studentSectionName = await this.getStudentSectionNameSelect(pool);
      const studentSectionName2 = await this.getStudentSectionNameExpr(pool, 'st2');
      const classroomSectionNameExpr = await this.getClassroomSectionNameExpr(pool);
      const res = await pool.query(
        `
        SELECT c.*, 
          COALESCE(t.full_name, '') AS teacher_name,
          COALESCE(cr.name, '') AS classroom_name,
          COALESCE(cr.name, '') AS class_name,
          ${sectionSelect},
          COALESCE(section_classroom.total_capacity, cr.total_capacity, 0) AS classroom_total_capacity,
          COALESCE((
            SELECT COUNT(*)
            FROM students s
            LEFT JOIN sections st ON s.section_id = st.id
            WHERE (
              (s.classroom_id IS NOT NULL AND s.classroom_id = c.classroom_id)
              OR (s.classroom_id IS NULL AND st.class_id = c.classroom_id)
            )
              AND (
                c.section_id IS NULL
                OR (
                  s.section_id IS NULL
                  OR ${studentSectionName} = ${classroomSectionNameExpr}
                  OR NOT EXISTS (
                    SELECT 1 FROM sections st2
                    WHERE st2.class_id = c.classroom_id
                      AND ${studentSectionName2} = ${classroomSectionNameExpr}
                  )
                )
              )
          ), 0) AS enrolled_count
        FROM courses c
        LEFT JOIN teachers t ON c.primary_teacher_id = t.id
        LEFT JOIN classrooms cr ON c.classroom_id = cr.id
        LEFT JOIN sections cs ON c.section_id = cs.id
        LEFT JOIN classrooms section_classroom ON cs.class_id = section_classroom.id
        WHERE c.id = $1
      `,
        [id],
      );
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to fetch course ${id}: ${err.message}`);
    }
  };

  create = async (data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      const columns = [
        "course_name",
        "course_code",
        "short_name",
        "department",
        "description",
        "subject_type",
        "grade_level",
        "academic_year",
        "term_semester",
        "category_tags",
        "periods_per_week",
        "period_duration_minutes",
        "credit_hours_theory",
        "credit_hours_lab",
        "total_contact_hours_per_week",
        "primary_teacher_id",
        "classroom_id",
        "section_id",
        "teaching_language",
        "delivery_mode",
        "scheduled_days",
        "full_marks_theory",
        "pass_marks_theory",
        "full_marks_practical",
        "pass_marks_practical",
        "grading_scheme",
        "grade_point",
        "assessment_components",
        "prerequisite_courses",
        "corequisite_courses",
        "minimum_cgpa_to_enroll",
        "max_enrollment",
        "learning_outcomes",
        "syllabus_standard",
        "textbooks",
        "lms_digital_resource_link",
        "is_active",
        "show_in_student_portal",
        "allow_online_submission",
        "attendance_required",
        "include_in_progress_report",
        "is_elective",
      ];

      const placeholders = columns.map((_, i) => `$${i + 1}`).join(",");
      const columnNames = columns.join(",");

      const vals = columns.map((col) => {
        if (
          col === "is_active" ||
          col === "show_in_student_portal" ||
          col === "allow_online_submission" ||
          col === "attendance_required" ||
          col === "include_in_progress_report" ||
          col === "is_elective"
        ) {
          return data[col] === undefined
            ? col === "is_active" ||
              col === "show_in_student_portal" ||
              col === "attendance_required" ||
              col === "include_in_progress_report"
              ? true
              : false
            : data[col];
        }
        if (
          col === "category_tags" ||
          col === "scheduled_days" ||
          col === "assessment_components" ||
          col === "prerequisite_courses" ||
          col === "corequisite_courses" ||
          col === "learning_outcomes" ||
          col === "textbooks"
        ) {
          return typeof data[col] === "object"
            ? JSON.stringify(data[col])
            : data[col] || null;
        }
        if (
          [
            "periods_per_week",
            "period_duration_minutes",
            "max_enrollment",
          ].includes(col)
        ) {
          const val = data[col];
          if (val === null || val === undefined || val === "") return null;
          const parsed = parseInt(val, 10);
          return isNaN(parsed) ? null : parsed;
        }
        if (
          [
            "credit_hours_theory",
            "credit_hours_lab",
            "total_contact_hours_per_week",
            "full_marks_theory",
            "pass_marks_theory",
            "full_marks_practical",
            "pass_marks_practical",
            "grade_point",
            "minimum_cgpa_to_enroll",
          ].includes(col)
        ) {
          const val = data[col];
          if (val === null || val === undefined || val === "") return null;
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        }
        return data[col] || null;
      });

      const q = `INSERT INTO courses (${columnNames}) VALUES (${placeholders}) RETURNING *`;
      const res = await pool.query(q, vals);
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to create course: ${err.message}`);
    }
  };

  update = async (id, data, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);

      const fields = [];
      const values = [];
      let idx = 1;

      const allowed = [
        "course_name",
        "course_code",
        "short_name",
        "department",
        "description",
        "subject_type",
        "grade_level",
        "academic_year",
        "term_semester",
        "category_tags",
        "periods_per_week",
        "period_duration_minutes",
        "credit_hours_theory",
        "credit_hours_lab",
        "total_contact_hours_per_week",
        "primary_teacher_id",
        "classroom_id",
        "section_id",
        "teaching_language",
        "delivery_mode",
        "scheduled_days",
        "full_marks_theory",
        "pass_marks_theory",
        "full_marks_practical",
        "pass_marks_practical",
        "grading_scheme",
        "grade_point",
        "assessment_components",
        "prerequisite_courses",
        "corequisite_courses",
        "minimum_cgpa_to_enroll",
        "max_enrollment",
        "learning_outcomes",
        "syllabus_standard",
        "textbooks",
        "lms_digital_resource_link",
        "is_active",
        "show_in_student_portal",
        "allow_online_submission",
        "attendance_required",
        "include_in_progress_report",
        "is_elective",
      ];

      for (const key of allowed) {
        if (data[key] !== undefined) {
          if (
            key === "category_tags" ||
            key === "scheduled_days" ||
            key === "assessment_components" ||
            key === "prerequisite_courses" ||
            key === "corequisite_courses" ||
            key === "learning_outcomes" ||
            key === "textbooks"
          ) {
            fields.push(`${key} = $${idx++}`);
            values.push(
              typeof data[key] === "object"
                ? JSON.stringify(data[key])
                : data[key],
            );
          } else if (
            [
              "periods_per_week",
              "period_duration_minutes",
              "max_enrollment",
            ].includes(key)
          ) {
            const val = data[key];
            if (val === null || val === undefined || val === "") {
              fields.push(`${key} = $${idx++}`);
              values.push(null);
            } else {
              const parsed = parseInt(val, 10);
              fields.push(`${key} = $${idx++}`);
              values.push(isNaN(parsed) ? null : parsed);
            }
          } else if (
            [
              "credit_hours_theory",
              "credit_hours_lab",
              "total_contact_hours_per_week",
              "full_marks_theory",
              "pass_marks_theory",
              "full_marks_practical",
              "pass_marks_practical",
              "grade_point",
              "minimum_cgpa_to_enroll",
            ].includes(key)
          ) {
            const val = data[key];
            if (val === null || val === undefined || val === "") {
              fields.push(`${key} = $${idx++}`);
              values.push(null);
            } else {
              const parsed = parseFloat(val);
              fields.push(`${key} = $${idx++}`);
              values.push(isNaN(parsed) ? null : parsed);
            }
          } else {
            fields.push(`${key} = $${idx++}`);
            values.push(data[key]);
          }
        }
      }

      if (fields.length === 0) return this.get(id, req);

      const q = `UPDATE courses SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
      values.push(id);
      const res = await pool.query(q, values);
      return res.rows[0];
    } catch (err) {
      throw new Error(`Failed to update course ${id}: ${err.message}`);
    }
  };

  remove = async (id, req) => {
    try {
      const pool = req?.tenantPool || require("../config/db");
      await this.ensureTable(pool);
      const q = `DELETE FROM courses WHERE id = $1 RETURNING id`;
      const res = await pool.query(q, [id]);
      return res.rows[0] || null;
    } catch (err) {
      throw new Error(`Failed to delete course ${id}: ${err.message}`);
    }
  };
}

module.exports = new CoursesService();
