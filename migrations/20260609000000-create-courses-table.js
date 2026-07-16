"use strict";

var dbm;
var type;
var seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql(`
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
      classroom_section_id INTEGER REFERENCES classroom_sections(id) ON DELETE SET NULL,
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

    CREATE INDEX IF NOT EXISTS idx_courses_course_code ON courses(course_code);
    CREATE INDEX IF NOT EXISTS idx_courses_primary_teacher_id ON courses(primary_teacher_id);
    CREATE INDEX IF NOT EXISTS idx_courses_classroom_id ON courses(classroom_id);
    CREATE INDEX IF NOT EXISTS idx_courses_classroom_section_id ON courses(classroom_section_id);
    CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses(is_active);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS courses;
  `);
};

exports._meta = {
  version: 1,
};
